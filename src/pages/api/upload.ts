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

    // Opción A: Si las credenciales S3 para R2 están configuradas en variables de entorno
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
        ContentType: contentType || 'audio/mpeg',
        Metadata: {
          title: title || '',
          artist: artist || '',
          album: album || '',
        },
      });

      // Generar la Presigned URL válida por 15 minutos (900 segundos)
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

    // Opción B: Si se utiliza el binding directo R2 en Cloudflare Workers
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

// Manejo de la subida binaria directa si se utiliza Worker Binding en lugar de Presigned URL
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    if (!env || !env.MUSIC_BUCKET) {
      return new Response(
        JSON.stringify({ error: 'Binding R2 MUSIC_BUCKET no configurado en entorno local.' }),
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const album = formData.get('album') as string;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se envió ningún archivo' }), { status: 400 });
    }

    const key = `tracks/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const arrayBuffer = await file.arrayBuffer();

    await env.MUSIC_BUCKET.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'audio/mpeg' },
      customMetadata: {
        title: title || file.name,
        artist: artist || 'Artista Desconocido',
        album: album || 'Single',
      },
    });

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en carga R2:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
