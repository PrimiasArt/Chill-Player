import type { TTSSettings, TTSEngineType } from '../../types';
import { getApiBase } from '../apiConfig';

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

const getTtsApiBase = () => getApiBase();

class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private sentences: string[] = [];
  private currentSentenceIndex = 0;
  private state: TTSState = 'idle';
  private listeners: Set<TTSListener> = new Set();
  private sleepTimerId: number | null = null;
  private sleepTimerSeconds: number | null = null;
  private sleepCountdownInterval: number | null = null;

  // Double-buffering audio players for zero-latency gapless playback
  private audioPlayers: [HTMLAudioElement | null, HTMLAudioElement | null] = [null, null];
  private activePlayerIndex: 0 | 1 = 0;
  private testAudio: HTMLAudioElement | null = null;
  private silentAudio: HTMLAudioElement | null = null;

  // Blob cache maps sentence index -> object URL
  private audioBlobCache: Map<number, string> = new Map();
  private fetchingSentences: Set<number> = new Set();

  // Guard against race conditions and obsolete callbacks
  private playbackToken = 0;
  private consecutiveErrors = 0;

  // Metadata for Native Notification & MediaSession
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
      this.setupAudioPlayers();

      // Expose globally for Android WebView Bridge callbacks
      (window as any).ttsEngine = this;
    }
  }

  private setupSilentAudio() {
    // 1-sample silent wav to keep mobile browser audio context and background thread alive
    const silentWavBase64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    this.silentAudio = new Audio(silentWavBase64);
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01;
  }

  private createAudioElement(): HTMLAudioElement {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;
    return audio;
  }

  private setupAudioPlayers() {
    this.audioPlayers = [this.createAudioElement(), this.createAudioElement()];
    this.activePlayerIndex = 0;
  }

  private get activePlayer(): HTMLAudioElement {
    if (!this.audioPlayers[this.activePlayerIndex]) {
      this.audioPlayers[this.activePlayerIndex] = this.createAudioElement();
    }
    return this.audioPlayers[this.activePlayerIndex]!;
  }

  private get nextPlayer(): HTMLAudioElement {
    const nextIdx = this.activePlayerIndex === 0 ? 1 : 0;
    if (!this.audioPlayers[nextIdx]) {
      this.audioPlayers[nextIdx] = this.createAudioElement();
    }
    return this.audioPlayers[nextIdx]!;
  }

  public isOnlineVoice(voiceURI?: string): boolean {
    const v = voiceURI !== undefined ? voiceURI : this.settings.voiceURI;
    if (!v) return true;
    return v.startsWith('edge:') || v.startsWith('google:') || v.startsWith('vi-VN-');
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public getVietnameseVoices(): SpeechSynthesisVoice[] {
    const all = this.getVoices();
    const vi = all.filter(v => 
      v.lang.toLowerCase().startsWith('vi') || 
      v.name.toLowerCase().includes('vietnam') || 
      v.name.toLowerCase().includes('tiếng việt')
    );
    return vi.length > 0 ? vi : all;
  }

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

  public async testVoice(
    voiceURI: string, 
    sampleText = 'Xin chào, bạn đang nghe thử giọng đọc trên ứng dụng Chill Reader.'
  ): Promise<void> {
    if (this.testAudio) {
      this.testAudio.pause();
      this.testAudio.src = '';
      this.testAudio = null;
    }
    if (this.synth) {
      if (this.currentUtterance) {
        this.currentUtterance.onend = null;
        this.currentUtterance.onerror = null;
      }
      this.synth.cancel();
    }

    if (this.isOnlineVoice(voiceURI)) {
      const url = `${getTtsApiBase()}/api/tts?voice=${encodeURIComponent(voiceURI)}&rate=${this.settings.rate}&pitch=${this.settings.pitch}&text=${encodeURIComponent(sampleText)}`;
      this.testAudio = new Audio(url);
      await this.testAudio.play();
    } else {
      if (!this.synth) return;
      const utterance = new SpeechSynthesisUtterance(sampleText);
      this.currentUtterance = utterance;
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      const voice = this.getVoices().find(v => v.voiceURI === voiceURI);
      if (voice) utterance.voice = voice;
      this.synth.speak(utterance);
    }
  }

  public updateSettings(newSettings: Partial<TTSSettings>) {
    const oldVoice = this.settings.voiceURI;
    const oldRate = this.settings.rate;
    const oldPitch = this.settings.pitch;

    this.settings = { ...this.settings, ...newSettings };

    // If voice, rate, or pitch changed, clear prefetched blob audio cache
    if (newSettings.voiceURI !== oldVoice || newSettings.rate !== oldRate || newSettings.pitch !== oldPitch) {
      this.clearAudioBlobCache();
    }

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
    this.updateNativeNotification(state === 'playing');
  }

  private notifySentence(index: number, text: string) {
    this.currentSentenceIndex = index;
    this.listeners.forEach(l => l.onSentenceChange?.(index, text));
  }

  private notifyCountdown(seconds: number | null) {
    this.listeners.forEach(l => l.onTimeRemainingUpdate?.(seconds));
  }

  private clearAudioBlobCache() {
    this.audioBlobCache.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    this.audioBlobCache.clear();
    this.fetchingSentences.clear();
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
    this.clearAudioBlobCache();

    this.currentBookTitle = metadata.title;
    this.currentAuthor = metadata.author;
    this.currentChapterTitle = metadata.chapterTitle;
    this.currentCoverUrl = metadata.coverUrl || '';

    this.sentences = this.splitIntoSentences(content);
    this.currentSentenceIndex = Math.max(0, Math.min(startFromSentenceIndex, Math.max(0, this.sentences.length - 1)));
    this.updateMediaSessionMetadata();
    this.updateNativeNotification(false);
  }

  public play() {
    if (this.sentences.length === 0) return;

    if (this.state === 'paused') {
      if (this.isOnlineVoice() && this.activePlayer && this.activePlayer.src) {
        this.activePlayer.play().catch(() => {});
      } else if (this.synth) {
        this.synth.resume();
      }
      this.silentAudio?.play().catch(() => {});
      this.notifyState('playing');
      return;
    }

    this.consecutiveErrors = 0;
    this.silentAudio?.play().catch(() => {});
    this.notifyState('playing');
    this.speakCurrentSentence();
  }

  public pause() {
    this.playbackToken++; // Invalidate pending async transitions
    if (this.isOnlineVoice()) {
      if (this.audioPlayers[0]) this.audioPlayers[0].pause();
      if (this.audioPlayers[1]) this.audioPlayers[1].pause();
    } else if (this.synth) {
      this.synth.pause();
    }
    this.silentAudio?.pause();
    this.notifyState('paused');
  }

  public stop() {
    this.playbackToken++; // Invalidate pending async transitions
    if (this.audioPlayers[0]) {
      this.audioPlayers[0].onended = null;
      this.audioPlayers[0].onerror = null;
      this.audioPlayers[0].pause();
      this.audioPlayers[0].src = '';
    }
    if (this.audioPlayers[1]) {
      this.audioPlayers[1].onended = null;
      this.audioPlayers[1].onerror = null;
      this.audioPlayers[1].pause();
      this.audioPlayers[1].src = '';
    }
    if (this.synth) {
      if (this.currentUtterance) {
        this.currentUtterance.onend = null;
        this.currentUtterance.onerror = null;
      }
      this.synth.cancel();
    }
    this.silentAudio?.pause();
    this.notifyState('idle');
    this.clearNativeNotification();
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
    this.playbackToken++;

    if (this.audioPlayers[0]) {
      this.audioPlayers[0].pause();
      this.audioPlayers[0].onended = null;
      this.audioPlayers[0].onerror = null;
      this.audioPlayers[0].src = '';
    }
    if (this.audioPlayers[1]) {
      this.audioPlayers[1].pause();
      this.audioPlayers[1].onended = null;
      this.audioPlayers[1].onerror = null;
      this.audioPlayers[1].src = '';
    }

    this.currentSentenceIndex = index;
    if (wasPlaying) {
      this.notifySentence(index, this.sentences[index]);
      this.speakCurrentSentence();
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
    } else {
      // Reached the end of the chapter
      this.stop();
      this.listeners.forEach(l => l.onChapterComplete?.());
    }
  }

  private getAudioUrl(sentenceText: string): string {
    const voice = this.settings.voiceURI || 'edge:vi-VN-NamMinhNeural';
    return `${getTtsApiBase()}/api/tts?voice=${encodeURIComponent(voice)}&rate=${this.settings.rate}&pitch=${this.settings.pitch}&text=${encodeURIComponent(sentenceText)}`;
  }

  /**
   * Fetch audio blob for a sentence and return its object URL
   */
  private async fetchSentenceBlob(index: number): Promise<string | null> {
    if (index < 0 || index >= this.sentences.length) return null;
    if (this.audioBlobCache.has(index)) return this.audioBlobCache.get(index)!;
    if (this.fetchingSentences.has(index)) return null;

    this.fetchingSentences.add(index);
    const text = this.sentences[index];
    const url = this.getAudioUrl(text);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.audioBlobCache.set(index, objectUrl);
      return objectUrl;
    } catch (err) {
      return null;
    } finally {
      this.fetchingSentences.delete(index);
    }
  }

  /**
   * Prefetch audio blob in the background
   */
  private prefetchSentenceAudio(index: number) {
    if (index < 0 || index >= this.sentences.length) return;
    if (this.audioBlobCache.has(index) || this.fetchingSentences.has(index)) return;
    this.fetchSentenceBlob(index);
  }

  /**
   * Pre-load the next sentence into the secondary audio player for instant gapless handover
   */
  private prepareNextSentenceAudio(nextIdx: number, currentToken: number) {
    if (nextIdx >= this.sentences.length) return;

    const setupNext = (blobOrUrl: string) => {
      if (currentToken !== this.playbackToken || this.state !== 'playing') return;
      const nextP = this.nextPlayer;
      nextP.onended = null;
      nextP.onerror = null;
      // Only set if different to prevent reloading
      if (nextP.src !== blobOrUrl) {
        nextP.src = blobOrUrl;
        nextP.preload = 'auto';
        nextP.load();
      }
    };

    if (this.audioBlobCache.has(nextIdx)) {
      setupNext(this.audioBlobCache.get(nextIdx)!);
    } else {
      this.fetchSentenceBlob(nextIdx).then((blobUrl) => {
        if (blobUrl) {
          setupNext(blobUrl);
        } else {
          // Fallback to direct URL preloading
          setupNext(this.getAudioUrl(this.sentences[nextIdx]));
        }
      });
    }
  }

  private speakCurrentSentence() {
    if (this.state !== 'playing') return;

    // Check if we reached the end of the chapter
    if (this.currentSentenceIndex >= this.sentences.length) {
      this.stop();
      this.clearAudioBlobCache();
      this.listeners.forEach(l => l.onChapterComplete?.());
      return;
    }

    const currentToken = ++this.playbackToken;
    const sentenceIdx = this.currentSentenceIndex;
    const sentence = this.sentences[sentenceIdx];
    this.notifySentence(sentenceIdx, sentence);
    this.updateNativeNotification(true);

    // 1. Online AI Neural / Google TTS playback with gapless double buffering
    if (this.isOnlineVoice()) {
      if (this.synth) {
        if (this.currentUtterance) {
          this.currentUtterance.onend = null;
          this.currentUtterance.onerror = null;
        }
        this.synth.cancel();
      }

      const player = this.activePlayer;
      player.onended = null;
      player.onerror = null;

      // Handle when audio finishes playing: immediate gapless switch to next player
      player.onended = () => {
        if (currentToken !== this.playbackToken || this.state !== 'playing') return;
        this.consecutiveErrors = 0;
        this.activePlayerIndex = this.activePlayerIndex === 0 ? 1 : 0;
        this.currentSentenceIndex++;
        this.speakCurrentSentence();
      };

      // Handle playback error: retry or skip cleanly without getting stuck
      player.onerror = (e) => {
        if (currentToken !== this.playbackToken || this.state !== 'playing') return;
        console.warn('Audio player error on sentence:', sentenceIdx, e);
        this.consecutiveErrors++;
        if (this.consecutiveErrors < 3) {
          setTimeout(() => {
            if (currentToken === this.playbackToken && this.state === 'playing') {
              this.activePlayerIndex = this.activePlayerIndex === 0 ? 1 : 0;
              this.currentSentenceIndex++;
              this.speakCurrentSentence();
            }
          }, 200);
        } else {
          console.warn('Falling back to local SpeechSynthesis due to repeated errors');
          this.playBrowserTTS(sentence, currentToken);
        }
      };

      // Check if current player already has the right audio loaded
      const cachedBlob = this.audioBlobCache.get(sentenceIdx);
      if (cachedBlob && player.src !== cachedBlob) {
        player.src = cachedBlob;
      } else if (!cachedBlob && (!player.src || !player.src.includes(encodeURIComponent(sentence.slice(0, 20))))) {
        player.src = this.getAudioUrl(sentence);
      }

      player.play().catch(err => {
        if (currentToken !== this.playbackToken || this.state !== 'playing') return;
        console.warn('Play error:', err);
        player.onerror?.(new Event('error'));
      });

      // Prepare next player and prefetch upcoming window (4 sentences ahead)
      this.prepareNextSentenceAudio(sentenceIdx + 1, currentToken);
      this.prefetchSentenceAudio(sentenceIdx + 2);
      this.prefetchSentenceAudio(sentenceIdx + 3);
      this.prefetchSentenceAudio(sentenceIdx + 4);

      // Clean up older blobs to keep memory lean
      for (const key of this.audioBlobCache.keys()) {
        if (key < sentenceIdx - 2 || key > sentenceIdx + 8) {
          try {
            URL.revokeObjectURL(this.audioBlobCache.get(key)!);
          } catch {}
          this.audioBlobCache.delete(key);
        }
      }

      return;
    }

    // 2. Local Browser Offline Speech Synthesis
    this.playBrowserTTS(sentence, currentToken);
  }

  private playBrowserTTS(sentence: string, currentToken: number) {
    if (!this.synth) return;

    if (this.currentUtterance) {
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
    }
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(sentence);
    this.currentUtterance = utterance;
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
      if (currentToken !== this.playbackToken || this.state !== 'playing') return;
      this.consecutiveErrors = 0;
      this.currentSentenceIndex++;
      this.speakCurrentSentence();
    };

    utterance.onerror = (e) => {
      if (currentToken !== this.playbackToken || this.state !== 'playing') return;
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('SpeechSynthesis error:', e);
      this.currentSentenceIndex++;
      this.speakCurrentSentence();
    };

    this.synth.speak(utterance);
  }

  /**
   * Smart sentence segmentation and merging:
   * Merges short fragments (< 35 chars) or dialogue indicators (':', '-', '"')
   * into full, natural conversational sentences so TTS playback flows seamlessly
   * without awkward pauses or excessive API requests.
   */
  public splitIntoSentences(text: string): string[] {
    if (!text) return [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawParagraphs = normalized.split(/\n+/);
    const result: string[] = [];

    for (const para of rawParagraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Extract raw sentence segments based on standard sentence delimiters
      const rawMatches = trimmed.match(/[^.!?…\n]+(?:[.!?…]+|(?=$))/g);
      if (!rawMatches || rawMatches.length === 0) {
        if (/[a-zA-Z0-9\u00C0-\u1EF9]/.test(trimmed)) {
          result.push(trimmed);
        }
        continue;
      }

      const paraSentences: string[] = [];
      for (const m of rawMatches) {
        const s = m.trim();
        // Skip purely punctuation segments like "...", "---", "***"
        if (s && /[a-zA-Z0-9\u00C0-\u1EF9]/.test(s)) {
          paraSentences.push(s);
        }
      }

      if (paraSentences.length === 0) continue;

      // Merge short fragments (< 35 chars) or dialogue indicators (ending in :, -, “)
      const merged: string[] = [];
      for (let i = 0; i < paraSentences.length; i++) {
        let current = paraSentences[i];

        while (i + 1 < paraSentences.length) {
          const next = paraSentences[i + 1];
          const shouldMerge =
            current.length < 35 ||
            /[:;、“"'\-–—]$/.test(current) ||
            /^[a-z\u00E0-\u1EF9]/.test(next) || // next starts with lowercase letter
            current.split(/\s+/).length <= 4;

          if (shouldMerge && (current.length + next.length + 1 <= 260)) {
            current = `${current} ${next}`;
            i++;
          } else {
            break;
          }
        }
        merged.push(current);
      }

      result.push(...merged);
    }

    return result.length > 0 ? result : [text.trim()].filter(Boolean);
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
   * Native Android Media Notification Integration
   * Communicates with MainActivity.java via JavascriptInterface 'AndroidMedia'
   */
  private updateNativeNotification(isPlaying: boolean) {
    try {
      const androidMedia = (window as any).AndroidMedia;
      if (androidMedia && typeof androidMedia.updateMedia === 'function') {
        androidMedia.updateMedia(
          this.currentChapterTitle || 'Đang nghe truyện',
          this.currentBookTitle || 'Chill Reader',
          this.currentAuthor || '',
          isPlaying
        );
      }
    } catch (e) {
      console.warn('Native AndroidMedia update error:', e);
    }
  }

  private clearNativeNotification() {
    try {
      const androidMedia = (window as any).AndroidMedia;
      if (androidMedia && typeof androidMedia.clearMedia === 'function') {
        androidMedia.clearMedia();
      }
    } catch (e) {
      console.warn('Native AndroidMedia clear error:', e);
    }
  }

  /**
   * MediaSession API for Headphone / Bluetooth and Web lockscreen controls
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

if (typeof window !== 'undefined') {
  (window as any).ttsEngine = ttsEngine;
}
