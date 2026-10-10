import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Timer, 
  Volume2, 
  Maximize2, 
  Minimize2, 
  X
} from 'lucide-react';
import { ttsEngine, type TTSState } from '../services/tts/ttsEngine';
import type { TTSSettings } from '../types';

interface TTSPlayerBarProps {
  ttsState: TTSState;
  bookTitle: string;
  author: string;
  chapterTitle: string;
  coverUrl?: string;
  currentSentenceText: string;
  sentenceIndex: number;
  totalSentences: number;
  countdownSeconds: number | null;
  settings: TTSSettings;
  onUpdateSettings: (newSettings: Partial<TTSSettings>) => void;
  onClosePlayer: () => void;
  isOpenFullModal: boolean;
  onSetOpenFullModal: (open: boolean) => void;
}

export const TTSPlayerBar: React.FC<TTSPlayerBarProps> = ({
  ttsState,
  bookTitle,
  author,
  chapterTitle,
  coverUrl,
  currentSentenceText,
  sentenceIndex,
  totalSentences,
  countdownSeconds,
  settings,
  onUpdateSettings,
  onClosePlayer,
  isOpenFullModal,
  onSetOpenFullModal
}) => {
  if (ttsState === 'idle') return null;

  const formatCountdown = (secs: number | null) => {
    if (secs === null) return null;
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const allVoices = ttsEngine.getAllAvailableVoices();

  const progressPercent = totalSentences > 0 
    ? Math.min(100, Math.round(((sentenceIndex + 1) / totalSentences) * 100)) 
    : 0;

  return (
    <>
      {/* 1. Floating Mini Player Bar at Bottom (stacked above BottomNav on mobile) */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 text-zinc-100 shadow-2xl px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Story & Chapter Info */}
          <div 
            onClick={() => onSetOpenFullModal(true)}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-90"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0 flex items-center justify-center">
              {coverUrl ? (
                <img src={coverUrl} alt={bookTitle} className="w-full h-full object-cover" />
              ) : (
                <Volume2 className="w-5 h-5 text-amber-400" />
              )}
            </div>

            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-zinc-100 truncate">
                {chapterTitle}
              </h4>
              <p className="text-[11px] text-zinc-400 truncate">
                {bookTitle} • <span className="text-amber-400 font-medium">{progressPercent}%</span>
              </p>
            </div>
          </div>

          {/* Quick Playback Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Rewind 1 sentence */}
            <button
              onClick={() => ttsEngine.previousSentence()}
              className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Tua lùi 1 câu"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={() => ttsEngine.togglePlayPause()}
              className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              {ttsState === 'playing' ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-0.5" />
              )}
            </button>

            {/* Forward 1 sentence */}
            <button
              onClick={() => ttsEngine.nextSentence()}
              className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Tua tới 1 câu"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Sleep Timer & Expand */}
          <div className="flex items-center gap-2">
            {countdownSeconds !== null && (
              <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatCountdown(countdownSeconds)}
              </span>
            )}

            <button
              onClick={() => onSetOpenFullModal(true)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Mở trình phát đầy đủ"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClosePlayer}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Tắt trình nghe audio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mini progress line */}
        <div className="w-full h-0.5 bg-zinc-800 mt-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. Full Audio Player Modal */}
      {isOpenFullModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => onSetOpenFullModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col items-center space-y-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar in Modal */}
            <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                Trình phát Audio TTS
              </span>
              <button
                onClick={() => onSetOpenFullModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Book Artwork & Titles */}
            <div className="text-center">
              <div className="w-32 h-44 rounded-2xl overflow-hidden bg-zinc-800 border-2 border-zinc-700/80 shadow-2xl mx-auto mb-4 flex items-center justify-center">
                {coverUrl ? (
                  <img src={coverUrl} alt={bookTitle} className="w-full h-full object-cover" />
                ) : (
                  <Volume2 className="w-12 h-12 text-amber-400" />
                )}
              </div>
              <h3 className="font-bold text-base text-zinc-100 line-clamp-1">{chapterTitle}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{bookTitle} • {author}</p>
            </div>

            {/* Currently Read Sentence Box */}
            <div className="w-full bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 min-h-[72px] flex items-center justify-center text-center">
              <p className="text-xs text-zinc-300 font-medium italic leading-relaxed line-clamp-3">
                "{currentSentenceText || 'Đang sẵn sàng đọc...'}"
              </p>
            </div>

            {/* Sentence Progress */}
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Câu {sentenceIndex + 1} / {totalSentences}</span>
                <span className="font-semibold text-amber-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Main Audio Buttons */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => ttsEngine.previousSentence()}
                className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                title="Lùi 1 câu"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={() => ttsEngine.togglePlayPause()}
                className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-xl shadow-amber-500/30 transition-all cursor-pointer"
              >
                {ttsState === 'playing' ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => ttsEngine.nextSentence()}
                className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                title="Tiến 1 câu"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

            {/* Playback Speed Controls */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Tốc độ đọc (0.5x - 4.0x)</span>
                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {settings.rate}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={settings.rate || 1.0}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  onUpdateSettings({ rate });
                  ttsEngine.updateSettings({ rate });
                }}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {[0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0, 4.0].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      onUpdateSettings({ rate });
                      ttsEngine.updateSettings({ rate });
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settings.rate === rate
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep Timer Options */}
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-amber-400" />
                  Hẹn giờ tắt
                </span>
                <span className="text-amber-400 font-semibold">
                  {countdownSeconds !== null ? formatCountdown(countdownSeconds) : 'Tắt'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[15, 30, 45, null].map((mins, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onUpdateSettings({ sleepTimerMinutes: mins });
                      ttsEngine.setSleepTimer(mins);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      settings.sleepTimerMinutes === mins
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {mins ? `${mins} phút` : 'Không hẹn'}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Selector */}
            {allVoices.length > 0 && (
              <div className="w-full">
                <label className="text-xs text-zinc-400 block mb-1.5">Giọng đọc Audio</label>
                <select
                  value={settings.voiceURI || 'edge:vi-VN-NamMinhNeural'}
                  onChange={(e) => {
                    const voiceURI = e.target.value;
                    const v = allVoices.find(x => x.id === voiceURI);
                    onUpdateSettings({ voiceURI, engine: v?.category });
                    ttsEngine.updateSettings({ voiceURI, engine: v?.category });
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  {allVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} • {v.badge}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
