import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Lock, 
  Unlock, 
  Sun, 
  Sliders, 
  Subtitles, 
  PictureInPicture, 
  Moon, 
  ChevronLeft, 
  Gauge, 
  Sparkles,
  Zap,
  Layers,
  Settings
} from 'lucide-react';
import Hls from 'hls.js';
import type { MediaItem, PlayerSettings, AspectRatioMode, SubtitleCue } from '../types';
import { parseSubtitles, getActiveSubtitleText } from '../services/subtitles';
import { db } from '../services/db';

interface VideoPlayerProps {
  media: MediaItem;
  onBack: () => void;
  onNextMedia?: () => void;
  onPrevMedia?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  media,
  onBack,
  onNextMedia,
  onPrevMedia
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Audio Context for 200% Audio Boost & Equalizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const audioSourceConnected = useRef(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(media.currentTime || 0);
  const [duration, setDuration] = useState(media.duration || 0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Gesture indicators
  const [gestureType, setGestureType] = useState<'none' | 'volume' | 'brightness' | 'seek'>('none');
  const [gestureValue, setGestureValue] = useState<number>(0);
  const [seekOffset, setSeekOffset] = useState<number>(0);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  // Subtitles
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);

  // Modals & Drawers
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showEqualizerMenu, setShowEqualizerMenu] = useState(false);
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);

  // Player settings
  const [settings, setSettings] = useState<PlayerSettings>({
    aspectRatio: 'fit',
    playbackRate: 1.0,
    volume: 1.0, // 0.0 - 2.0 (Audio Boost up to 200%)
    brightness: 1.0,
    equalizer: 'flat',
    subtitleSize: 22,
    subtitleColor: '#ffffff',
    subtitleOffsetMs: 0,
    autoPlayNext: true,
    sleepTimerMinutes: null,
    backgroundAudio: true,
    pipEnabled: false
  });

  // Touch tracking for gestures
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const sleepTimerTimeoutRef = useRef<number | null>(null);

  // Format time (hh:mm:ss or mm:ss)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Reset controls hide timer
  const triggerShowControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!isLocked) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isLocked]);

  // Setup Web Audio API for Audio Boost up to 200%
  const initWebAudio = () => {
    if (audioSourceConnected.current || !videoRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(videoRef.current);
      const gain = ctx.createGain();
      gain.gain.value = settings.volume;
      gainNodeRef.current = gain;

      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 250;
      bass.gain.value = settings.equalizer === 'bass' ? 6 : 0;
      bassFilterRef.current = bass;

      source.connect(bass);
      bass.connect(gain);
      gain.connect(ctx.destination);

      audioSourceConnected.current = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  };

  // Video Source & HLS initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = media.url.includes('.m3u8') || media.format === 'm3u8';

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        });
        hlsRef.current = hls;
        hls.loadSource(media.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (media.currentTime > 0) {
            video.currentTime = media.currentTime;
          }
          video.play().catch(() => {});
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = media.url;
        if (media.currentTime > 0) {
          video.currentTime = media.currentTime;
        }
        video.play().catch(() => {});
      }
    } else {
      video.src = media.url;
      if (media.currentTime > 0) {
        video.currentTime = media.currentTime;
      }
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [media.url]);

  // Load Subtitles if provided
  useEffect(() => {
    if (media.subtitleUrl) {
      fetch(media.subtitleUrl)
        .then(res => res.text())
        .then(txt => {
          const parsed = parseSubtitles(txt);
          setSubtitleCues(parsed);
        })
        .catch(() => {});
    }
  }, [media.subtitleUrl]);

  // Sleep Timer
  useEffect(() => {
    if (sleepTimerTimeoutRef.current) {
      clearTimeout(sleepTimerTimeoutRef.current);
      sleepTimerTimeoutRef.current = null;
    }

    if (settings.sleepTimerMinutes && settings.sleepTimerMinutes > 0) {
      sleepTimerTimeoutRef.current = window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
        setSettings(prev => ({ ...prev, sleepTimerMinutes: null }));
      }, settings.sleepTimerMinutes * 60 * 1000);
    }

    return () => {
      if (sleepTimerTimeoutRef.current) {
        clearTimeout(sleepTimerTimeoutRef.current);
      }
    };
  }, [settings.sleepTimerMinutes]);

  // Update Progress in Database periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoRef.current && duration > 0) {
        const time = videoRef.current.currentTime;
        const progress = Math.min(100, Math.round((time / duration) * 100));
        await db.mediaItems.update(media.id, {
          currentTime: time,
          duration,
          progressPercent: progress,
          lastPlayedAt: Date.now()
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [media.id, duration]);

  // Apply Volume & Audio Boost
  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(2.0, newVol));
    setSettings(prev => ({ ...prev, volume: clamped }));

    if (clamped > 1.0) {
      initWebAudio();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = clamped;
      }
      if (videoRef.current) {
        videoRef.current.volume = 1.0;
      }
    } else {
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = clamped;
      }
      if (videoRef.current) {
        videoRef.current.volume = clamped;
      }
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    initWebAudio();
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    triggerShowControls();
  };

  // Seek by seconds
  const seekRelative = (deltaSecs: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaSecs));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    triggerShowControls();
  };

  // Touch gesture handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isLocked) return;
    touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    touchCurrentRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isLocked || !touchStartRef.current) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Minimum movement threshold
    if (absX < 15 && absY < 15) return;

    if (absY > absX) {
      // Vertical gesture
      const isLeft = touchStartRef.current.x < rect.width / 2;
      const deltaPercent = -(dy / (rect.height * 0.7));

      if (isLeft) {
        // Brightness control
        setGestureType('brightness');
        const newBright = Math.max(0.1, Math.min(1.0, settings.brightness + deltaPercent * 0.05));
        setSettings(prev => ({ ...prev, brightness: newBright }));
        setGestureValue(Math.round(newBright * 100));
      } else {
        // Volume control (up to 200%)
        setGestureType('volume');
        const newVol = Math.max(0, Math.min(2.0, settings.volume + deltaPercent * 0.08));
        handleVolumeChange(newVol);
        setGestureValue(Math.round(newVol * 100));
      }
    } else {
      // Horizontal seek gesture
      setGestureType('seek');
      const seekSecs = Math.round((dx / rect.width) * 90); // +/- 90 seconds max
      setSeekOffset(seekSecs);
    }
  };

  const handlePointerUp = () => {
    if (isLocked) {
      triggerShowControls();
      return;
    }

    if (gestureType === 'seek' && seekOffset !== 0) {
      seekRelative(seekOffset);
    }

    setGestureType('none');
    setSeekOffset(0);

    // Double tap detection
    const now = Date.now();
    if (touchStartRef.current) {
      const { x, time } = touchStartRef.current;
      const rect = containerRef.current?.getBoundingClientRect();

      if (lastTapRef.current && now - lastTapRef.current.time < 300) {
        // Double tap!
        if (rect) {
          if (x < rect.width * 0.35) {
            seekRelative(-10);
            setDoubleTapFeedback('left');
            setTimeout(() => setDoubleTapFeedback(null), 600);
          } else if (x > rect.width * 0.65) {
            seekRelative(10);
            setDoubleTapFeedback('right');
            setTimeout(() => setDoubleTapFeedback(null), 600);
          } else {
            togglePlay();
          }
        }
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { time: now, x };
        triggerShowControls();
      }
    }

    touchStartRef.current = null;
    touchCurrentRef.current = null;
  };

  // Picture-in-Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setSettings(prev => ({ ...prev, pipEnabled: false }));
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setSettings(prev => ({ ...prev, pipEnabled: true }));
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  // Aspect ratio class helper
  const getAspectRatioStyle = (): React.CSSProperties => {
    switch (settings.aspectRatio) {
      case 'fill':
        return { objectFit: 'cover', width: '100%', height: '100%' };
      case 'stretch':
        return { objectFit: 'fill', width: '100%', height: '100%' };
      case '16:9':
        return { objectFit: 'contain', aspectRatio: '16/9', width: '100%' };
      case '4:3':
        return { objectFit: 'contain', aspectRatio: '4/3', width: '100%' };
      case 'original':
        return { objectFit: 'none' };
      case 'fit':
      default:
        return { objectFit: 'contain', width: '100%', height: '100%' };
    }
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-screen h-screen bg-black overflow-hidden select-none touch-none flex items-center justify-center"
      style={{ filter: `brightness(${settings.brightness})` }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        webkit-playsinline="true"
        style={getAspectRatioStyle()}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const cur = videoRef.current.currentTime;
            setCurrentTime(cur);
            if (subtitleCues.length > 0) {
              setActiveSubtitle(getActiveSubtitleText(subtitleCues, cur, settings.subtitleOffsetMs));
            }
          }
        }}
        onDurationChange={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (settings.autoPlayNext && onNextMedia) {
            onNextMedia();
          }
        }}
        className="max-w-full max-h-full transition-all duration-150"
      />

      {/* Subtitles Overlay */}
      {activeSubtitle && (
        <div className="absolute bottom-20 left-4 right-4 text-center pointer-events-none z-30 transition-all">
          <span 
            className="px-3 py-1.5 rounded-lg bg-black/75 shadow-lg inline-block font-semibold leading-relaxed"
            style={{ 
              fontSize: `${settings.subtitleSize}px`,
              color: settings.subtitleColor,
              textShadow: '0 2px 4px rgba(0,0,0,0.8)'
            }}
          >
            {activeSubtitle}
          </span>
        </div>
      )}

      {/* Gesture Feedback HUDs - visionOS Floating Glass */}
      {gestureType === 'volume' && (
        <div className="absolute top-1/2 right-10 -translate-y-1/2 p-4.5 rounded-3xl vision-capsule border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-3 z-40 animate-in fade-in zoom-in-95 duration-100">
          <Volume2 className="w-7 h-7 text-emerald-400" />
          <div className="w-2.5 h-36 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
            <div 
              className={`w-full rounded-full transition-all ${gestureValue > 100 ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]' : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'}`}
              style={{ height: `${Math.min(100, (gestureValue / 200) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-white font-mono">
            {gestureValue}% {gestureValue > 100 && <span className="text-amber-400 text-[9px] block text-center font-bold">BOOST</span>}
          </span>
        </div>
      )}

      {gestureType === 'brightness' && (
        <div className="absolute top-1/2 left-10 -translate-y-1/2 p-4.5 rounded-3xl vision-capsule border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-3 z-40 animate-in fade-in zoom-in-95 duration-100">
          <Sun className="w-7 h-7 text-amber-400" />
          <div className="w-2.5 h-36 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
            <div 
              className="w-full bg-amber-400 rounded-full transition-all shadow-[0_0_12px_rgba(251,191,36,0.8)]"
              style={{ height: `${gestureValue}%` }}
            />
          </div>
          <span className="text-xs font-bold text-white font-mono">{gestureValue}%</span>
        </div>
      )}

      {gestureType === 'seek' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-7 py-4.5 rounded-3xl vision-capsule border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2 z-40 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
            {seekOffset >= 0 ? <RotateCw className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            <span>{seekOffset >= 0 ? `+${seekOffset}s` : `${seekOffset}s`}</span>
          </div>
          <span className="text-xs text-zinc-300 font-mono">
            {formatTime(currentTime + seekOffset)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Double Tap Ripple Animations */}
      {doubleTapFeedback === 'left' && (
        <div className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-emerald-400 vision-capsule p-5 rounded-full animate-ping pointer-events-none">
          <RotateCcw className="w-9 h-9" />
          <span className="text-xs font-bold">-10s</span>
        </div>
      )}
      {doubleTapFeedback === 'right' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-emerald-400 vision-capsule p-5 rounded-full animate-ping pointer-events-none">
          <RotateCw className="w-9 h-9" />
          <span className="text-xs font-bold">+10s</span>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin shadow-[0_0_20px_rgba(52,211,153,0.4)]" />
        </div>
      )}

      {/* Lock Button - visionOS Circular Glass */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsLocked(!isLocked);
          triggerShowControls();
        }}
        className={`absolute top-6 left-6 z-50 p-3 rounded-full transition-all cursor-pointer ${
          isLocked 
            ? 'bg-amber-400 text-zinc-950 shadow-[0_0_25px_rgba(251,191,36,0.6)] scale-105' 
            : showControls 
              ? 'vision-btn-circle text-zinc-200 hover:text-white' 
              : 'opacity-0 pointer-events-none'
        }`}
        title={isLocked ? 'Mở khóa màn hình' : 'Khóa cử chỉ màn hình'}
      >
        {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
      </button>

      {/* Controls Overlay */}
      {showControls && !isLocked && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 bg-gradient-to-t from-black/85 via-transparent to-black/85 flex flex-col justify-between p-4 md:p-6 transition-opacity duration-200"
        >
          {/* Top Bar - visionOS Floating Glass Capsule */}
          <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4 p-2 px-4 rounded-full vision-capsule shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/20">
            <div className="flex items-center gap-3 min-w-0">
              <button 
                onClick={onBack}
                className="w-8 h-8 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                title="Quay lại thư viện"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-white truncate max-w-xs md:max-w-md">
                  {media.title}
                </h2>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                  <span className="uppercase px-1.5 py-0.2 rounded-full vision-glass font-sans font-bold text-emerald-400 text-[9px]">
                    {media.format || 'VIDEO'}
                  </span>
                  {media.type === 'stream' && (
                    <span className="text-emerald-400 flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowAspectMenu(!showAspectMenu)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  showAspectMenu ? 'bg-emerald-500 text-zinc-950 font-bold' : 'vision-btn-circle text-zinc-300 hover:text-white'
                }`}
                title="Tỉ lệ khung hình"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="uppercase hidden sm:inline">{settings.aspectRatio}</span>
              </button>

              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  showSpeedMenu ? 'bg-emerald-500 text-zinc-950 font-bold' : 'vision-btn-circle text-zinc-300 hover:text-white'
                }`}
                title="Tốc độ phát"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{settings.playbackRate}x</span>
              </button>

              <button
                onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  showSubtitleMenu ? 'bg-emerald-500 text-zinc-950 font-bold' : 'vision-btn-circle text-zinc-300 hover:text-white'
                }`}
                title="Phụ đề"
              >
                <Subtitles className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowEqualizerMenu(!showEqualizerMenu)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  showEqualizerMenu ? 'bg-emerald-500 text-zinc-950 font-bold' : 'vision-btn-circle text-zinc-300 hover:text-white'
                }`}
                title="Equalizer & Âm thanh"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePiP}
                className="w-8 h-8 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Picture-in-Picture (Thu nhỏ)"
              >
                <PictureInPicture className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center Play / Pause & Skip Buttons - visionOS Style */}
          <div className="flex items-center justify-center gap-7 self-center">
            {onPrevMedia && (
              <button 
                onClick={onPrevMedia}
                className="w-12 h-12 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => seekRelative(-10)}
              className="w-13 h-13 rounded-full vision-btn-circle text-zinc-200 hover:text-white flex flex-col items-center justify-center cursor-pointer active:scale-95"
              title="Lùi 10 giây"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">-10s</span>
            </button>

            <button
              onClick={togglePlay}
              className="w-18 h-18 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_35px_rgba(16,185,129,0.5)] flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="w-13 h-13 rounded-full vision-btn-circle text-zinc-200 hover:text-white flex flex-col items-center justify-center cursor-pointer active:scale-95"
              title="Tới 10 giây"
            >
              <RotateCw className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">+10s</span>
            </button>

            {onNextMedia && (
              <button 
                onClick={onNextMedia}
                className="w-12 h-12 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Bottom Bar: visionOS Floating Glass Capsule */}
          <div className="w-full max-w-4xl mx-auto p-4 rounded-3xl vision-capsule shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/20 space-y-2.5">
            {/* Progress Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-zinc-300 min-w-12 text-right">
                {formatTime(currentTime)}
              </span>

              <div className="relative flex-1 group py-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (videoRef.current) {
                      videoRef.current.currentTime = val;
                      setCurrentTime(val);
                    }
                  }}
                  className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-emerald-400 group-hover:h-2 transition-all shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                />
              </div>

              <span className="text-xs font-mono text-zinc-400 min-w-12">
                {formatTime(duration)}
              </span>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleVolumeChange(settings.volume > 0 ? 0 : 1.0)}
                  className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                >
                  {settings.volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  <span className="font-mono">{Math.round(settings.volume * 100)}%</span>
                  {settings.volume > 1.0 && <span className="text-[9px] px-1 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">BOOST</span>}
                </button>

                <button
                  onClick={() => setShowSleepTimerMenu(!showSleepTimerMenu)}
                  className={`flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer ${
                    settings.sleepTimerMinutes ? 'text-amber-400 font-semibold' : ''
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>{settings.sleepTimerMinutes ? `${settings.sleepTimerMinutes}m` : 'Hẹn giờ'}</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      containerRef.current?.requestFullscreen();
                    }
                  }}
                  className="w-8 h-8 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                  title="Toàn màn hình"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aspect Ratio Modal Menu - visionOS Spatial Sheet */}
      {showAspectMenu && (
        <div className="absolute top-20 right-8 z-50 p-2.5 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-44 animate-in fade-in zoom-in-95">
          <div className="text-[11px] font-bold text-zinc-400 px-3 py-1 uppercase tracking-wider font-sans">Tỉ lệ khung hình</div>
          {(['fit', 'fill', 'stretch', '16:9', '4:3', 'original'] as AspectRatioMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setSettings(prev => ({ ...prev, aspectRatio: mode }));
                setShowAspectMenu(false);
              }}
              className={`px-3.5 py-2 rounded-2xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                settings.aspectRatio === mode ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <span className="capitalize">{mode}</span>
              {settings.aspectRatio === mode && <Sparkles className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Speed Modal Menu - visionOS Spatial Sheet */}
      {showSpeedMenu && (
        <div className="absolute top-20 right-20 z-50 p-2.5 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-36 animate-in fade-in zoom-in-95">
          <div className="text-[11px] font-bold text-zinc-400 px-3 py-1 uppercase tracking-wider font-sans">Tốc độ phát</div>
          {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((rate) => (
            <button
              key={rate}
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.playbackRate = rate;
                }
                setSettings(prev => ({ ...prev, playbackRate: rate }));
                setShowSpeedMenu(false);
              }}
              className={`px-3.5 py-2 rounded-2xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                settings.playbackRate === rate ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <span>{rate}x</span>
              {settings.playbackRate === rate && <Sparkles className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Subtitles Menu - visionOS Spatial Sheet */}
      {showSubtitleMenu && (
        <div className="absolute top-20 right-32 z-50 p-5 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-3 min-w-72 animate-in fade-in zoom-in-95">
          <div className="text-xs font-bold text-white flex items-center justify-between">
            <span>Cài đặt phụ đề</span>
            <span className="text-[11px] text-zinc-400 font-normal">{subtitleCues.length} câu</span>
          </div>

          {/* Subtitle File Input */}
          <div>
            <label className="text-[11px] text-zinc-400 block mb-1">Tải file phụ đề (.srt, .vtt):</label>
            <input 
              type="file"
              accept=".srt,.vtt,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                      setSubtitleCues(parseSubtitles(text));
                    }
                  };
                  reader.readAsText(file);
                }
              }}
              className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
            />
          </div>

          {/* Subtitle Delay Offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>Độ trễ (Sync):</span>
              <span className="font-mono text-emerald-400 font-bold">{settings.subtitleOffsetMs}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSettings(prev => ({ ...prev, subtitleOffsetMs: prev.subtitleOffsetMs - 250 }))}
                className="flex-1 py-1.5 rounded-full vision-btn-circle text-xs hover:text-white cursor-pointer"
              >
                -250ms
              </button>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, subtitleOffsetMs: 0 }))}
                className="px-3 py-1.5 rounded-full vision-btn-circle text-xs hover:text-white cursor-pointer"
              >
                Reset
              </button>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, subtitleOffsetMs: prev.subtitleOffsetMs + 250 }))}
                className="flex-1 py-1.5 rounded-full vision-btn-circle text-xs hover:text-white cursor-pointer"
              >
                +250ms
              </button>
            </div>
          </div>

          {/* Subtitle Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>Cỡ chữ:</span>
              <span className="font-mono">{settings.subtitleSize}px</span>
            </div>
            <input
              type="range"
              min="14"
              max="40"
              value={settings.subtitleSize}
              onChange={(e) => setSettings(prev => ({ ...prev, subtitleSize: parseInt(e.target.value, 10) }))}
              className="w-full accent-emerald-400"
            />
          </div>
        </div>
      )}

      {/* Equalizer & Audio Boost Menu - visionOS Spatial Sheet */}
      {showEqualizerMenu && (
        <div className="absolute top-20 right-40 z-50 p-5 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-3 min-w-64 animate-in fade-in zoom-in-95">
          <div className="text-xs font-bold text-white flex items-center justify-between">
            <span>Equalizer & Kích âm</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Chế độ âm thanh</span>
            {(['flat', 'bass', 'vocal', 'movie'] as const).map((eq) => (
              <button
                key={eq}
                onClick={() => {
                  initWebAudio();
                  if (bassFilterRef.current) {
                    bassFilterRef.current.gain.value = eq === 'bass' ? 6 : eq === 'movie' ? 3 : 0;
                  }
                  setSettings(prev => ({ ...prev, equalizer: eq }));
                }}
                className={`w-full px-3.5 py-2 rounded-2xl text-left text-xs font-medium capitalize flex items-center justify-between cursor-pointer transition-all ${
                  settings.equalizer === eq ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <span>{eq === 'flat' ? 'Chuẩn (Flat)' : eq === 'bass' ? 'Tăng Bass (Bass Boost)' : eq === 'vocal' ? 'Giọng nói (Vocal)' : 'Điện ảnh (Movie)'}</span>
                {settings.equalizer === eq && <Sparkles className="w-3 h-3" />}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-300">Audio Boost (Lên tới 200%):</span>
              <span className={`font-bold font-mono ${settings.volume > 1.0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={settings.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Sleep Timer Menu - visionOS Spatial Sheet */}
      {showSleepTimerMenu && (
        <div className="absolute bottom-24 left-24 z-50 p-2.5 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-44 animate-in fade-in zoom-in-95">
          <div className="text-[11px] font-bold text-zinc-400 px-3 py-1 uppercase tracking-wider font-sans">Hẹn giờ tắt</div>
          {[null, 15, 30, 45, 60].map((mins) => (
            <button
              key={mins || 0}
              onClick={() => {
                setSettings(prev => ({ ...prev, sleepTimerMinutes: mins }));
                setShowSleepTimerMenu(false);
              }}
              className={`px-3.5 py-2 rounded-2xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                settings.sleepTimerMinutes === mins ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <span>{mins ? `${mins} phút` : 'Tắt hẹn giờ'}</span>
              {settings.sleepTimerMinutes === mins && <Sparkles className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
