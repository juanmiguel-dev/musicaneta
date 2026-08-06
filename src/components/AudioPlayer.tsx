import React, { useEffect, useRef, useState } from 'react';
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
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Estados de subida
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMsg, setUploadMsg] = useState('');

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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      setUploadStatus('uploading');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, title, artist, album }),
      });
      if (!res.ok) throw new Error('Error al conectar con la API de subida.');

      const { uploadUrl, isDirectUpload } = await res.json();

      if (isDirectUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('artist', artist);
        formData.append('album', album);
        const upRes = await fetch('/api/upload', { method: 'PUT', body: formData });
        if (!upRes.ok) throw new Error('Error al subir a Cloudflare R2.');
      } else {
        const upRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'audio/mpeg' },
          body: file,
        });
        if (!upRes.ok) throw new Error('Error subiendo binario a R2.');
      }

      setUploadStatus('success');
      setFile(null);
      setTitle('');
      setArtist('');
      setAlbum('');

      // Recargar playlist
      const trackRes = await fetch('/api/tracks');
      if (trackRes.ok) {
        const fresh: Track[] = await trackRes.json();
        setPlaylist(fresh, fresh.length - 1);
      }
    } catch (err: any) {
      setUploadStatus('error');
      setUploadMsg(err.message || 'Error en la subida');
    }
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

        {/* Botón Discreto de Administración / Upload */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="p-2.5 rounded-full glass-pill text-zinc-400 hover:text-white transition-all transform hover:scale-105"
          title="Subir canción (Admin)"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
          </svg>
        </button>
      </header>

      {/* Centro Imersivo: Arte de Tapa & Información de la Canción */}
      <main className="w-full max-w-md my-auto flex flex-col items-center z-10 space-y-8">
        {/* Carátula del Álbum con Estilo Apple Music Glass / Vinyl */}
        <div className="relative group">
          <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-88 md:h-88 rounded-3xl overflow-hidden shadow-2xl transition-all duration-700 transform group-hover:scale-[1.02] border border-white/10 relative">
            <img
              src={currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=800&q=80'}
              alt={currentTrack?.title || 'No Track'}
              className="w-full h-full object-cover"
            />

            {/* Micro Ecualizador Visualizador */}
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

        {/* Título y Artista */}
        <div className="text-center space-y-1 max-w-sm">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white truncate">
            {currentTrack?.title || 'Selecciona una canción'}
          </h1>
          <p className="text-sm font-medium text-zinc-400 truncate">
            {currentTrack?.artist || 'Musicaneta Studio'}
          </p>
        </div>

        {/* Timeline Seekbar Interactivo Futuro */}
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

      {/* Barra Flotante Inferior de Controles Futurist Apple Panel */}
      <footer className="w-full max-w-xl z-20 mb-4">
        <div className="glass-panel rounded-full px-6 py-4 flex items-center justify-between space-x-4 shadow-2xl">
          {/* Botón Lista de Reproducción */}
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

          {/* Controles Principales */}
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

          {/* Control de Volumen Integrado */}
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
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 glass-panel border-l border-white/10 z-40 p-6 flex flex-col animate-[slideIn_0.3s_ease-out]">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="font-bold text-lg text-white">Lista de Canciones</h3>
            <button
              onClick={() => setShowPlaylist(false)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-2 no-scrollbar">
            {playlist.map((t, idx) => (
              <div
                key={t.id || idx}
                onClick={() => playTrack(t, idx)}
                className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                  currentIndex === idx
                    ? 'bg-white/15 border border-white/20 text-white font-semibold'
                    : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img src={t.coverUrl} alt={t.title} className="w-10 h-10 rounded-xl object-cover" />
                  <div className="overflow-hidden">
                    <p className="text-sm truncate">{t.title}</p>
                    <p className="text-xs opacity-60 truncate">{t.artist}</p>
                  </div>
                </div>
                {currentIndex === idx && isPlaying && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Discreto de Carga para el Administrador */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 space-y-6 relative border border-white/15">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-white">Subir MP3 a Cloudflare R2</h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {uploadStatus === 'success' && (
                <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs">
                  ¡Canción cargada con éxito a R2!
                </div>
              )}
              {uploadStatus === 'error' && (
                <div className="p-3 bg-red-500/20 text-red-300 rounded-xl text-xs">
                  {uploadMsg}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Archivo MP3</label>
                <input
                  type="file"
                  accept="audio/mp3,audio/mpeg"
                  required
                  onChange={(e) => e.target.files && setFile(e.target.files[0])}
                  className="w-full text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-3"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  placeholder="Título del track"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Artista</label>
                <input
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  placeholder="Nombre del artista"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Álbum</label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  placeholder="Álbum"
                />
              </div>

              <button
                type="submit"
                disabled={uploadStatus === 'uploading'}
                className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all shadow-lg"
              >
                {uploadStatus === 'uploading' ? 'Subiendo...' : 'Subir Pista'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
