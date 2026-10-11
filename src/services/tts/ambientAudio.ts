export type AmbientSoundType = 'off' | 'rain' | 'campfire' | 'wind' | 'stream';

export interface AmbientSoundOption {
  id: AmbientSoundType;
  name: string;
  icon: string;
  description: string;
}

export const AMBIENT_SOUND_OPTIONS: AmbientSoundOption[] = [
  { id: 'off', name: 'Tắt âm nền', icon: 'VolumeX', description: 'Chỉ nghe giọng đọc truyện' },
  { id: 'rain', name: 'Mưa đêm', icon: 'CloudRain', description: 'Tiếng mưa rơi êm dịu trên mái ngói' },
  { id: 'campfire', name: 'Lửa trại', icon: 'Flame', description: 'Tiếng củi tí tách, ấm áp đêm khuya' },
  { id: 'wind', name: 'Gió rừng trúc', icon: 'Wind', description: 'Tiếng gió thoảng qua rặng tre trúc kiếm hiệp' },
  { id: 'stream', name: 'Suối nước', icon: 'Waves', description: 'Tiếng suối róc rách, thiên nhiên thư thái' }
];

class AmbientAudioService {
  private audioCtx: AudioContext | null = null;
  private currentType: AmbientSoundType = 'off';
  private volume: number = 0.25; // 0.0 to 1.0
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];
  private isRunning = false;

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public getType(): AmbientSoundType {
    return this.currentType;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  public setSound(type: AmbientSoundType) {
    this.currentType = type;
    this.stop();
    if (type !== 'off') {
      this.start(type);
    }
  }

  private stop() {
    this.isRunning = false;
    for (const item of this.activeNodes) {
      if (typeof item === 'number') {
        window.clearInterval(item);
      } else {
        try {
          if ('stop' in item && typeof (item as any).stop === 'function') {
            (item as any).stop();
          }
          item.disconnect();
        } catch {}
      }
    }
    this.activeNodes = [];
  }

  private start(type: AmbientSoundType) {
    try {
      this.initContext();
      if (!this.audioCtx) return;

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
      this.activeNodes.push(this.masterGain);
      this.isRunning = true;

      switch (type) {
        case 'rain':
          this.createRainSound();
          break;
        case 'campfire':
          this.createCampfireSound();
          break;
        case 'wind':
          this.createWindSound();
          break;
        case 'stream':
          this.createStreamSound();
          break;
      }
    } catch (e) {
      console.warn('Ambient audio error:', e);
    }
  }

  // --- Rain Sound: Pink noise with soft low-pass filter ---
  private createRainSound() {
    if (!this.audioCtx || !this.masterGain) return;
    const bufferSize = this.audioCtx.sampleRate * 2;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start();

    this.activeNodes.push(whiteNoise, filter);
  }

  // --- Wind Sound: Bandpass filtered noise with LFO modulation ---
  private createWindSound() {
    if (!this.audioCtx || !this.masterGain) return;
    const bufferSize = this.audioCtx.sampleRate * 2;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.08;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, this.audioCtx.currentTime);
    filter.Q.setValueAtTime(3.0, this.audioCtx.currentTime);

    // LFO to modulate wind gusts
    const lfo = this.audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, this.audioCtx.currentTime); // slow wave
    const lfoGain = this.audioCtx.createGain();
    lfoGain.gain.setValueAtTime(250, this.audioCtx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();

    this.activeNodes.push(noise, filter, lfo, lfoGain);
  }

  // --- Campfire Sound: Low rumble + crackle pops ---
  private createCampfireSound() {
    if (!this.audioCtx || !this.masterGain) return;
    // 1. Soft fire rumble
    this.createRainSound();

    // 2. Crackling pops
    const intervalId = window.setInterval(() => {
      if (!this.audioCtx || !this.masterGain || !this.isRunning) return;
      if (Math.random() > 0.4) {
        try {
          const popOsc = this.audioCtx.createOscillator();
          const popGain = this.audioCtx.createGain();
          popOsc.type = 'triangle';
          popOsc.frequency.setValueAtTime(150 + Math.random() * 400, this.audioCtx.currentTime);

          popGain.gain.setValueAtTime(0.08 + Math.random() * 0.07, this.audioCtx.currentTime);
          popGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.04);

          popOsc.connect(popGain);
          popGain.connect(this.masterGain);
          popOsc.start();
          popOsc.stop(this.audioCtx.currentTime + 0.05);
        } catch {}
      }
    }, 120);

    this.activeNodes.push(intervalId);
  }

  // --- Stream Sound: Water flow bubbling ---
  private createStreamSound() {
    if (!this.audioCtx || !this.masterGain) return;
    const bufferSize = this.audioCtx.sampleRate * 2;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.06;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, this.audioCtx.currentTime);
    filter.Q.setValueAtTime(1.5, this.audioCtx.currentTime);

    // Subtle gentle ripples
    const lfo = this.audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.7, this.audioCtx.currentTime);
    const lfoGain = this.audioCtx.createGain();
    lfoGain.gain.setValueAtTime(150, this.audioCtx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();

    this.activeNodes.push(noise, filter, lfo, lfoGain);
  }
}

export const ambientAudioService = new AmbientAudioService();
