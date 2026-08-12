import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs';
import path from 'node:path';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const runtimeEnv = (locals as any).runtime?.env;
    const processEnv = typeof process !== 'undefined' ? process.env : {};
    const env = { ...processEnv, ...runtimeEnv };

    const body = await request.json();
    const { filename, contentType } = body;

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
        ContentType: contentType || 'audio/mpeg',
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

    // Opción B: Carga directa a través del Worker
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
    const runtimeEnv = (locals as any).runtime?.env;
    const processEnv = typeof process !== 'undefined' ? process.env : {};
    const musicBucket = runtimeEnv?.MUSIC_BUCKET || (processEnv as any)?.MUSIC_BUCKET;

    let contentType = request.headers.get('content-type') || 'audio/mpeg';

    const safeDecode = (val: string | null) => {
      if (!val) return '';
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    };

    let title = safeDecode(request.headers.get('x-title'));
    let artist = safeDecode(request.headers.get('x-artist'));
    let album = safeDecode(request.headers.get('x-album'));
    let filename = safeDecode(request.headers.get('x-filename')) || 'track.mp3';

    let arrayBuffer: ArrayBuffer;

    // Soporte para FormData (usado en UploadForm.tsx) o binario directo (AudioPlayer.tsx)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'No se incluyó archivo en el formulario' }), { status: 400 });
      }
      arrayBuffer = await file.arrayBuffer();
      if (!filename || filename === 'track.mp3') filename = file.name;
      if (!title) title = (formData.get('title') as string) || file.name.replace(/\.[^/.]+$/, '');
      if (!artist) artist = (formData.get('artist') as string) || '';
      if (!album) album = (formData.get('album') as string) || '';
      contentType = file.type || 'audio/mpeg';
    } else {
      arrayBuffer = await request.arrayBuffer();
    }

    const cleanFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `tracks/${Date.now()}-${cleanFileName}`;

    // 1. Si existe R2 binding (Cloudflare Worker o Wrangler dev)
    if (musicBucket) {
      try {
        await musicBucket.put(key, arrayBuffer, {
          httpMetadata: { contentType },
          customMetadata: {
            title: encodeURIComponent(title || filename),
            artist: encodeURIComponent(artist || 'Soundraw'),
            album: encodeURIComponent(album || 'Soundraw Pack'),
          },
        });
        return new Response(JSON.stringify({ success: true, key }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (r2Err: any) {
        console.error('Error al guardar en R2:', r2Err);
        return new Response(
          JSON.stringify({ error: `Error R2: ${r2Err?.message || String(r2Err)}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Fallback de desarrollo local Node (npx astro dev)
    if (typeof fs !== 'undefined' && fs.existsSync && fs.mkdirSync) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const localFileName = `${Date.now()}-${cleanFileName}`;
      const localFilePath = path.join(uploadsDir, localFileName);
      fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));

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
    }

    return new Response(
      JSON.stringify({ error: 'R2 (MUSIC_BUCKET) no está disponible en Cloudflare. Revisa la vinculación en el panel de Cloudflare.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en PUT /api/upload:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Error interno al subir archivo' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
