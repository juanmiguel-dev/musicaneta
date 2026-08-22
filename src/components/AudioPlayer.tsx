import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $currentTrack,
  $isPlaying,
  $volume,
  $isMuted,
  $playlist,
  $repeatMode,
  togglePlay,
  playNext,
  playPrevious,
  toggleMute,
  toggleRepeat,
  playTrack,
  setPlaylist,
} from '../stores/playerStore';
import type { Track } from '../types/music';

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
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
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80',
];

export function getTrackCover(track?: Track | null): string {
  if (!track) return DEFAULT_COVERS[3];
  if (track.coverUrl && !track.coverUrl.includes('photo-1614613535308-eb5fbd3d2c17')) {
    return track.coverUrl;
  }
  const lowerFolder = (track.folder || '').toLowerCase();
  const lowerTitle = (track.title || '').toLowerCase();
  if (lowerFolder.includes('podcast') || lowerTitle.includes('podcast')) {
    if (
      lowerTitle.includes('espejismo') ||
      lowerTitle.includes('conciencia') ||
      lowerTitle.includes('kozyrev') ||
      lowerTitle.includes('universo') ||
      lowerTitle.includes('reino') ||
      lowerTitle.includes('babil')
    ) {
      return '/covers/cover_cosmic.jpg';
    }
    return '/covers/cover_podcast.jpg';
  }
  if (
    lowerFolder.includes('native') ||
    lowerTitle.includes('lakota') ||
    lowerTitle.includes('spirit') ||
    lowerTitle.includes('ancestor') ||
    lowerTitle.includes('drum')
  ) {
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
  // ── Store state ──────────────────────────────────────────────────────────────
  const currentTrack = useStore($currentTrack);
  const isPlaying = useStore($isPlaying);
  const volume = useStore($volume);
  const isMuted = useStore($isMuted);
  const playlist = useStore($playlist);
  const repeatMode = useStore($repeatMode);

  // ── Local state (UI only) ────────────────────────────────────────────────────
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Audio time/duration: ONLY local React state, no nanostores ───────────────
  // The audio element is the single source of truth for playback position.
  const [displayTime, setDisplayTime] = useState(0);
  const [displayDuration, setDisplayDuration] = useState(0);
  // Separate seek state to decouple UI from audio element during drag
  const [seekValue, setSeekValue] = useState(0);
  const isSeekingRef = useRef(false); // use ref so audio callbacks see current value

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // ── Derived UI values ────────────────────────────────────────────────────────
  const uiTime = isSeekingRef.current ? seekValue : displayTime;
  const uiDuration = displayDuration > 0 ? displayDuration : 1;

  // ── Playlist derived ─────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set<string>();
    playlist.forEach((t) => {
      if (t.folder && t.folder !== 'General') {
        set.add(t.folder);
      } else {
        const folderName =
          t.album && t.album !== 'Colección Curada' && t.album !== 'Álbum Local' && t.album !== 'Native'
            ? t.album
            : t.artist;
        if (
          folderName &&
          folderName !== 'Artista Local' &&
          folderName !== 'Colección Curada' &&
          folderName !== 'Native'
        ) {
          set.add(folderName);
        }
      }
    });
    return Array.from(set);
  }, [playlist]);

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

  // ── Load initial catalogue ───────────────────────────────────────────────────
  useEffect(() => {
    if (playlist.length === 0) {
      fetch('/api/tracks')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Track[] | null) => {
          if (data && data.length > 0) setPlaylist(data, 0, false);
        })
        .catch(console.error);
    }
  }, []);

  // ── Effect: load new track src (only when track changes) ────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      lastTrackIdRef.current = null;
      setDisplayTime(0);
      setDisplayDuration(0);
      setSeekValue(0);
      return;
    }
    if (lastTrackIdRef.current === currentTrack.id) return; // same track, skip
    lastTrackIdRef.current = currentTrack.id;
    audio.src = encodeURI(currentTrack.audioUrl);
    audio.load();
    setDisplayTime(0);
    setDisplayDuration(0);
    setSeekValue(0);
  }, [currentTrack]);

  // ── Effect: sync play/pause (only when isPlaying flag changes) ───────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      const p = audio.play();
      if (p) {
        p.catch((err) => {
          if (err.name !== 'AbortError') {
            $isPlaying.set(false);
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Effect: volume ───────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // ── Audio element event handlers (pure functions, no store writes for time) ──
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isSeekingRef.current) return;
    setDisplayTime(audio.currentTime);
  }, []);

  const handleDurationChange = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = audio.duration;
    if (d && isFinite(d) && !isNaN(d) && d > 0) {
      setDisplayDuration(d);
    }
  }, []);

  const handleEnded = useCallback(() => {
    if (repeatMode === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else {
      // Reproducción automática continua por defecto
      playNext();
    }
  }, [repeatMode]);

  // ── Seek slider handlers ─────────────────────────────────────────────────────
  const handleSeekStart = useCallback(() => {
    isSeekingRef.current = true;
    const audio = audioRef.current;
    setSeekValue(audio ? audio.currentTime : displayTime);
  }, [displayTime]);

  const handleSeekDrag = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) setSeekValue(val);
  }, []);

  const handleSeekCommit = useCallback((val?: number) => {
    isSeekingRef.current = false;
    const audio = audioRef.current;
    const target = (typeof val === 'number' && !isNaN(val)) ? val : seekValue;
    if (!audio || isNaN(target)) return;
    try {
      audio.currentTime = target;
      setDisplayTime(target);
      setSeekValue(target);
    } catch (e) {
      console.warn('Error setting audio.currentTime:', e);
    }
  }, [seekValue]);

  // ── Skip ±10 seconds ─────────────────────────────────────────────────────────
  const skipSeconds = useCallback((secs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const cur = isFinite(audio.currentTime) ? audio.currentTime : (displayTime || 0);
    const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (displayDuration || 0);
    const next = dur > 0 ? Math.max(0, Math.min(dur, cur + secs)) : Math.max(0, cur + secs);
    try {
      audio.currentTime = next;
    } catch (e) {
      console.warn('Error setting audio.currentTime:', e);
    }
    setDisplayTime(next);
    setSeekValue(next);
  }, [displayTime, displayDuration]);

  const activeCover = getTrackCover(currentTrack);
  const progressPct = (uiTime / uiDuration) * 100;

  return (
    <div
      className="relative min-h-[100dvh] w-full flex flex-col justify-between items-center px-4 py-4 sm:px-6 sm:py-6 select-none text-white eternal-gradient-bg overflow-x-hidden"
    >
      {/* Audio element: purely managed by effects above */}
      <audio
        ref={audioRef}
        preload="none"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onLoadedMetadata={handleDurationChange}
        onCanPlay={handleDurationChange}
        onPlay={() => $isPlaying.set(true)}
        onPause={() => $isPlaying.set(false)}
        onEnded={handleEnded}
      />

      {/* Ambient glowing color orbs (rotando suavemente entre violeta, azul, cian, esmeralda, índigo - sin rojo) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
        <div
          className="orb-primary w-[320px] h-[320px] sm:w-[560px] sm:h-[560px] rounded-full blur-[110px] sm:blur-[140px] opacity-75 transition-all duration-1000"
          style={{
            background:
              'radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, rgba(59, 130, 246, 0.35) 45%, rgba(6, 182, 212, 0.2) 75%, transparent 90%)',
          }}
        />
        <div
          className="orb-secondary absolute w-[280px] h-[280px] sm:w-[500px] sm:h-[500px] rounded-full blur-[120px] sm:blur-[150px] opacity-65 transition-all duration-1000"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(99, 102, 241, 0.35) 50%, rgba(14, 165, 233, 0.25) 75%, transparent 90%)',
          }}
        />
      </div>

      {/* Header */}
      <header className="w-full max-w-md sm:max-w-xl flex items-center justify-between z-20 pt-1">
        {/* Botón de reproducción continua / repetir tema */}
        <button
          type="button"
          onClick={toggleRepeat}
          className={`h-9 px-3 rounded-full glass-pill flex items-center space-x-1.5 transition-all transform hover:scale-105 active:scale-95 shadow-md border ${
            repeatMode === 'one'
              ? 'text-white bg-purple-500/50 border-purple-300/60 shadow-[0_0_15px_rgba(168,85,247,0.5)] font-bold'
              : 'text-purple-200/80 hover:text-white border-white/10 bg-white/5'
          }`}
          title={
            repeatMode === 'one'
              ? 'Modo activo: Repetir canción actual'
              : 'Modo activo: Reproducción continua automática'
          }
        >
          {repeatMode === 'one' ? (
            <>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wider">1 Tema</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
              </svg>
              <span className="text-[10px] font-semibold opacity-90 hidden xs:inline">Auto</span>
            </>
          )}
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
          <span className="text-xs font-extrabold tracking-widest uppercase text-purple-200/90">MUSICANETA</span>
        </div>

        <button
          type="button"
          onClick={() => setShowPlaylist(!showPlaylist)}
          className={`h-9 px-3.5 sm:px-4 rounded-full flex items-center space-x-1.5 sm:space-x-2 transition-all transform hover:scale-105 active:scale-95 shadow-md border ${
            showPlaylist
              ? 'text-white bg-purple-500/40 border-purple-300/60 shadow-[0_0_15px_rgba(168,85,247,0.4)] font-bold'
              : 'text-purple-100 hover:text-white border-white/15 bg-white/10 hover:bg-white/20 backdrop-blur-xl'
          }`}
          title="Abrir Catálogo"
        >
          <svg className="w-4 h-4 fill-current opacity-90" viewBox="0 0 24 24">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
          </svg>
          <span className="text-[11px] sm:text-xs font-bold tracking-widest uppercase">CATÁLOGO</span>
        </button>
      </header>

      {/* Main: album art */}
      <main className="w-full max-w-md my-auto flex flex-col items-center z-10 py-1 space-y-2 sm:space-y-4">
        <div className="relative flex items-center justify-center p-2 sm:p-3">
          <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-pulse pointer-events-none" />
          <div className="absolute -inset-3 sm:-inset-5 rounded-full border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.35)] pointer-events-none" />
          <div className="absolute -inset-6 sm:-inset-10 rounded-full border border-purple-600/15 pointer-events-none" />
          <div className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 rounded-full overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-2 border-purple-300/30 relative group transition-all duration-700">
            <img
              src={activeCover}
              alt={formatTitle(currentTrack?.title) || 'Musicaneta'}
              width="224"
              height="224"
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className={`w-full h-full object-cover transition-transform duration-1000 ${isPlaying ? 'scale-105' : 'scale-100'}`}
            />
            <div className="absolute inset-0 bg-purple-950/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar reproducción' : 'Iniciar reproducción'}
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

        {/* Track info + download */}
        <div className="text-center space-y-1 max-w-sm sm:max-w-md px-3 flex flex-col items-center">
          <h1 className="text-base sm:text-xl font-extrabold tracking-wide text-white drop-shadow-md leading-snug line-clamp-3 break-words">
            {formatTitle(currentTrack?.title) || 'Selecciona una canción'}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-purple-200/80 line-clamp-2 break-words">
            {currentTrack?.artist || 'Musicaneta'}
            {currentTrack?.folder
              ? ` • 📁 ${currentTrack.folder}`
              : currentTrack?.album && currentTrack.album !== 'Álbum Local'
              ? ` • ${currentTrack.album}`
              : ''}
          </p>
          {currentTrack && (
            <a
              href={encodeURI(currentTrack.audioUrl)}
              download={`${formatTitle(currentTrack.title) || 'audio'}.mp3`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-purple-200 hover:text-white text-xs transition-all active:scale-95 shadow-sm mt-1"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              <span className="font-semibold text-[11px]">Descargar MP3</span>
            </a>
          )}
        </div>

        {/* Progress bar + skip buttons */}
        <div className="w-full max-w-xs sm:max-w-md px-2 space-y-1">
          <div className="flex items-center space-x-2">
            {/* -10s */}
            <button
              type="button"
              onClick={() => skipSeconds(-10)}
              className="p-2 rounded-full text-purple-300 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 transition-all flex items-center justify-center border border-white/10 shadow-sm flex-shrink-0"
              title="Retroceder 10s"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.2 3.16-1.98 5.12-1.98 3.79 0 6.94 2.69 7.68 6.25l2.42-.64C21.6 11.5 17.5 8 12.5 8z" />
              </svg>
              <span className="text-[10px] font-bold ml-0.5">10</span>
            </button>

            {/* Slider */}
            <input
              type="range"
              aria-label="Progreso de la reproducción de audio"
              min={0}
              max={displayDuration > 0 ? displayDuration : 100}
              step={0.5}
              value={isSeekingRef.current ? seekValue : displayTime}
              onChange={handleSeekDrag}
              onPointerDown={handleSeekStart}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onPointerUp={(e) => handleSeekCommit(parseFloat((e.target as HTMLInputElement).value))}
              onMouseUp={(e) => handleSeekCommit(parseFloat((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => handleSeekCommit(parseFloat((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  handleSeekCommit(parseFloat((e.target as HTMLInputElement).value));
                }
              }}
              className="flex-1 h-2.5 rounded-lg appearance-none cursor-pointer accent-purple-300 focus:outline-none border border-purple-400/30 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
              style={{
                background: `linear-gradient(to right, #c084fc ${progressPct}%, rgba(46,16,101,0.7) ${progressPct}%)`,
              }}
            />

            {/* +10s */}
            <button
              type="button"
              onClick={() => skipSeconds(10)}
              className="p-2 rounded-full text-purple-300 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 transition-all flex items-center justify-center border border-white/10 shadow-sm flex-shrink-0"
              title="Adelantar 10s"
            >
              <span className="text-[10px] font-bold mr-0.5">10</span>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M11.5 8c2.65 0 5.05 1 6.9 2.6L22 7v9h-9l3.62-3.62c-1.39-1.2-3.16-1.98-5.12-1.98-3.79 0-6.94 2.69-7.68 6.25l-2.42-.64C2.4 11.5 6.5 8 11.5 8z" />
              </svg>
            </button>
          </div>

          <div className="flex justify-between text-[11px] font-mono text-purple-300/80 px-1">
            <span>{formatTime(isSeekingRef.current ? seekValue : displayTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>

        {/* Playback controls: inmediatamente integrados bajo la barra de tiempo */}
        <div className="w-full max-w-xs sm:max-w-md pt-2">
          <div className="w-full glass-panel rounded-3xl px-5 py-3 flex items-center justify-between shadow-2xl border border-purple-400/20 bg-purple-950/70 backdrop-blur-2xl">
            <button
              type="button"
              onClick={toggleMute}
              className="w-10 h-10 rounded-full glass-pill flex items-center justify-center text-purple-200/70 hover:text-white transition-all"
              title="Silenciar"
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

              <button
                type="button"
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 text-white flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(168,85,247,0.6)] border border-purple-300/40"
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
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
        </div>
      </main>

      {/* Enlace Zenodo: abajo de todo a la izquierda */}
      <footer className="w-full sm:w-auto flex justify-start sm:fixed sm:bottom-4 sm:left-6 z-20 mt-4 sm:mt-0 mb-1 sm:mb-0 px-2 sm:px-0">
        <a
          href="https://zenodo.org/communities/sinergia-humano-ia/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] sm:text-[11px] font-medium text-purple-300/60 hover:text-purple-100 transition-all flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-purple-950/50 hover:bg-purple-900/70 border border-purple-400/15 hover:border-purple-400/35 backdrop-blur-md shadow-md tracking-wide group"
          title="Comunidad Zenodo: Sinergia Humano-IA"
        >
          <span className="opacity-75 group-hover:opacity-100 transition-opacity">🌐</span>
          <span>Sinergia Humano-IA en Zenodo</span>
          <svg className="w-3 h-3 fill-current opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
            <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V7h7V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7h-7z" />
          </svg>
        </a>
      </footer>

      {/* Playlist / Catálogo drawer */}
      {showPlaylist && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] md:w-[740px] lg:w-[940px] xl:w-[1100px] max-w-full glass-panel border-l border-white/15 z-40 p-4 sm:p-6 flex flex-col bg-purple-950/95 backdrop-blur-3xl shadow-[-20px_0_50px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
                </svg>
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-wide flex items-center space-x-2">
                  <span>Catálogo de Audios</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 font-semibold border border-purple-400/30">
                    {filteredPlaylist.length}
                  </span>
                </h3>
                <p className="text-[11px] sm:text-xs text-purple-200/60 mt-0.5">
                  Explora pistas, podcasts y colecciones
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPlaylist(false)}
              className="w-9 h-9 flex items-center justify-center text-purple-200 hover:text-white rounded-full bg-white/5 hover:bg-white/15 border border-white/10 transition-all active:scale-95"
              title="Cerrar Catálogo"
            >
              ✕
            </button>
          </div>

          {/* Search & Categories */}
          <div className="py-3 space-y-2.5 border-b border-white/10">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Buscar por título, podcast, lista o artista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-3.5 pr-8 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-400 focus:bg-white/10 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-300/60 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-24 overflow-y-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-purple-400 text-black font-extrabold shadow-md'
                      : 'bg-white/5 text-purple-200/70 hover:text-white border border-white/10 hover:bg-white/10'
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
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all ${
                        selectedCategory === cat
                          ? 'bg-purple-400 text-black font-extrabold shadow-md'
                          : 'bg-white/5 text-purple-200/70 hover:text-white border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      📁 {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grid de 3 por fila en desktop */}
          <div className="flex-1 overflow-y-auto mt-3 no-scrollbar pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pb-8">
              {filteredPlaylist.map((t, idx) => {
                const realIndex = playlist.findIndex((item) => item.id === t.id);
                const isCurrent = currentTrack?.id === t.id;
                const coverImg = getTrackCover(t);
                return (
                  <div
                    key={t.id || idx}
                    onClick={() => playTrack(t, realIndex !== -1 ? realIndex : idx)}
                    className={`group relative p-3 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-200 border ${
                      isCurrent
                        ? 'bg-purple-600/25 border-purple-400/60 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50'
                        : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 hover:border-purple-400/40 text-purple-200/90 hover:text-white'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-white/10 bg-purple-900/40">
                        <img
                          src={coverImg}
                          alt={t.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {isCurrent && (
                          <div className="absolute inset-0 bg-purple-950/60 backdrop-blur-[1px] flex items-center justify-center">
                            {isPlaying ? (
                              <div className="flex items-end space-x-0.5 h-4">
                                <span className="w-1 bg-purple-300 rounded-full animate-[bounce_1s_infinite_100ms] h-3" />
                                <span className="w-1 bg-purple-300 rounded-full animate-[bounce_1s_infinite_300ms] h-4" />
                                <span className="w-1 bg-purple-300 rounded-full animate-[bounce_1s_infinite_200ms] h-2" />
                              </div>
                            ) : (
                              <svg className="w-5 h-5 fill-purple-300 ml-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-white leading-snug break-words line-clamp-2 group-hover:text-purple-100 transition-colors">
                          {formatTitle(t.title)}
                        </p>
                        <p className="text-[11px] text-purple-300/80 truncate mt-0.5">
                          {t.artist || 'Musicaneta'}
                        </p>
                        {(t.folder || (t.album && t.album !== 'Álbum Local' && t.album !== 'Colección')) && (
                          <span className="inline-block mt-1 bg-white/10 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[130px] text-purple-200/90 border border-white/5">
                            📁 {t.folder || t.album}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs gap-2">
                      {/* Botón Play / Pause interactivo */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent) {
                            togglePlay();
                          } else {
                            playTrack(t, realIndex !== -1 ? realIndex : idx);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 text-[11px] font-bold transition-all transform active:scale-95 shadow-sm border ${
                          isCurrent && isPlaying
                            ? 'bg-purple-500 text-white border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                            : isCurrent
                            ? 'bg-purple-500/30 text-purple-200 border-purple-400/50 hover:bg-purple-500 hover:text-white'
                            : 'bg-white/10 text-purple-100 hover:text-white hover:bg-purple-600/80 border-white/15 hover:border-purple-400/40'
                        }`}
                        title={isCurrent && isPlaying ? 'Pausar audio' : 'Reproducir audio'}
                      >
                        {isCurrent && isPlaying ? (
                          <>
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                            <span>Pausa</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      {/* Botón Descargar */}
                      <a
                        href={encodeURI(t.audioUrl)}
                        download={`${formatTitle(t.title) || 'audio'}.mp3`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-purple-200 hover:text-white text-[11px] font-medium flex items-center space-x-1 transition-all active:scale-95 shadow-sm ml-auto"
                        title={`Descargar ${formatTitle(t.title)}`}
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                        </svg>
                        <span className="text-[10px]">Descargar</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
