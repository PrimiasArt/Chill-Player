import type { TTSSettings } from '../../types';

export type TTSState = 'idle' | 'playing' | 'paused';

export interface TTSListener {
  onStateChange?: (state: TTSState) => void;
  onSentenceChange?: (sentenceIndex: number, sentenceText: string) => void;
  onChapterComplete?: () => void;
  onTimeRemainingUpdate?: (secondsLeft: number | null) => void;
}

class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private sentences: string[] = [];
  private currentSentenceIndex = 0;
  private state: TTSState = 'idle';
  private listeners: Set<TTSListener> = new Set();
  private sleepTimerId: number | null = null;
  private sleepTimerSeconds: number | null = null;
  private sleepCountdownInterval: number | null = null;

  // Silent audio player to keep mobile browser audio context alive in the background
  private silentAudio: HTMLAudioElement | null = null;

  // Metadata for MediaSession
  private currentBookTitle = '';
  private currentAuthor = '';
  private currentChapterTitle = '';
  private currentCoverUrl = '';

  private settings: TTSSettings = {
    voiceURI: '',
    rate: 1.0,
    pitch: 1.0,
    sleepTimerMinutes: null,
    highlightSentence: true,
    autoNextChapter: true
  };

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.setupSilentAudio();
    }
  }

  private setupSilentAudio() {
    // Generates a minimal 1-second silent WAV base64
    const silentWavBase64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    this.silentAudio = new Audio(silentWavBase64);
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01;
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

  public updateSettings(newSettings: Partial<TTSSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.sleepTimerMinutes !== undefined) {
      this.setSleepTimer(newSettings.sleepTimerMinutes);
    }
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

    // Split text into natural sentences for speech synthesis
    this.sentences = this.splitIntoSentences(content);
    this.currentSentenceIndex = Math.max(0, Math.min(startFromSentenceIndex, this.sentences.length - 1));
    this.updateMediaSessionMetadata();
  }

  public play() {
    if (!this.synth || this.sentences.length === 0) return;

    if (this.state === 'paused') {
      this.synth.resume();
      this.silentAudio?.play().catch(() => {});
      this.notifyState('playing');
      return;
    }

    // Start background silent audio to prevent mobile OS sleep
    this.silentAudio?.play().catch(() => {});
    this.notifyState('playing');
    this.speakCurrentSentence();
  }

  public pause() {
    if (!this.synth) return;
    this.synth.pause();
    this.silentAudio?.pause();
    this.notifyState('paused');
  }

  public stop() {
    if (!this.synth) return;
    this.synth.cancel();
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
    if (!this.synth || this.state !== 'playing') return;

    if (this.currentSentenceIndex >= this.sentences.length) {
      // Finished reading chapter
      this.stop();
      this.listeners.forEach(l => l.onChapterComplete?.());
      return;
    }

    const sentence = this.sentences[this.currentSentenceIndex];
    this.notifySentence(this.currentSentenceIndex, sentence);

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;

    // Pick selected or best matching Vietnamese voice
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

    this.synth.cancel(); // Flush queue
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

      // Split by punctuation: . ! ? ... or semicolon followed by space
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
