import type { APIRoute } from 'astro';
import type { Track } from '../../types/music';
import fs from 'node:fs';
import path from 'node:path';

const mockTracks: Track[] = [
  {
    id: 'track-1',
    title: 'Solar Flare',
    artist: 'Synthwave Dreams',
    album: 'Cosmic Journey',
    duration: 215,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
  },
];

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    const url = new URL(request.url);
    const keyParam = url.searchParams.get('key');

    // Servir stream de audio directo si se consulta ?key=
    if (keyParam && env && env.MUSIC_BUCKET) {
      const obj = await env.MUSIC_BUCKET.get(keyParam);
      if (!obj) {
        return new Response('Pista no encontrada', { status: 404 });
      }
      const headers = new Headers();
      obj.writeHttpMetadata(headers as any);
      headers.set('etag', obj.httpEtag);
      headers.set('cache-control', 'public, max-age=31536000, immutable');

      return new Response(obj.body as unknown as BodyInit, { headers });
    }

    const safeDecode = (val?: string) => {
      if (!val) return '';
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    };

    // 1. Si estamos en producción en Cloudflare R2
    if (env && env.MUSIC_BUCKET) {
      const objects = await env.MUSIC_BUCKET.list({ limit: 500 });
      const publicDomain = env.R2_PUBLIC_DOMAIN || '';

      const r2Tracks: Track[] = objects.objects.map((obj) => {
        const rawTitle = obj.customMetadata?.title;
        const rawArtist = obj.customMetadata?.artist;
        const rawAlbum = obj.customMetadata?.album;

        const decodedTitle = safeDecode(rawTitle);
        const decodedArtist = safeDecode(rawArtist);
        const decodedAlbum = safeDecode(rawAlbum);

        const cleanKeyName = obj.key.replace(/^tracks\/\d+-/, '').replace(/\.[^/.]+$/, '');

        return {
          id: obj.key,
          title: decodedTitle || cleanKeyName,
          artist: decodedArtist || 'Soundraw',
          album: decodedAlbum || 'Soundraw Pack',
          duration: Number(obj.customMetadata?.duration) || 180,
          audioUrl: publicDomain
            ? `${publicDomain.replace(/\/$/, '')}/${obj.key}`
            : `/api/tracks?key=${encodeURIComponent(obj.key)}`,
          coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
        };
      });

      if (r2Tracks.length > 0) {
        return new Response(JSON.stringify(r2Tracks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Fallback de desarrollo local: Cargar archivos guardados en public/uploads/
    const metaPath = path.join(process.cwd(), 'public', 'uploads', 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        const localTracks: Track[] = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (localTracks.length > 0) {
          return new Response(JSON.stringify(localTracks), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {}
    }

    // 3. Fallback inicial si no hay archivos subidos aún
    return new Response(JSON.stringify(mockTracks), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error al listar canciones:', error);
    return new Response(JSON.stringify({ error: 'No se pudieron recuperar los tracks.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
