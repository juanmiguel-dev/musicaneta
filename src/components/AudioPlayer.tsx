import React, { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $currentTrack,
  $isPlaying,
  $currentTime,
  $duration,
  $volume,
  $isMuted,
  togglePlay,
  playNext,
  playPrevious,
  seekTo,
  setVolume,
  toggleMute,
} from '../stores/playerStore';

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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sincronizar estado de reproducción con elemento <audio>
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('Error al iniciar reproducción automática:', err);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Sincronizar cambio de pista
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    }
  }, [currentTrack]);

  // Sincronizar volumen
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      $currentTime.set(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      $duration.set(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    seekTo(newTime);
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-950 border-t border-zinc-800 text-zinc-400 flex items-center justify-center text-sm z-50 px-4">
        <span>Selecciona una canción para iniciar la reproducción</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 text-white z-50 px-4 flex items-center justify-between select-none shadow-2xl">
      {/* Audio oculto */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={playNext}
      />

      {/* Info Canción Actual */}
      <div className="flex items-center space-x-4 w-1/4 min-w-[200px]">
        <img
          src={currentTrack.coverUrl || '/placeholder.png'}
          alt={currentTrack.title}
          className="w-14 h-14 rounded-md object-cover shadow-md border border-zinc-800"
        />
        <div className="overflow-hidden">
          <h4 className="font-semibold text-sm truncate text-zinc-100">
            {currentTrack.title}
          </h4>
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {currentTrack.artist}
          </p>
        </div>
      </div>

      {/* Controles de Reproducción y Barra de Progreso */}
      <div className="flex flex-col items-center max-w-xl w-2/4 px-4">
        <div className="flex items-center space-x-6 mb-2">
          {/* Prev */}
          <button
            onClick={playPrevious}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Anterior"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/20"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={playNext}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Siguiente"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Timeline Seek Bar */}
        <div className="w-full flex items-center space-x-3 text-xs text-zinc-400">
          <span className="w-10 text-right font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:h-1.5 transition-all"
          />
          <span className="w-10 text-left font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control de Volumen */}
      <div className="flex items-center justify-end space-x-3 w-1/4 min-w-[150px]">
        <button
          onClick={toggleMute}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          {isMuted || volume === 0 ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
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
          className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:h-1.5 transition-all"
        />
      </div>
    </div>
  );
}
