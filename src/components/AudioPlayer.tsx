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
  togglePlay,
  playNext,
  playPrevious,
  seekTo,
  setVolume,
  toggleMute,
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

  const [showPlaylist, setShowPlaylist] = useState(false);

  // Filtros de canciones por Carpeta / Categoría y Búsqueda
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extraer carpetas / artistas / álbumes únicos de la playlist
  const categories = useMemo(() => {
    const set = new Set<string>();
    playlist.forEach((t) => {
      if (t.artist && t.artist !== 'Artista Local') set.add(t.artist);
      if (t.album && t.album !== 'Álbum Local') set.add(t.album);
    });
    return Array.from(set);
  }, [playlist]);

  // Playlist filtrada según la carpeta o búsqueda seleccionada
  const filteredPlaylist = useMemo(() => {
    return playlist.filter((t) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        t.artist === selectedCategory ||
        t.album === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q));
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

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 py-8 overflow-hidden select-none">
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && seekTo(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && $duration.set(audioRef.current.duration)}
        onEnded={playNext}
      />

      {/* Resplandor Ambiental de Fondo (Apple Style Mesh Ambient Glow) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10">
        <div
          className="w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full blur-[140px] opacity-40 ambient-glow transition-all duration-1000"
          style={{
            background: currentTrack?.coverUrl
              ? `radial-gradient(circle, rgba(52, 211, 153, 0.45) 0%, rgba(16, 185, 129, 0.15) 50%, rgba(5, 5, 5, 0) 75%)`
              : `radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(0,0,0,0) 70%)`,
          }}
        />
      </div>

      {/* Header Minimalista Superior */}
      <header className="w-full max-w-5xl flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-medium tracking-widest uppercase text-zinc-400">
            MUSICANETA
          </span>
        </div>
      </header>

      {/* Centro Immersivo: Arte de Tapa & Información */}
      <main className="w-full max-w-md my-auto flex flex-col items-center z-10 space-y-8">
        <div className="relative group">
          <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-88 md:h-88 rounded-3xl overflow-hidden shadow-2xl transition-all duration-700 transform group-hover:scale-[1.02] border border-white/10 relative">
            <img
              src={currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=800&q=80'}
              alt={currentTrack?.title || 'No Track'}
              className="w-full h-full object-cover"
            />

            {isPlaying && (
              <div className="absolute bottom-4 right-4 flex items-end space-x-1 glass-pill px-3 py-2 rounded-xl">
                <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-4" />
                <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_300ms] h-6" />
                <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_200ms] h-3" />
                <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-5" />
              </div>
            )}
          </div>
        </div>

        <div className="text-center space-y-1 max-w-sm">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white truncate">
            {currentTrack?.title || 'Selecciona una canción'}
          </h1>
          <p className="text-sm font-medium text-zinc-400 truncate">
            {currentTrack?.artist || 'Musicaneta Studio'}
          </p>
        </div>

        <div className="w-full space-y-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white transition-all"
          />
          <div className="flex justify-between text-xs font-mono text-zinc-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </main>

      {/* Barra Flotante Inferior */}
      <footer className="w-full max-w-xl z-20 mb-4">
        <div className="glass-panel rounded-full px-6 py-4 flex items-center justify-between space-x-4 shadow-2xl">
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`p-2.5 rounded-full transition-colors ${
              showPlaylist ? 'text-emerald-400 bg-white/10' : 'text-zinc-400 hover:text-white'
            }`}
            title="Playlist"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z" />
            </svg>
          </button>

          <div className="flex items-center space-x-6">
            <button
              onClick={playPrevious}
              className="text-zinc-400 hover:text-white transition-transform active:scale-95"
              title="Anterior"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-white/20"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
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

            <button
              onClick={playNext}
              className="text-zinc-400 hover:text-white transition-transform active:scale-95"
              title="Siguiente"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white">
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
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />
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
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-white text-black font-bold'
                      : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  Todas ({playlist.length})
                </button>
                {categories.map((cat) => {
                  const count = playlist.filter((t) => t.artist === cat || t.album === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-emerald-400 text-black font-bold'
                          : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
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
                        {t.album && t.album !== 'Álbum Local' && (
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">📁 {t.album}</span>
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
