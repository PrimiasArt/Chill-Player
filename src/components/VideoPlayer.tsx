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
  Settings,
  MoreHorizontal,
  X
} from 'lucide-react';
import Hls from 'hls.js';
import type { MediaItem, PlayerSettings, AspectRatioMode, SubtitleCue } from '../types';
import { parseSubtitles, getActiveSubtitleText } from '../services/subtitles';
import { db } from '../services/db';
import { useBackButton } from '../services/backButton';

export type ActivePlayerMenu = 'none' | 'more' | 'aspect' | 'speed' | 'subtitles' | 'equalizer' | 'sleep';

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
  const [isBuffering, setIsBuffering] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockHint, setLockHint] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Gesture indicators
  const [gestureType, setGestureType] = useState<'none' | 'volume' | 'brightness' | 'seek'>('none');
  const [gestureValue, setGestureValue] = useState<number>(0);
  const [seekOffset, setSeekOffset] = useState<number>(0);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  // Subtitles
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);

  // Modals & Sheets - Unified Mutually Exclusive Menu State
  const [activeMenu, setActiveMenu] = useState<ActivePlayerMenu>('none');

  const toggleMenu = (menu: ActivePlayerMenu) => {
    setActiveMenu(prev => (prev === menu ? 'none' : menu));
    triggerShowControls();
  };

  const closeMenu = () => {
    setActiveMenu('none');
  };

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
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const sleepTimerTimeoutRef = useRef<number | null>(null);
  const lockHintTimeoutRef = useRef<number | null>(null);

  // Auto-hide controls after 4.5 seconds
  const triggerShowControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setActiveMenu('none');
    }, 4500);
  }, []);

  // Hardware Back Button Handlers (Hierarchical Priority)
  // 1. If screen is locked, do not exit: show unlock hint toast
  useBackButton(() => {
    setLockHint(true);
    if (lockHintTimeoutRef.current) clearTimeout(lockHintTimeoutRef.current);
    lockHintTimeoutRef.current = window.setTimeout(() => setLockHint(false), 2500);
    triggerShowControls();
    return true;
  }, isLocked);

  // 2. If a popup menu is active, back closes the menu first without closing player
  useBackButton(() => {
    setActiveMenu('none');
    return true;
  }, !isLocked && activeMenu !== 'none');

  // 3. If unlocked and no menu is open, back closes player and returns to library/vault
  useBackButton(() => {
    onBack();
    return true;
  }, !isLocked && activeMenu === 'none');

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Initialize Web Audio API on first user interaction to prevent autoplay audio lag
  const initWebAudio = () => {
    if (audioSourceConnected.current || !videoRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(videoRef.current);
      const gainNode = ctx.createGain();
      const bassFilter = ctx.createBiquadFilter();

      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;
      bassFilter.gain.value = 0;

      gainNode.gain.value = settings.volume;

      source.connect(bassFilter);
      bassFilter.connect(gainNode);
      gainNode.connect(ctx.destination);

      gainNodeRef.current = gainNode;
      bassFilterRef.current = bassFilter;
      audioSourceConnected.current = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  };

  // Video Source & HLS initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);

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
          setIsBuffering(false);
          if (media.currentTime > 0) {
            video.currentTime = media.currentTime;
          }
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, () => {
          setIsBuffering(false);
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

    triggerShowControls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [media.url, triggerShowControls]);

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

  // Update Progress in Database periodically (for regular media items only)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoRef.current && duration > 0 && !media.id.startsWith('vault_')) {
        const time = videoRef.current.currentTime;
        const progress = Math.min(100, Math.round((time / duration) * 100));
        await db.mediaItems.update(media.id, {
          currentTime: time,
          progressPercent: progress,
          lastPlayedAt: Date.now()
        }).catch(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [media.id, duration]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // Active subtitle calculation
    if (subtitleCues.length > 0) {
      const adjustedTime = time + (settings.subtitleOffsetMs / 1000);
      const text = getActiveSubtitleText(subtitleCues, adjustedTime);
      setActiveSubtitle(text);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsBuffering(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (settings.autoPlayNext && onNextMedia) {
      onNextMedia();
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    initWebAudio();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    triggerShowControls();
  };

  // Volume & Audio Boost adjustment
  const handleVolumeChange = (newVolume: number) => {
    initWebAudio();
    setSettings(prev => ({ ...prev, volume: newVolume }));
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    } else if (videoRef.current) {
      videoRef.current.volume = Math.min(1.0, newVolume);
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

  // Dedicated Gesture Overlay Handlers (separated from controls buttons)
  const handleGesturePointerDown = (e: React.PointerEvent) => {
    if (isLocked) return;
    touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handleGesturePointerMove = (e: React.PointerEvent) => {
    if (isLocked || !touchStartRef.current) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (absX < 20 && absY < 20) return;

    if (absY > absX) {
      // Vertical gesture
      const isLeft = touchStartRef.current.x < rect.width / 2;
      const deltaPercent = -(dy / (rect.height * 0.7));

      if (isLeft) {
        // Brightness
        setGestureType('brightness');
        const newBright = Math.max(0.1, Math.min(1.0, settings.brightness + deltaPercent * 0.05));
        setSettings(prev => ({ ...prev, brightness: newBright }));
        setGestureValue(Math.round(newBright * 100));
      } else {
        // Volume
        setGestureType('volume');
        const newVol = Math.max(0, Math.min(2.0, settings.volume + deltaPercent * 0.08));
        handleVolumeChange(newVol);
        setGestureValue(Math.round(newVol * 100));
      }
    } else {
      // Horizontal seek
      setGestureType('seek');
      const seekSecs = Math.round((dx / rect.width) * 90);
      setSeekOffset(seekSecs);
    }
  };

  const handleGesturePointerUp = () => {
    if (isLocked) {
      setLockHint(true);
      if (lockHintTimeoutRef.current) clearTimeout(lockHintTimeoutRef.current);
      lockHintTimeoutRef.current = window.setTimeout(() => setLockHint(false), 2500);
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
      const { x } = touchStartRef.current;
      const rect = containerRef.current?.getBoundingClientRect();

      if (lastTapRef.current && now - lastTapRef.current.time < 320) {
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
        setShowControls(prev => !prev);
      }
    }

    touchStartRef.current = null;
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

  // Aspect ratio helper
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
      className="relative w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center"
    >
      {/* 1. Video Element */}
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        style={getAspectRatioStyle()}
        className="max-w-full max-h-full transition-all duration-200"
      />

      {/* 2. Independent Brightness Dimming Overlay (Over video, behind controls) */}
      <div 
        className="absolute inset-0 bg-black pointer-events-none z-1" 
        style={{ opacity: 1 - settings.brightness }} 
      />

      {/* 3. Invisible Fullscreen Gesture Touch Layer */}
      <div 
        onPointerDown={handleGesturePointerDown}
        onPointerMove={handleGesturePointerMove}
        onPointerUp={handleGesturePointerUp}
        className="absolute inset-0 z-10 touch-none cursor-pointer"
      />

      {/* 4. Subtitle Renderer */}
      {activeSubtitle && (
        <div className="absolute bottom-20 md:bottom-28 left-4 right-4 text-center pointer-events-none z-20">
          <span 
            className="inline-block px-4 py-1.5 rounded-2xl vision-glass font-medium shadow-2xl transition-all"
            style={{ 
              fontSize: `${settings.subtitleSize}px`,
              color: settings.subtitleColor,
              textShadow: '0 2px 8px rgba(0,0,0,0.9)'
            }}
          >
            {activeSubtitle}
          </span>
        </div>
      )}

      {/* 5. Gesture Feedback HUDs - visionOS Floating Glass */}
      {gestureType === 'volume' && (
        <div className="absolute top-1/2 right-6 -translate-y-1/2 p-4 rounded-3xl vision-capsule border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2.5 z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <Volume2 className="w-6 h-6 text-emerald-400" />
          <div className="w-2 h-32 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
            <div 
              className={`w-full rounded-full transition-all ${gestureValue > 100 ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]' : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'}`}
              style={{ height: `${Math.min(100, (gestureValue / 200) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-white font-mono">
            {gestureValue}% {gestureValue > 100 && <span className="text-amber-400 text-[8px] block text-center font-bold">BOOST</span>}
          </span>
        </div>
      )}

      {gestureType === 'brightness' && (
        <div className="absolute top-1/2 left-6 -translate-y-1/2 p-4 rounded-3xl vision-capsule border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2.5 z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <Sun className="w-6 h-6 text-amber-400" />
          <div className="w-2 h-32 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
            <div 
              className="w-full bg-amber-400 rounded-full transition-all shadow-[0_0_12px_rgba(251,191,36,0.8)]"
              style={{ height: `${gestureValue}%` }}
            />
          </div>
          <span className="text-xs font-bold text-white font-mono">{gestureValue}%</span>
        </div>
      )}

      {gestureType === 'seek' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-3xl vision-capsule border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-1.5 z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
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
        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-emerald-400 vision-capsule p-4 rounded-full animate-ping pointer-events-none z-30">
          <RotateCcw className="w-8 h-8" />
          <span className="text-xs font-bold">-10s</span>
        </div>
      )}
      {doubleTapFeedback === 'right' && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-emerald-400 vision-capsule p-4 rounded-full animate-ping pointer-events-none z-30">
          <RotateCw className="w-8 h-8" />
          <span className="text-xs font-bold">+10s</span>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 gap-3">
          <div className="w-12 h-12 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin shadow-[0_0_20px_rgba(52,211,153,0.4)]" />
          <span className="text-xs font-medium text-emerald-300 vision-glass px-3 py-1 rounded-full">
            Đang tải media...
          </span>
        </div>
      )}

      {/* Screen Lock Button (Vertically Centered on Left Edge - Standard MX Player Pattern) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const nextLocked = !isLocked;
          setIsLocked(nextLocked);
          if (nextLocked) {
            setActiveMenu('none');
          }
          triggerShowControls();
        }}
        className={`absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full transition-all cursor-pointer ${
          isLocked 
            ? 'bg-amber-400 text-zinc-950 shadow-[0_0_30px_rgba(251,191,36,0.8)] scale-110 ring-4 ring-amber-400/30' 
            : showControls 
              ? 'vision-btn-circle text-zinc-200 hover:text-white backdrop-blur-md' 
              : 'opacity-0 pointer-events-none'
        }`}
        title={isLocked ? 'Mở khóa màn hình' : 'Khóa cử chỉ màn hình'}
      >
        {isLocked ? <Lock className="w-5 h-5 text-zinc-950" /> : <Unlock className="w-4 h-4" />}
      </button>

      {/* Screen Locked Hint Toast */}
      {lockHint && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-5 py-3 rounded-full vision-capsule border border-amber-400/50 shadow-[0_0_35px_rgba(251,191,36,0.4)] flex items-center gap-2.5 animate-in fade-in zoom-in-95 pointer-events-none">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-white tracking-wide">
            Màn hình đang khóa. Chạm ổ khóa vàng bên trái để mở khóa.
          </span>
        </div>
      )}

      {/* 6. Controls Overlay (Clean, Responsive, Non-blocking) */}
      {showControls && !isLocked && (
        <div className="absolute inset-0 z-40 bg-gradient-to-t from-black/85 via-transparent to-black/80 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
          {/* Top Bar - Clean visionOS Floating Glass Capsule */}
          <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-3 p-1.5 px-3 rounded-full vision-capsule shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/20 pointer-events-auto">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <button 
                onClick={onBack}
                className="w-9 h-9 rounded-full vision-btn-circle text-zinc-200 hover:text-white hover:bg-white/20 active:scale-95 flex items-center justify-center cursor-pointer shrink-0 transition-all"
                title="Quay lại thư viện"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-xs md:max-w-md">
                  {media.title}
                </h2>
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono">
                  <span className="uppercase px-1.5 py-0.2 rounded-full vision-glass font-sans font-bold text-emerald-400 text-[8px]">
                    {media.format || 'VIDEO'}
                  </span>
                  {media.id.startsWith('vault_') && (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      Vault
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu('aspect');
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  activeMenu === 'aspect' ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/30' : 'vision-btn-circle text-zinc-300 hover:text-white'
                }`}
                title="Tỉ lệ khung hình"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePiP}
                className="w-8 h-8 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Picture-in-Picture (Thu nhỏ)"
              >
                <PictureInPicture className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu('more');
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  activeMenu === 'more' ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/30' : 'vision-btn-circle text-zinc-300 hover:text-white'
                }`}
                title="Cài đặt phát & Âm thanh"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Play / Pause & Skip Buttons - Compact & Elegant */}
          <div className="flex items-center justify-center gap-5 sm:gap-8 self-center pointer-events-auto">
            {onPrevMedia && (
              <button 
                onClick={onPrevMedia}
                className="w-10 h-10 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => seekRelative(-10)}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full vision-btn-circle text-zinc-200 hover:text-white flex flex-col items-center justify-center cursor-pointer active:scale-95"
              title="Lùi 10 giây"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[8px] font-bold mt-0.5">-10s</span>
            </button>

            <button
              onClick={togglePlay}
              className="w-15 h-15 sm:w-17 sm:h-17 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_35px_rgba(16,185,129,0.5)] flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full vision-btn-circle text-zinc-200 hover:text-white flex flex-col items-center justify-center cursor-pointer active:scale-95"
              title="Tới 10 giây"
            >
              <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[8px] font-bold mt-0.5">+10s</span>
            </button>

            {onNextMedia && (
              <button 
                onClick={onNextMedia}
                className="w-10 h-10 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bottom Bar: visionOS Floating Glass Capsule */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl mx-auto p-3 sm:p-4 rounded-3xl vision-capsule shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/20 space-y-2 pointer-events-auto"
          >
            {/* Progress Slider */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono text-zinc-300 min-w-10 text-right">
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

              <span className="text-[11px] font-mono text-zinc-400 min-w-10">
                {formatTime(duration)}
              </span>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between text-xs text-zinc-300 pt-0.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleVolumeChange(settings.volume > 0 ? 0 : 1.0)}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-xs"
                >
                  {settings.volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                  <span className="font-mono text-[11px]">{Math.round(settings.volume * 100)}%</span>
                  {settings.volume > 1.0 && <span className="text-[8px] px-1 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">BOOST</span>}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu('sleep');
                  }}
                  className={`flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-xs ${
                    settings.sleepTimerMinutes || activeMenu === 'sleep' ? 'text-amber-400 font-semibold' : ''
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{settings.sleepTimerMinutes ? `${settings.sleepTimerMinutes}m` : 'Hẹn giờ'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      containerRef.current?.requestFullscreen();
                    }
                  }}
                  className="w-7 h-7 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                  title="Toàn màn hình"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop to dismiss any open menu on outside click */}
      {activeMenu !== 'none' && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu('none');
          }}
          className="absolute inset-0 z-45 bg-black/35 backdrop-blur-[2px] transition-all"
        />
      )}

      {/* 7. Unified visionOS "More Options" Sheet */}
      {activeMenu === 'more' && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 right-4 sm:right-10 z-50 p-4 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-2 min-w-56 animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-2 mb-1">
            <span>Tùy chọn phát</span>
            <button onClick={() => setActiveMenu('none')} className="text-zinc-400 hover:text-white cursor-pointer p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setActiveMenu('speed')}
            className="flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-white/10 text-xs text-zinc-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Tốc độ phát
            </span>
            <span className="font-mono text-zinc-400">{settings.playbackRate}x</span>
          </button>

          <button
            onClick={() => setActiveMenu('equalizer')}
            className="flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-white/10 text-xs text-zinc-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Equalizer & Audio Boost
            </span>
            <span className="capitalize text-zinc-400 font-mono text-[10px]">{settings.equalizer}</span>
          </button>

          <button
            onClick={() => setActiveMenu('subtitles')}
            className="flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-white/10 text-xs text-zinc-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Subtitles className="w-3.5 h-3.5 text-emerald-400" />
              Phụ đề rời
            </span>
            <span className="text-zinc-400 text-[10px]">{subtitleCues.length > 0 ? 'Bật' : 'Tắt'}</span>
          </button>
        </div>
      )}

      {/* Aspect Ratio Modal Menu */}
      {activeMenu === 'aspect' && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 right-4 sm:right-10 z-50 p-3 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-48 animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-2 mb-1 px-1">
            <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider font-sans">Tỉ lệ khung hình</span>
            <button onClick={() => setActiveMenu('none')} className="text-zinc-400 hover:text-white cursor-pointer p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {(['fit', 'fill', 'stretch', '16:9', '4:3', 'original'] as AspectRatioMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setSettings(prev => ({ ...prev, aspectRatio: mode }));
                setActiveMenu('none');
              }}
              className={`px-3.5 py-1.5 rounded-2xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                settings.aspectRatio === mode ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <span className="capitalize">{mode}</span>
              {settings.aspectRatio === mode && <Sparkles className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}

      {/* Speed Modal Menu */}
      {activeMenu === 'speed' && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 right-4 sm:right-10 z-50 p-3 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-44 animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-1.5 mb-1 px-1">
            <button 
              onClick={() => setActiveMenu('more')} 
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Quay lại</span>
            </button>
            <button onClick={() => setActiveMenu('none')} className="text-zinc-400 hover:text-white cursor-pointer p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((rate) => (
            <button
              key={rate}
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.playbackRate = rate;
                }
                setSettings(prev => ({ ...prev, playbackRate: rate }));
                setActiveMenu('none');
              }}
              className={`px-3.5 py-1.5 rounded-2xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                settings.playbackRate === rate ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <span>{rate}x</span>
              {settings.playbackRate === rate && <Sparkles className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}

      {/* Subtitles Menu */}
      {activeMenu === 'subtitles' && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 right-4 sm:right-10 z-50 p-4 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-3 min-w-64 max-w-xs animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-1.5">
            <button 
              onClick={() => setActiveMenu('more')} 
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Quay lại</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-normal">{subtitleCues.length} câu</span>
              <button onClick={() => setActiveMenu('none')} className="text-zinc-400 hover:text-white cursor-pointer p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Tải file phụ đề (.srt, .vtt):</label>
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
              className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>Độ trễ (Sync):</span>
              <span className="font-mono text-emerald-400 font-bold">{settings.subtitleOffsetMs}ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setSettings(prev => ({ ...prev, subtitleOffsetMs: prev.subtitleOffsetMs - 250 }))}
                className="flex-1 py-1 rounded-full vision-btn-circle text-xs hover:text-white cursor-pointer"
              >
                -250ms
              </button>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, subtitleOffsetMs: 0 }))}
                className="px-2.5 py-1 rounded-full vision-btn-circle text-xs hover:text-white cursor-pointer"
              >
                Reset
              </button>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, subtitleOffsetMs: prev.subtitleOffsetMs + 250 }))}
                className="flex-1 py-1 rounded-full vision-btn-circle text-xs hover:text-white cursor-pointer"
              >
                +250ms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equalizer & Audio Boost Menu */}
      {activeMenu === 'equalizer' && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 right-4 sm:right-10 z-50 p-4 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-3 min-w-64 animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-1.5">
            <button 
              onClick={() => setActiveMenu('more')} 
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Quay lại</span>
            </button>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <button onClick={() => setActiveMenu('none')} className="text-zinc-400 hover:text-white cursor-pointer p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Chế độ âm thanh</span>
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
                className={`w-full px-3 py-1.5 rounded-2xl text-left text-xs font-medium capitalize flex items-center justify-between cursor-pointer transition-all ${
                  settings.equalizer === eq ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <span>{eq === 'flat' ? 'Chuẩn (Flat)' : eq === 'bass' ? 'Tăng Bass (Bass Boost)' : eq === 'vocal' ? 'Giọng nói (Vocal)' : 'Điện ảnh (Movie)'}</span>
                {settings.equalizer === eq && <Sparkles className="w-3 h-3" />}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-zinc-300">Audio Boost (200%):</span>
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

      {/* Sleep Timer Menu */}
      {activeMenu === 'sleep' && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-24 left-6 z-50 p-3 rounded-3xl vision-glass border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-1 min-w-44 animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-xs font-bold text-white border-b border-white/10 pb-1.5 mb-1 px-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">Hẹn giờ tắt</span>
            <button onClick={() => setActiveMenu('none')} className="text-zinc-400 hover:text-white cursor-pointer p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {[null, 15, 30, 45, 60].map((mins) => (
            <button
              key={mins || 0}
              onClick={() => {
                setSettings(prev => ({ ...prev, sleepTimerMinutes: mins }));
                setActiveMenu('none');
              }}
              className={`px-3.5 py-1.5 rounded-2xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                settings.sleepTimerMinutes === mins ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <span>{mins ? `${mins} phút` : 'Tắt hẹn giờ'}</span>
              {settings.sleepTimerMinutes === mins && <Sparkles className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
