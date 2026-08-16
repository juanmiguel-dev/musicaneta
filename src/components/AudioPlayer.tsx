import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $currentTrack,
  $isPlaying,
  $currentTime,
  $duration,
  $volume,
  $isMuted,
  $playlist,
  $currentIndex,
  $repeatMode,
  togglePlay,
  playNext,
  playPrevious,
  seekTo,
  setVolume,
  toggleMute,
  toggleRepeat,
  playTrack,
  setPlaylist,
} from '../stores/playerStore';
import type { Track } from '../types/music';

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/^podcast_/i, '')
    .replace(/__/g, ' – ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DEFAULT_COVERS = [
  '/covers/cover_podcast.jpg',
  '/covers/cover_cosmic.jpg',
  '/covers/cover_native.jpg',
  '/covers/cover_vinyl.jpg',
  '/covers/cover_cyber.jpg',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1520523839898-5071282543e2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80'
];

export function getTrackCover(track?: Track | null): string {
  if (!track) return DEFAULT_COVERS[3];
  if (track.coverUrl && !track.coverUrl.includes('photo-1614613535308-eb5fbd3d2c17')) {
    return track.coverUrl;
  }
  const lowerFolder = (track.folder || '').toLowerCase();
  const lowerTitle = (track.title || '').toLowerCase();
  if (lowerFolder.includes('podcast') || lowerTitle.includes('podcast')) {
    if (lowerTitle.includes('espejismo') || lowerTitle.includes('conciencia') || lowerTitle.includes('kozyrev') || lowerTitle.includes('universo') || lowerTitle.includes('reino') || lowerTitle.includes('babil')) {
      return '/covers/cover_cosmic.jpg';
    }
    return '/covers/cover_podcast.jpg';
  }
  if (lowerFolder.includes('native') || lowerTitle.includes('lakota') || lowerTitle.includes('spirit') || lowerTitle.includes('ancestor') || lowerTitle.includes('drum')) {
    return '/covers/cover_native.jpg';
  }
  let hash = 0;
  const str = track.id || track.title || 'musicaneta';
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return DEFAULT_COVERS[Math.abs(hash) % DEFAULT_COVERS.length];
}

