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

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = locals.runtime?.env;

    // 1. Si estamos en producción en Cloudflare R2
    if (env && env.MUSIC_BUCKET) {
      const objects = await env.MUSIC_BUCKET.list({ limit: 500 });
      const publicDomain = env.R2_PUBLIC_DOMAIN || '';

      const r2Tracks: Track[] = objects.objects.map((obj) => ({
        id: obj.key,
        title: obj.customMetadata?.title || obj.key.replace(/\.[^/.]+$/, ''),
        artist: obj.customMetadata?.artist || 'Soundraw',
        album: obj.customMetadata?.album || 'Soundraw Pack',
        duration: Number(obj.customMetadata?.duration) || 180,
        audioUrl: publicDomain ? `${publicDomain}/${obj.key}` : `/api/tracks?key=${encodeURIComponent(obj.key)}`,
        coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
      }));

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
