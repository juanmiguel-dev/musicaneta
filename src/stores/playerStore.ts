import { atom } from 'nanostores';
import type { Track } from '../types/music';
import localMetadata from '../../public/uploads/metadata.json';

export type RepeatMode = 'all' | 'one';

const initialPlaylist: Track[] = Array.isArray(localMetadata) && localMetadata.length > 0 ? (localMetadata as Track[]) : [];
const initialTrack: Track | null = initialPlaylist.length > 0 ? initialPlaylist[0] : null;

// Estado reactivo atómico global con Nanostores
export const $currentTrack = atom<Track | null>(initialTrack);
export const $isPlaying = atom<boolean>(false);
export const $currentTime = atom<number>(0);
export const $duration = atom<number>(0);
export const $volume = atom<number>(0.8);
export const $isMuted = atom<boolean>(false);
export const $playlist = atom<Track[]>(initialPlaylist);
export const $currentIndex = atom<number>(initialTrack ? 0 : -1);
export const $repeatMode = atom<RepeatMode>('all'); // 'all' = Reproducción continua por defecto

export function toggleRepeat() {
  const current = $repeatMode.get();
  $repeatMode.set(current === 'all' ? 'one' : 'all');
}

// Acciones globales
export function setPlaylist(tracks: Track[], startIndex = 0, autoPlay = false) {
  $playlist.set(tracks);
  if (tracks.length > 0 && startIndex >= 0 && startIndex < tracks.length) {
    if (autoPlay) {
      playTrack(tracks[startIndex], startIndex);
    } else {
      $currentIndex.set(startIndex);
      $currentTrack.set(tracks[startIndex]);
      $isPlaying.set(false);
      $currentTime.set(0);
    }
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
  if (playlist.length === 0) return;

  let index = $currentIndex.get();
  if (index === -1 && $currentTrack.get()) {
    index = playlist.findIndex((t) => t.id === $currentTrack.get()?.id);
  }
  if (index === -1) index = 0;

  const nextIndex = (index + 1) % playlist.length;
  $currentIndex.set(nextIndex);
  $currentTrack.set(playlist[nextIndex]);
  $isPlaying.set(true);
  $currentTime.set(0);
}

export function playPrevious() {
  const playlist = $playlist.get();
  if (playlist.length === 0) return;

  let index = $currentIndex.get();
  if (index === -1 && $currentTrack.get()) {
    index = playlist.findIndex((t) => t.id === $currentTrack.get()?.id);
  }
  if (index === -1) index = 0;

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
