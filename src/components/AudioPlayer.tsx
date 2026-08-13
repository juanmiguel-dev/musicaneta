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

  // Filtros de canciones por Carpeta / Categoría y Búsqueda
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.folder && t.folder.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [playlist, selectedCategory, searchQuery]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Sincronizar audio con el estado
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      if (isPlaying) audio.play().catch(() => {});
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = val;
    seekTo(val);
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

  return (
    <div
      className="relative min-h-[100dvh] h-[100dvh] w-full flex flex-col justify-between items-center px-4 py-3 sm:px-6 sm:py-6 overflow-y-auto sm:overflow-hidden select-none text-white"
      style={{
        background: 'radial-gradient(circle at 50% 30%, #5b21b6 0%, #2e1065 40%, #0f0728 85%, #050311 100%)',
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && seekTo(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && $duration.set(audioRef.current.duration)}
        onEnded={handleTrackEnded}
      />

      {/* Resplandor Ambiental Violeta (Apple Style Mesh Ambient Glow) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
        <div
          className="w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full blur-[110px] opacity-60 ambient-glow transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.5) 0%, rgba(124, 58, 237, 0.25) 50%, rgba(0, 0, 0, 0) 75%)',
          }}
        />
      </div>

      {/* Header Estilo Apple: Botón Volver (<) - Título - Menú Playlist (≡) */}
      <header className="w-full max-w-md sm:max-w-xl flex items-center justify-between z-20 pt-1">
        <button
          type="button"
          onClick={() => setShowPlaylist(!showPlaylist)}
          className="w-10 h-10 rounded-full glass-pill flex items-center justify-center text-purple-200 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-md border border-white/10"
          title="Menú"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
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
          title="Lista de Reproducción"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
      </header>

      {/* Centro Inmersivo: Disco Circular con Anillos Neumórficos Violeta */}
      <main className="w-full max-w-md my-auto flex flex-col items-center z-10 py-2 space-y-4 sm:space-y-6">
        {/* Disco de Arte de Tapa en Círculo con Anillos Concéntricos */}
        <div className="relative flex items-center justify-center p-2 sm:p-4">
          {/* Anillos Concéntricos Estilo Neumórfico Violeta */}
          <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-pulse pointer-events-none" />
          <div className="absolute -inset-3 sm:-inset-5 rounded-full border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.35)] pointer-events-none" />
          <div className="absolute -inset-6 sm:-inset-10 rounded-full border border-purple-600/15 pointer-events-none" />

          {/* Disco Principal */}
          <div className="w-44 h-44 xs:w-52 xs:h-52 sm:w-64 sm:h-64 rounded-full overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-2 border-purple-300/30 relative group transition-all duration-700">
            <img
              src={currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=800&q=80'}
              alt={currentTrack?.title || 'No Track'}
              className={`w-full h-full object-cover transition-transform duration-1000 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />

            {/* Overlay al pulsar o interactuar */}
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

        {/* Información del Tema */}
        <div className="text-center space-y-1 max-w-xs sm:max-w-sm px-2">
          <h1 className="text-lg sm:text-2xl font-extrabold tracking-wider uppercase text-white truncate drop-shadow-md">
            {currentTrack?.title || 'Selecciona una canción'}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-purple-200/80 truncate">
            {currentTrack?.artist || 'Musicaneta Studio'}
            {currentTrack?.album && currentTrack.album !== 'Álbum Local' ? ` - ${currentTrack.album}` : ''}
          </p>
        </div>

        {/* Barra de Progreso / Seek */}
        <div className="w-full max-w-xs sm:max-w-sm px-2 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-purple-950/60 rounded-lg appearance-none cursor-pointer accent-purple-300 transition-all border border-purple-500/20"
          />
          <div className="flex justify-between text-[11px] font-mono text-purple-300/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </main>

      {/* Controles de Reproducción Estilo Apple Violeta */}
      <footer className="w-full max-w-md z-20 mb-2 sm:mb-4">
        <div className="glass-panel rounded-3xl px-5 py-3.5 flex items-center justify-between shadow-2xl border border-purple-400/20 bg-purple-950/40 backdrop-blur-2xl">
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

            {/* BOTÓN PRINCIPAL PLAY / PAUSE (GRANDE VIOLETA APPLE STYLE) */}
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

          <div className="flex items-center space-x-2">
            {/* BOTÓN REPRODUCCIÓN CONTINUA */}
            <button
              type="button"
              onClick={toggleRepeat}
              className={`w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-all relative ${
                repeatMode !== 'off'
                  ? 'text-purple-200 bg-purple-500/40 border border-purple-300/50 shadow-[0_0_15px_rgba(168,85,247,0.5)] font-bold'
                  : 'text-purple-200/40 hover:text-white border border-white/10'
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

            {/* BOTÓN PLAYLIST / CATEGORÍAS */}
            <button
              type="button"
              onClick={() => setShowPlaylist(!showPlaylist)}
              className={`w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-all ${
                showPlaylist ? 'text-purple-300 bg-white/20' : 'text-purple-200/70 hover:text-white'
              }`}
              title="Categorías & Playlist"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z" />
              </svg>
            </button>
          </div>
        </div>
      </footer>

      {/* Drawer Desplegable de Playlist Glass Panel */}
      {showPlaylist && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 glass-panel border-l border-white/10 z-40 p-6 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-lg text-white">Biblioteca de Música</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {filteredPlaylist.length} {filteredPlaylist.length === 1 ? 'canción' : 'canciones'}
              </p>
            </div>
            <button onClick={() => setShowPlaylist(false)} className="p-1 text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>

          {/* Buscador & Filtro por Carpeta / Álbum */}
          <div className="py-3 space-y-3 border-b border-white/10">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, carpeta o artista..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
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

          <div className="flex-1 overflow-y-auto mt-3 space-y-2 no-scrollbar">
            {filteredPlaylist.map((t, idx) => {
              const realIndex = playlist.findIndex((item) => item.id === t.id);
              const isCurrent = currentTrack?.id === t.id;

              return (
                <div
                  key={t.id || idx}
                  onClick={() => playTrack(t, realIndex !== -1 ? realIndex : idx)}
                  className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-white/15 border border-white/20 text-white font-semibold'
                      : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <img src={t.coverUrl} alt={t.title} className="w-10 h-10 rounded-xl object-cover" />
                    <div className="overflow-hidden">
                      <p className="text-sm truncate">{t.title}</p>
                      <div className="flex items-center space-x-2 text-xs opacity-60 truncate">
                        <span>{t.artist}</span>
                        {(t.folder || (t.album && t.album !== 'Álbum Local' && t.album !== 'Colección')) && (
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[140px]">
                            📁 {t.folder || t.album}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isCurrent && isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
