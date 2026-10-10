import type { TTSSettings, TTSEngineType } from '../../types';

export type TTSState = 'idle' | 'playing' | 'paused';

export interface TTSListener {
  onStateChange?: (state: TTSState) => void;
  onSentenceChange?: (sentenceIndex: number, sentenceText: string) => void;
  onChapterComplete?: () => void;
  onTimeRemainingUpdate?: (secondsLeft: number | null) => void;
}

export interface VoiceOption {
  id: string;
  name: string;
  category: TTSEngineType;
  gender: 'male' | 'female' | 'neutral';
  badge: string;
  description: string;
  isOnline: boolean;
}

export const CURATED_VOICES: VoiceOption[] = [
  {
    id: 'edge:vi-VN-NamMinhNeural',
    name: 'Nam Minh (AI Neural)',
    category: 'ai',
    gender: 'male',
    badge: 'Hào Hùng · Kiếm Hiệp',
    description: 'Giọng Nam trầm ấm, hào hùng, đọc truyện Kiếm hiệp, Tiên hiệp cực kỳ lôi cuốn',
    isOnline: true
  },
  {
    id: 'edge:vi-VN-HoaiMyNeural',
    name: 'Hoài My (AI Neural)',
    category: 'ai',
    gender: 'female',
    badge: 'Truyền Cảm · Ngôn Tình',
    description: 'Giọng Nữ truyền cảm, ngọt ngào, phù hợp Ngôn tình, Đô thị, Huyền huyễn',
    isOnline: true
  },
  {
    id: 'google:vi',
    name: 'Google Tiếng Việt',
    category: 'google',
    gender: 'female',
    badge: 'Chuẩn Mực · Rõ Ràng',
    description: 'Giọng đọc Google chuẩn xác, rõ từng chữ, dễ nghe',
    isOnline: true
  }
];

// In Capacitor mobile app, origin is capacitor://localhost so use production Vercel API
const API_BASE = (typeof window !== 'undefined' && window.location.origin.startsWith('http')) 
  ? '' 
  : 'https://chill-reader.vercel.app';

