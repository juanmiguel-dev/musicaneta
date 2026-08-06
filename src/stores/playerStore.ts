import { atom } from 'nanostores';
import type { Track } from '../types/music';

// Estado reactivo atómico global con Nanostores
export const $currentTrack = atom<Track | null>(null);
export const $isPlaying = atom<boolean>(false);
export const $currentTime = atom<number>(0);
export const $duration = atom<number>(0);
export const $volume = atom<number>(0.8);
export const $isMuted = atom<boolean>(false);
export const $playlist = atom<Track[]>([]);
export const $currentIndex = atom<number>(-1);

// Acciones globales
export function setPlaylist(tracks: Track[], startIndex = 0) {
  $playlist.set(tracks);
  if (tracks.length > 0 && startIndex >= 0 && startIndex < tracks.length) {
    playTrack(tracks[startIndex], startIndex);
  }
}

export function playTrack(track: Track, index = -1) {
  const current = $currentTrack.get();
  const playlist = $playlist.get();

  if (index === -1) {
    const foundIndex = playlist.findIndex((t) => t.id === track.id);
    if (foundIndex !== -1) {
      $currentIndex.set(foundIndex);
    } else {
      $playlist.set([...playlist, track]);
      $currentIndex.set(playlist.length);
    }
  } else {
    $currentIndex.set(index);
  }

  // Si se presiona la misma canción en pausa, despausar
  if (current?.id === track.id) {
    $isPlaying.set(!$isPlaying.get());
  } else {
    $currentTrack.set(track);
    $isPlaying.set(true);
    $currentTime.set(0);
  }
}

export function togglePlay() {
  if ($currentTrack.get()) {
    $isPlaying.set(!$isPlaying.get());
  }
}

export function playNext() {
  const playlist = $playlist.get();
  const index = $currentIndex.get();
  if (playlist.length === 0) return;

  const nextIndex = (index + 1) % playlist.length;
  $currentIndex.set(nextIndex);
  $currentTrack.set(playlist[nextIndex]);
  $isPlaying.set(true);
  $currentTime.set(0);
}

export function playPrevious() {
  const playlist = $playlist.get();
  const index = $currentIndex.get();
  if (playlist.length === 0) return;

  const prevIndex = index > 0 ? index - 1 : playlist.length - 1;
  $currentIndex.set(prevIndex);
  $currentTrack.set(playlist[prevIndex]);
  $isPlaying.set(true);
  $currentTime.set(0);
}

export function seekTo(seconds: number) {
  $currentTime.set(seconds);
}

export function setVolume(val: number) {
  const clamped = Math.max(0, Math.min(1, val));
  $volume.set(clamped);
  if (clamped > 0) {
    $isMuted.set(false);
  }
}

export function toggleMute() {
  $isMuted.set(!$isMuted.get());
}