export default function AudioPlayer() {
  const currentTrack = useStore($currentTrack);
  const isPlaying = useStore($isPlaying);
  const currentTime = useStore($currentTime);
  const duration = useStore($duration);
  const volume = useStore($volume);
  const isMuted = useStore($isMuted);
  const playlist = useStore($playlist);
  const currentIndex = useStore($currentIndex);
  const repeatMode = useStore($repeatMode);

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Filtros de canciones por Carpeta / Categoría y Búsqueda
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // Extraer carpetas / listas únicas de la playlist
  const categories = useMemo(() => {
    const set = new Set<string>();
    playlist.forEach((t) => {
      if (t.folder && t.folder !== 'General') {
        set.add(t.folder);
      } else {
        const folderName = (t.album && t.album !== 'Colección Curada' && t.album !== 'Álbum Local' && t.album !== 'Native') ? t.album : t.artist;
        if (folderName && folderName !== 'Artista Local' && folderName !== 'Colección Curada' && folderName !== 'Native') {
          set.add(folderName);
        }
      }
    });
    return Array.from(set);
  }, [playlist]);

  // Playlist filtrada según la carpeta/lista o búsqueda seleccionada
  const filteredPlaylist = useMemo(() => {
    return playlist.filter((t) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        t.folder === selectedCategory ||
        (t.folder && t.folder.startsWith(selectedCategory)) ||
        t.artist === selectedCategory ||
        t.album === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const cleanT = formatTitle(t.title).toLowerCase();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        cleanT.includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.folder && t.folder.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [playlist, selectedCategory, searchQuery]);

  // Cargar catálogo inicial si la lista está vacía
  useEffect(() => {
    async function loadInitialTracks() {
      if (playlist.length === 0) {
        try {
          const res = await fetch('/api/tracks');
          if (res.ok) {
            const data: Track[] = await res.json();
            if (data && data.length > 0) {
              setPlaylist(data, 0);
            }
          }
        } catch (e) {
          console.error('Error cargando catálogo inicial:', e);
        }
      }
    }
    loadInitialTracks();
  }, []);

  // Cargar pista de audio cuando cambia de canción (sin recargar en renderizados)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (lastTrackIdRef.current !== currentTrack.id) {
      lastTrackIdRef.current = currentTrack.id;
      const encodedUrl = encodeURI(currentTrack.audioUrl);
      audio.src = encodedUrl;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    }
  }, [currentTrack]);

  // Sincronizar estado play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying]);

  // Control de volumen y silencio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sincronizar valor visual del seek si no se está arrastrando
  useEffect(() => {
    if (!isSeeking) {
      setSeekValue(currentTime);
    }
  }, [currentTime, isSeeking]);

  // Manejo de eventos del elemento <audio>
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || isSeeking) return;
    seekTo(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration)) {
      $duration.set(audio.duration);
    }
  };

  // Manejo de deslizamiento de la barra de progreso
  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSeekValue(val);
  };

  const handleSeekEnd = (val?: number) => {
    const targetTime = typeof val === 'number' && !isNaN(val) ? val : seekValue;
    const audio = audioRef.current;
    if (audio && !isNaN(targetTime)) {
      audio.currentTime = targetTime;
    }
    seekTo(targetTime);
    setIsSeeking(false);
  };

  // Botones de salto rápido (Adelantar / Atrasar)
  const skipSeconds = (secs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const cur = audio.currentTime || currentTime || 0;
    const dur = audio.duration || duration || 0;
    const nextTime = Math.max(0, Math.min(dur, cur + secs));
    audio.currentTime = nextTime;
    setSeekValue(nextTime);
    seekTo(nextTime);
  };

  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      seekTo(0);
    } else if (repeatMode === 'all') {
      playNext();
    } else {
      if (currentIndex < playlist.length - 1) {
        playNext();
      } else {
        $isPlaying.set(false);
        seekTo(0);
      }
    }
  };

  const activeCover = getTrackCover(currentTrack);

  return (
    <div
      className="relative min-h-[100dvh] h-[100dvh] w-full flex flex-col justify-between items-center px-4 py-3 sm:px-6 sm:py-6 overflow-y-auto sm:overflow-hidden select-none text-white"
      style={{
        background: 'radial-gradient(circle at 50% 30%, #5b21b6 0%, #2e1065 40%, #0f0728 85%, #050311 100%)',
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnded}
      />

      {/* Resplandor Ambiental Violeta */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
        <div
          className="w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full blur-[110px] opacity-60 ambient-glow transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.5) 0%, rgba(124, 58, 237, 0.25) 50%, rgba(0, 0, 0, 0) 75%)',
          }}
        />
      </div>

      {/* Header: Botón Repetición - Marca - Menú Playlist */}
      <header className="w-full max-w-md sm:max-w-xl flex items-center justify-between z-20 pt-1">
        <button
          type="button"
          onClick={toggleRepeat}
          className={`w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-all relative transform hover:scale-105 active:scale-95 shadow-md border border-white/10 ${
            repeatMode !== 'off'
              ? 'text-purple-200 bg-purple-500/40 border border-purple-300/50 shadow-[0_0_15px_rgba(168,85,247,0.5)] font-bold'
              : 'text-purple-200/70 hover:text-white'
          }`}
          title={
            repeatMode === 'all'
              ? 'Reproducción Continua: ACTIVADA (Lista Completa)'
              : repeatMode === 'one'
              ? 'Reproducción Continua: TEMA ACTUAL'
              : 'Reproducción Continua: DESACTIVADA'
          }
        >
          {repeatMode === 'one' ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            </svg>
          )}
          {repeatMode !== 'off' && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse border border-white/50" />
          )}
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
          <span className="text-xs font-extrabold tracking-widest uppercase text-purple-200/90">
            MUSICANETA
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowPlaylist(!showPlaylist)}
          className={`w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-md border border-white/10 ${
            showPlaylist ? 'text-purple-300 bg-white/20' : 'text-purple-200 hover:text-white'
          }`}
          title="Lista de Reproducción & Carpetas"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
      </header>

      {/* Centro Inmersivo: Disco Circular con Arte */}
      <main className="w-full max-w-md my-auto flex flex-col items-center z-10 py-1 space-y-2 sm:space-y-4">
        <div className="relative flex items-center justify-center p-2 sm:p-3">
          <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-pulse pointer-events-none" />
          <div className="absolute -inset-3 sm:-inset-5 rounded-full border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.35)] pointer-events-none" />
          <div className="absolute -inset-6 sm:-inset-10 rounded-full border border-purple-600/15 pointer-events-none" />

          {/* Disco Principal */}
          <div className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 rounded-full overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-2 border-purple-300/30 relative group transition-all duration-700">
            <img
              src={activeCover}
              alt={formatTitle(currentTrack?.title) || 'No Track'}
              className={`w-full h-full object-cover transition-transform duration-1000 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />

            {/* Overlay al pulsar */}
            <div className="absolute inset-0 bg-purple-950/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white shadow-xl"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 fill-current ml-1" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Información del Tema (Título Completo Multilínea + Botón de Descarga) */}
        <div className="text-center space-y-1 max-w-sm sm:max-w-md px-3 flex flex-col items-center">
          <h1 className="text-base sm:text-xl font-extrabold tracking-wide text-white drop-shadow-md leading-snug line-clamp-3 break-words">
            {formatTitle(currentTrack?.title) || 'Selecciona una canción'}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-purple-200/80 line-clamp-2 break-words">
            {currentTrack?.artist || 'Musicaneta'}
            {currentTrack?.folder ? ` • 📁 ${currentTrack.folder}` : (currentTrack?.album && currentTrack.album !== 'Álbum Local' ? ` • ${currentTrack.album}` : '')}
          </p>

          {/* Botón de Descarga directa para el audio/podcast activo */}
          {currentTrack && (
            <a
              href={encodeURI(currentTrack.audioUrl)}
              download={`${formatTitle(currentTrack.title) || 'audio'}.mp3`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-purple-200 hover:text-white text-xs transition-all active:scale-95 shadow-sm mt-1"
              title="Descargar archivo MP3"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              <span className="font-semibold text-[11px]">Descargar MP3</span>
            </a>
          )}
        </div>

        {/* Barra de Progreso Deslizable & Botones de Salto ±10s */}
        <div className="w-full max-w-xs sm:max-w-md px-2 space-y-1">
          <div className="flex items-center space-x-2">
            {/* Retroceder 10 segundos */}
            <button
              type="button"
              onClick={() => skipSeconds(-10)}
              className="p-2 rounded-full text-purple-300 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 transition-all text-xs flex items-center justify-center border border-white/10 shadow-sm"
              title="Retroceder 10 segundos"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.2 3.16-1.98 5.12-1.98 3.79 0 6.94 2.69 7.68 6.25l2.42-.64C21.6 11.5 17.5 8 12.5 8z" />
              </svg>
              <span className="text-[10px] font-bold ml-1">-10s</span>
            </button>

            {/* Slider de Arrastre */}
            <div className="relative flex-1 flex items-center py-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={isSeeking ? seekValue : currentTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-purple-300 focus:outline-none transition-all border border-purple-400/30 shadow-[0_0_10px_rgba(168,85,247,0.3)] touch-none"
                style={{
                  background: `linear-gradient(to right, #c084fc ${
                    ((isSeeking ? seekValue : currentTime) / (duration || 1)) * 100
                  }%, rgba(46, 16, 101, 0.7) ${
                    ((isSeeking ? seekValue : currentTime) / (duration || 1)) * 100
                  }%)`,
                }}
              />
            </div>

            {/* Adelantar 10 segundos */}
            <button
              type="button"
              onClick={() => skipSeconds(10)}
              className="p-2 rounded-full text-purple-300 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 transition-all text-xs flex items-center justify-center border border-white/10 shadow-sm"
              title="Adelantar 10 segundos"
            >
              <span className="text-[10px] font-bold mr-1">+10s</span>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M11.5 8c2.65 0 5.05 1 6.9 2.6L22 7v9h-9l3.62-3.62c-1.39-1.2-3.16-1.98-5.12-1.98-3.79 0-6.94 2.69-7.68 6.25l-2.42-.64C2.4 11.5 6.5 8 11.5 8z" />
              </svg>
            </button>
          </div>

          <div className="flex justify-between text-[11px] font-mono text-purple-300/80 px-1">
            <span>{formatTime(isSeeking ? seekValue : currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </main>

      {/* Controles Sticky de Reproducción & Enlace de la Comunidad en Footer */}
      <footer className="sticky bottom-2 sm:bottom-3 w-full max-w-md z-30 flex flex-col items-center space-y-2 my-1">
        <div className="w-full glass-panel rounded-3xl px-5 py-3 flex items-center justify-between shadow-2xl border border-purple-400/20 bg-purple-950/70 backdrop-blur-2xl">
          {/* Silenciar / Volumen */}
          <button
            type="button"
            onClick={toggleMute}
            className="w-10 h-10 rounded-full glass-pill flex items-center justify-center text-purple-200/70 hover:text-white transition-all"
            title="Silenciar / Activar Sonido"
          >
            {isMuted || volume === 0 ? (
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M3.63 3.63L2.36 4.9 7 9.54V15h4l5 5V13.54l4.1 4.1 1.27-1.27L3.63 3.63zM16 4v3.88l3 3V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            )}
          </button>

          {/* Controles Principales centrados: Anterior - PLAY/PAUSE - Siguiente */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            <button
              type="button"
              onClick={playPrevious}
              className="w-11 h-11 rounded-full glass-pill text-white hover:text-purple-200 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 border border-white/10"
              title="Anterior"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* BOTÓN PRINCIPAL PLAY / PAUSE */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 text-white flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(168,85,247,0.6)] border border-purple-300/40"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 fill-current ml-1" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={playNext}
              className="w-11 h-11 rounded-full glass-pill text-white hover:text-purple-200 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 border border-white/10"
              title="Siguiente"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="w-10 h-10 pointer-events-none" />
        </div>

        {/* Enlace en el Footer a la Comunidad Zenodo */}
        <a
          href="https://zenodo.org/communities/sinergia-humano-ia/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-purple-300/70 hover:text-purple-100 transition-all flex items-center space-x-1.5 py-0.5 tracking-wide hover:underline"
          title="Visitar la comunidad Sinergia Humano-IA en Zenodo"
        >
          <span>🌐</span>
          <span>Sinergia Humano-IA en Zenodo</span>
          <svg className="w-3 h-3 fill-current opacity-70" viewBox="0 0 24 24">
            <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V7h7V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7h-7z" />
          </svg>
        </a>
      </footer>

      {/* Drawer Desplegable de Playlist Glass Panel */}
      {showPlaylist && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 glass-panel border-l border-white/10 z-40 p-5 flex flex-col bg-purple-950/90 backdrop-blur-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-lg text-white">Biblioteca de Música</h3>
              <p className="text-xs text-purple-200/70 mt-0.5">
                {filteredPlaylist.length} {filteredPlaylist.length === 1 ? 'pista' : 'pistas'}
              </p>
            </div>
            <button onClick={() => setShowPlaylist(false)} className="p-1 text-purple-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              ✕
            </button>
          </div>

          {/* Buscador & Filtro por Carpeta / Álbum */}
          <div className="py-3 space-y-3 border-b border-white/10">
            <input
              type="text"
              placeholder="🔍 Buscar título, podcast, lista o artista..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400 transition-all"
            />

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 pb-1 max-h-24 overflow-y-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-purple-400 text-black font-extrabold shadow-md'
                      : 'bg-white/5 text-purple-200/70 hover:text-white border border-white/10'
                  }`}
                >
                  Todas ({playlist.length})
                </button>
                {categories.map((cat) => {
                  const count = playlist.filter(
                    (t) =>
                      t.folder === cat ||
                      (t.folder && t.folder.startsWith(cat)) ||
                      t.artist === cat ||
                      t.album === cat
                  ).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                        selectedCategory === cat
                          ? 'bg-purple-400 text-black font-extrabold shadow-md'
                          : 'bg-white/5 text-purple-200/70 hover:text-white border border-white/10'
                      }`}
                    >
                      📁 {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista de Pistas con Títulos Completos, Portadas Variadas y Botón de Descarga */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-2 no-scrollbar pr-1">
            {filteredPlaylist.map((t, idx) => {
              const realIndex = playlist.findIndex((item) => item.id === t.id);
              const isCurrent = currentTrack?.id === t.id;
              const coverImg = getTrackCover(t);

              return (
                <div
                  key={t.id || idx}
                  onClick={() => playTrack(t, realIndex !== -1 ? realIndex : idx)}
                  className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-white/20 border border-white/30 text-white font-semibold shadow-lg'
                      : 'hover:bg-white/5 text-purple-200/80 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                    <img 
                      src={coverImg} 
                      alt={t.title} 
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-md border border-white/10" 
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-white leading-snug break-words line-clamp-2">
                        {formatTitle(t.title)}
                      </p>
                      <div className="flex items-center flex-wrap gap-1.5 text-[11px] opacity-75 mt-1">
                        <span className="truncate max-w-[100px] text-purple-300">{t.artist}</span>
                        {(t.folder || (t.album && t.album !== 'Álbum Local' && t.album !== 'Colección')) && (
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[130px] text-purple-200">
                            📁 {t.folder || t.album}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones del Item: Botón Descargar y Onda de Reproducción */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <a
                      href={encodeURI(t.audioUrl)}
                      download={`${formatTitle(t.title) || 'audio'}.mp3`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl text-purple-300/60 hover:text-purple-100 hover:bg-white/10 transition-all"
                      title={`Descargar ${formatTitle(t.title)}`}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                      </svg>
                    </a>
                    {isCurrent && isPlaying && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping ml-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