class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private sentences: string[] = [];
  private currentSentenceIndex = 0;
  private state: TTSState = 'idle';
  private listeners: Set<TTSListener> = new Set();
  private sleepTimerId: number | null = null;
  private sleepTimerSeconds: number | null = null;
  private sleepCountdownInterval: number | null = null;

  // Online audio elements
  private audioPlayer: HTMLAudioElement | null = null;
  private prefetchAudio: HTMLAudioElement | null = null;
  private testAudio: HTMLAudioElement | null = null;

  // Silent audio player to keep mobile browser audio context alive in the background
  private silentAudio: HTMLAudioElement | null = null;

  // Metadata for MediaSession
  private currentBookTitle = '';
  private currentAuthor = '';
  private currentChapterTitle = '';
  private currentCoverUrl = '';

  private settings: TTSSettings = {
    voiceURI: 'edge:vi-VN-NamMinhNeural',
    engine: 'ai',
    rate: 1.0,
    pitch: 1.0,
    sleepTimerMinutes: null,
    highlightSentence: true,
    autoNextChapter: true
  };

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
      this.setupSilentAudio();
      this.setupAudioPlayer();
    }
  }

  private setupSilentAudio() {
    const silentWavBase64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    this.silentAudio = new Audio(silentWavBase64);
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01;
  }

  private setupAudioPlayer() {
    this.audioPlayer = new Audio();
    this.audioPlayer.preload = 'auto';

    this.audioPlayer.addEventListener('ended', () => {
      if (this.state === 'playing') {
        this.currentSentenceIndex++;
        this.speakCurrentSentence();
      }
    });

    this.audioPlayer.addEventListener('error', (e) => {
      console.warn('Online audio player error:', e);
      if (this.state === 'playing') {
        this.currentSentenceIndex++;
        this.speakCurrentSentence();
      }
    });
  }

  public isOnlineVoice(voiceURI?: string): boolean {
    const v = voiceURI !== undefined ? voiceURI : this.settings.voiceURI;
    if (!v) return true; // Default to online Edge Nam Minh
    return v.startsWith('edge:') || v.startsWith('google:') || v.startsWith('vi-VN-');
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public getVietnameseVoices(): SpeechSynthesisVoice[] {
    const all = this.getVoices();
    const vi = all.filter(v => v.lang.toLowerCase().startsWith('vi') || v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tiếng việt'));
    return vi.length > 0 ? vi : all;
  }

  /**
   * Get complete list of all voices (AI Neural, Google, and Browser local voices)
   */
  public getAllAvailableVoices(): VoiceOption[] {
    const list: VoiceOption[] = [...CURATED_VOICES];

    const browserVoices = this.getVietnameseVoices();
    browserVoices.forEach(bv => {
      const lower = bv.name.toLowerCase();
      const isMale = lower.includes('male') || lower.includes('nam') || lower.includes('an');
      list.push({
        id: bv.voiceURI,
        name: bv.name,
        category: 'browser',
        gender: isMale ? 'male' : 'female',
        badge: 'Offline · Thiết bị',
        description: `Giọng đọc có sẵn trên máy (${bv.lang}) - Hoạt động khi không có mạng`,
        isOnline: false
      });
    });

    return list;
  }

  /**
   * Test / preview a voice with a sample sentence
   */
  public async testVoice(
    voiceURI: string, 
    sampleText = 'Xin chào, bạn đang nghe thử giọng đọc trên ứng dụng Chill Reader.'
  ): Promise<void> {
    // Stop any existing test
    if (this.testAudio) {
      this.testAudio.pause();
      this.testAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }

    if (this.isOnlineVoice(voiceURI)) {
      const url = `${API_BASE}/api/tts?voice=${encodeURIComponent(voiceURI)}&rate=${this.settings.rate}&pitch=${this.settings.pitch}&text=${encodeURIComponent(sampleText)}`;
      this.testAudio = new Audio(url);
      await this.testAudio.play();
    } else {
      if (!this.synth) return;
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      const voice = this.getVoices().find(v => v.voiceURI === voiceURI);
      if (voice) utterance.voice = voice;
      this.synth.speak(utterance);
    }
  }

  public updateSettings(newSettings: Partial<TTSSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.sleepTimerMinutes !== undefined) {
      this.setSleepTimer(newSettings.sleepTimerMinutes);
    }
  }

  public getSettings(): TTSSettings {
    return this.settings;
  }

  public addListener(listener: TTSListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyState(state: TTSState) {
    this.state = state;
    this.listeners.forEach(l => l.onStateChange?.(state));
    this.updateMediaSessionPlaybackState();
  }

  private notifySentence(index: number, text: string) {
    this.currentSentenceIndex = index;
    this.listeners.forEach(l => l.onSentenceChange?.(index, text));
  }

  private notifyCountdown(seconds: number | null) {
    this.listeners.forEach(l => l.onTimeRemainingUpdate?.(seconds));
  }

  /**
   * Set chapter text and start or jump
   */
  public loadChapter(
    content: string, 
    metadata: { title: string; author: string; chapterTitle: string; coverUrl?: string },
    startFromSentenceIndex: number = 0
  ) {
    this.stop();
    this.currentBookTitle = metadata.title;
    this.currentAuthor = metadata.author;
    this.currentChapterTitle = metadata.chapterTitle;
    this.currentCoverUrl = metadata.coverUrl || '';

    this.sentences = this.splitIntoSentences(content);
    this.currentSentenceIndex = Math.max(0, Math.min(startFromSentenceIndex, this.sentences.length - 1));
    this.updateMediaSessionMetadata();
  }

  public play() {
    if (this.sentences.length === 0) return;

    if (this.state === 'paused') {
      if (this.isOnlineVoice() && this.audioPlayer && this.audioPlayer.src) {
        this.audioPlayer.play().catch(() => {});
      } else if (this.synth) {
        this.synth.resume();
      }
      this.silentAudio?.play().catch(() => {});
      this.notifyState('playing');
      return;
    }

    this.silentAudio?.play().catch(() => {});
    this.notifyState('playing');
    this.speakCurrentSentence();
  }

  public pause() {
    if (this.isOnlineVoice() && this.audioPlayer) {
      this.audioPlayer.pause();
    } else if (this.synth) {
      this.synth.pause();
    }
    this.silentAudio?.pause();
    this.notifyState('paused');
  }

  public stop() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.src = '';
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.silentAudio?.pause();
    this.notifyState('idle');
  }

  public togglePlayPause() {
    if (this.state === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  public jumpToSentence(index: number) {
    if (index < 0 || index >= this.sentences.length) return;
    const wasPlaying = this.state === 'playing';
    this.stop();
    this.currentSentenceIndex = index;
    if (wasPlaying) {
      this.play();
    } else {
      this.notifySentence(index, this.sentences[index]);
    }
  }

  public previousSentence() {
    if (this.currentSentenceIndex > 0) {
      this.jumpToSentence(this.currentSentenceIndex - 1);
    }
  }

  public nextSentence() {
    if (this.currentSentenceIndex < this.sentences.length - 1) {
      this.jumpToSentence(this.currentSentenceIndex + 1);
    }
  }

  private speakCurrentSentence() {
    if (this.state !== 'playing') return;

    if (this.currentSentenceIndex >= this.sentences.length) {
      this.stop();
      this.listeners.forEach(l => l.onChapterComplete?.());
      return;
    }

    const sentence = this.sentences[this.currentSentenceIndex];
    this.notifySentence(this.currentSentenceIndex, sentence);

    // 1. Online AI Neural / Google TTS playback
    if (this.isOnlineVoice()) {
      if (this.synth) this.synth.cancel();

      if (!this.audioPlayer) {
        this.setupAudioPlayer();
      }

      const voice = this.settings.voiceURI || 'edge:vi-VN-NamMinhNeural';
      const audioUrl = `${API_BASE}/api/tts?voice=${encodeURIComponent(voice)}&rate=${this.settings.rate}&pitch=${this.settings.pitch}&text=${encodeURIComponent(sentence)}`;

      if (this.audioPlayer) {
        this.audioPlayer.src = audioUrl;
        this.audioPlayer.play().catch(err => {
          console.warn('Audio play error, retrying next:', err);
          if (this.state === 'playing') {
            this.currentSentenceIndex++;
            this.speakCurrentSentence();
          }
        });
      }

      // Prefetch next sentence audio for seamless instant playback
      if (this.currentSentenceIndex + 1 < this.sentences.length) {
        const nextSentence = this.sentences[this.currentSentenceIndex + 1];
        const nextUrl = `${API_BASE}/api/tts?voice=${encodeURIComponent(voice)}&rate=${this.settings.rate}&pitch=${this.settings.pitch}&text=${encodeURIComponent(nextSentence)}`;
        if (!this.prefetchAudio) {
          this.prefetchAudio = new Audio();
        }
        this.prefetchAudio.src = nextUrl;
        this.prefetchAudio.load();
      }

      return;
    }

    // 2. Local Browser Offline Speech Synthesis
    if (!this.synth) return;

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;

    const voices = this.getVoices();
    if (this.settings.voiceURI) {
      const selectedVoice = voices.find(v => v.voiceURI === this.settings.voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
    } else {
      const viVoice = this.getVietnameseVoices()[0];
      if (viVoice) utterance.voice = viVoice;
    }

    utterance.onend = () => {
      if (this.state === 'playing') {
        this.currentSentenceIndex++;
        this.speakCurrentSentence();
      }
    };

    utterance.onerror = (e) => {
      console.warn('TTS utterance error:', e);
      if (this.state === 'playing') {
        this.currentSentenceIndex++;
        this.speakCurrentSentence();
      }
    };

    this.synth.cancel();
    this.synth.speak(utterance);
  }

  /**
   * Sentence segmentation regex
   */
  private splitIntoSentences(text: string): string[] {
    const rawParagraphs = text.split(/\n+/);
    const result: string[] = [];

    for (const para of rawParagraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const matches = trimmed.match(/[^.!?…\n]+[.!?…]+(?:\s+|$)|[^.!?…\n]+$/g);
      if (matches) {
        for (const m of matches) {
          const s = m.trim();
          if (s) result.push(s);
        }
      } else {
        result.push(trimmed);
      }
    }

    return result.length > 0 ? result : [text];
  }

  /**
   * Sleep Timer Management
   */
  public setSleepTimer(minutes: number | null) {
    if (this.sleepTimerId) {
      window.clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    if (this.sleepCountdownInterval) {
      window.clearInterval(this.sleepCountdownInterval);
      this.sleepCountdownInterval = null;
    }

    if (!minutes || minutes <= 0) {
      this.sleepTimerSeconds = null;
      this.notifyCountdown(null);
      return;
    }

    this.sleepTimerSeconds = minutes * 60;
    this.notifyCountdown(this.sleepTimerSeconds);

    this.sleepCountdownInterval = window.setInterval(() => {
      if (this.sleepTimerSeconds !== null && this.sleepTimerSeconds > 0) {
        this.sleepTimerSeconds--;
        this.notifyCountdown(this.sleepTimerSeconds);
      }
    }, 1000);

    this.sleepTimerId = window.setTimeout(() => {
      this.pause();
      this.setSleepTimer(null);
    }, minutes * 60 * 1000);
  }

  /**
   * MediaSession API for Lockscreen and Headphone / Bluetooth controls
   */
  private updateMediaSessionMetadata() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentChapterTitle || 'Đang nghe truyện',
        artist: this.currentAuthor || 'Chill Reader',
        album: this.currentBookTitle || 'Thư viện truyện',
        artwork: this.currentCoverUrl ? [{ src: this.currentCoverUrl, sizes: '512x512', type: 'image/jpeg' }] : []
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.previousSentence());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSentence());
      navigator.mediaSession.setActionHandler('seekbackward', () => this.previousSentence());
      navigator.mediaSession.setActionHandler('seekforward', () => this.nextSentence());
    } catch (e) {
      console.warn('MediaSession metadata error:', e);
    }
  }

  private updateMediaSessionPlaybackState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = this.state === 'playing' ? 'playing' : (this.state === 'paused' ? 'paused' : 'none');
    } catch {
      // ignore
    }
  }

  public getState(): TTSState {
    return this.state;
  }

  public getCurrentSentenceIndex(): number {
    return this.currentSentenceIndex;
  }

  public getTotalSentences(): number {
    return this.sentences.length;
  }

  public getSentences(): string[] {
    return this.sentences;
  }
}

export const ttsEngine = new TTSEngine();
