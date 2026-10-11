export type MediaType = 'video' | 'audio' | 'stream';
export type AspectRatioMode = 'fit' | 'fill' | 'stretch' | '16:9' | '4:3' | 'original';
export type EqualizerPreset = 'flat' | 'bass' | 'vocal' | 'movie' | 'rock';

export interface MediaItem {
  id: string;
  title: string;
  url: string;
  type: MediaType;
  duration: number; // in seconds
  currentTime: number; // in seconds
  progressPercent: number; // 0 - 100
  thumbnailUrl?: string;
  sizeBytes?: number;
  format?: string; // mp4, mkv, m3u8, etc.
  subtitleUrl?: string;
  subtitleName?: string;
  isFavorite: boolean;
  lastPlayedAt: number;
  createdAt: number;
}

export interface SubtitleCue {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface PlayerSettings {
  aspectRatio: AspectRatioMode;
  playbackRate: number; // 0.25 - 4.0
  volume: number; // 0.0 - 2.0 (up to 200% Audio Boost)
  brightness: number; // 0.0 - 1.0
  equalizer: EqualizerPreset;
  subtitleSize: number; // in px, e.g. 20
  subtitleColor: string; // '#ffffff', '#fbbf24', etc.
  subtitleOffsetMs: number; // delay / advance in ms
  autoPlayNext: boolean;
  sleepTimerMinutes: number | null; // e.g. 15, 30, 60 or null
  backgroundAudio: boolean;
  pipEnabled: boolean;
}

export interface StreamHistoryItem {
  id: string;
  url: string;
  title: string;
  lastPlayedAt: number;
}
