import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs';
import path from 'node:path';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    const body = await request.json();
    const { filename, contentType, title, artist, album } = body;

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Filename es requerido' }), { status: 400 });
    }

    const key = `tracks/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Opción A: S3 Presigned URL si existen credenciales S3 R2 en producción
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

    // Opción B: Carga directa
    return new Response(
      JSON.stringify({
        uploadUrl: '/api/upload',
        directKey: key,
        isDirectUpload: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    const contentType = request.headers.get('content-type') || 'audio/wav';
    const title = decodeURIComponent(request.headers.get('x-title') || '');
    const artist = decodeURIComponent(request.headers.get('x-artist') || '');
    const album = decodeURIComponent(request.headers.get('x-album') || '');
    const filename = decodeURIComponent(request.headers.get('x-filename') || 'track.wav');

    const key = `tracks/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const arrayBuffer = await request.arrayBuffer();

    // 1. Si existe el binding R2 en Cloudflare Worker (Producción)
    if (env && env.MUSIC_BUCKET) {
      await env.MUSIC_BUCKET.put(key, arrayBuffer, {
        httpMetadata: { contentType },
        customMetadata: {
          title: title || filename,
          artist: artist || 'Soundraw',
          album: album || 'Soundraw Pack',
        },
      });
      return new Response(JSON.stringify({ success: true, key }), { status: 200 });
    }

    // 2. Fallback para Desarrollo Local (npm run dev): Guarda en public/uploads/
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const localFileName = `${Date.now()}-${cleanFileName}`;
    const localFilePath = path.join(uploadsDir, localFileName);
    fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));

    // Guardar metadata en un JSON local para desarrollo
    const metaPath = path.join(uploadsDir, 'metadata.json');
    let metaList: any[] = [];
    if (fs.existsSync(metaPath)) {
      try {
        metaList = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch (e) {}
    }

    metaList.push({
      id: localFileName,
      title: title || filename.replace(/\.[^/.]+$/, ''),
      artist: artist || 'Soundraw',
      album: album || 'Soundraw Pack',
      duration: 180,
      audioUrl: `/uploads/${localFileName}`,
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
    });

    fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2));

    return new Response(JSON.stringify({ success: true, key: localFileName, local: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error al procesar archivo:', err);
    return new Response(JSON.stringify({ error: err.message || 'Error guardando archivo' }), {
      status: 500,
    });
  }
};
