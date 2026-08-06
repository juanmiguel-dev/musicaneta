export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // en segundos
  audioUrl: string;
  coverUrl: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playlist: Track[];
  currentIndex: number;
}
