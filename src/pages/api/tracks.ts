import type { APIRoute } from 'astro';
import type { Track } from '../../types/music';

// Datos de demostración por defecto para catálogo inicial
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
  {
    id: 'track-2',
    title: 'Neon Nights',
    artist: 'Cyber Pulse',
    album: 'Retro Wave Vol. 1',
    duration: 184,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=chill-lofi-song-8444.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'track-3',
    title: 'Starlight Echoes',
    artist: 'Acoustic Horizon',
    album: 'Deep Calm',
    duration: 240,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=guitars-and-synth-loop-11264.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
  },
];

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = locals.runtime?.env;

    // Si el bucket R2 de Cloudflare está disponible en producción/runtime:
    if (env && env.MUSIC_BUCKET) {
      const objects = await env.MUSIC_BUCKET.list({ limit: 100 });
      const publicDomain = env.R2_PUBLIC_DOMAIN || '';

      const r2Tracks: Track[] = objects.objects.map((obj) => ({
        id: obj.key,
        title: obj.customMetadata?.title || obj.key.replace(/\.[^/.]+$/, ''),
        artist: obj.customMetadata?.artist || 'Artista Desconocido',
        album: obj.customMetadata?.album || 'Single R2',
        duration: Number(obj.customMetadata?.duration) || 180,
        audioUrl: publicDomain ? `${publicDomain}/${obj.key}` : `/api/tracks?key=${encodeURIComponent(obj.key)}`,
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
      }));

      if (r2Tracks.length > 0) {
        return new Response(JSON.stringify(r2Tracks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback a canciones de muestra en desarrollo si R2 está vacío
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
