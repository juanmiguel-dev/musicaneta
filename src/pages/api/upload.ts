import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    const body = await request.json();
    const { filename, contentType, title, artist, album } = body;

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Filename es requerido' }), { status: 400 });
    }

    const key = `tracks/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Opción A: S3 Presigned URL si existen credenciales S3 R2
    if (
      env?.R2_ACCOUNT_ID &&
      env?.R2_ACCESS_KEY_ID &&
      env?.R2_SECRET_ACCESS_KEY &&
      env?.R2_BUCKET_NAME
    ) {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType || 'audio/wav',
        Metadata: {
          title: title || '',
          artist: artist || '',
          album: album || '',
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      return new Response(
        JSON.stringify({
          uploadUrl,
          directKey: key,
          isDirectUpload: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Opción B: Subida binaria directa a la API
    return new Response(
      JSON.stringify({
        uploadUrl: '/api/upload',
        directKey: key,
        isDirectUpload: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error al generar la URL de subida:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error en servidor al preparar la subida.' }),
      { status: 500 }
    );
  }
};

// Carga binaria optimizada en streaming sin límites de FormData para archivos WAV pesados (20-50MB)
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    if (!env || !env.MUSIC_BUCKET) {
      return new Response(
        JSON.stringify({ error: 'Binding R2 MUSIC_BUCKET no disponible.' }),
        { status: 500 }
      );
    }

    const contentType = request.headers.get('content-type') || 'audio/wav';
    const title = decodeURIComponent(request.headers.get('x-title') || '');
    const artist = decodeURIComponent(request.headers.get('x-artist') || '');
    const album = decodeURIComponent(request.headers.get('x-album') || '');
    const filename = decodeURIComponent(request.headers.get('x-filename') || 'track.wav');

    const key = `tracks/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Si la petición viene con FormData (compatibilidad anterior)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const formTitle = formData.get('title') as string;
      const formArtist = formData.get('artist') as string;
      const formAlbum = formData.get('album') as string;

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      await env.MUSIC_BUCKET.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'audio/wav' },
        customMetadata: {
          title: formTitle || file.name,
          artist: formArtist || 'Soundraw',
          album: formAlbum || 'Soundraw Pack',
        },
      });

      return new Response(JSON.stringify({ success: true, key }), { status: 200 });
    }

    // Direct Binary Stream Push (mucho más rápido y eficiente)
    const arrayBuffer = await request.arrayBuffer();

    await env.MUSIC_BUCKET.put(key, arrayBuffer, {
      httpMetadata: { contentType },
      customMetadata: {
        title: title || filename,
        artist: artist || 'Soundraw',
        album: album || 'Soundraw Pack',
      },
    });

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en carga R2:', err);
    return new Response(JSON.stringify({ error: err.message || 'Error al guardar archivo en R2.' }), {
      status: 500,
    });
  }
};
