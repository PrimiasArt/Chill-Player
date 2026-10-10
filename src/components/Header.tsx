import React from 'react';
import { BookOpen, Headphones, PlusCircle, Compass, Settings, Volume2 } from 'lucide-react';
import type { TTSState } from '../services/tts/ttsEngine';

interface HeaderProps {
  currentTab: 'library' | 'crawler' | 'settings';
  onSelectTab: (tab: 'library' | 'crawler' | 'settings') => void;
  onOpenImport: () => void;
  ttsState: TTSState;
  onOpenTTSPlayer: () => void;
  activeStoryTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenImport,
  ttsState,
  onOpenTTSPlayer,
  activeStoryTitle
}) => {
  return (
    <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo & App Name */}
        <div 
          onClick={() => onSelectTab('library')}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-700/60 shadow-md shadow-emerald-500/10 shrink-0 bg-white flex items-center justify-center p-0.5">
            <img 
              src="/icon-192.png" 
              alt="Chill Reader NKI" 
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-100 via-emerald-100 to-emerald-400 bg-clip-text text-transparent">
                Chill Reader
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                NKI Ecosystem
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">Đọc & Nghe truyện thông minh</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onSelectTab('library')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'library'
                ? 'bg-zinc-800 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Tủ sách</span>
          </button>

          <button
            onClick={() => onSelectTab('crawler')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'crawler'
                ? 'bg-zinc-800 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Khám phá</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Nạp file</span>
          </button>
        </nav>

        {/* Right Action Controls: TTS Status & Settings */}
        <div className="flex items-center gap-2">
          {ttsState !== 'idle' && (
            <button
              onClick={onOpenTTSPlayer}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                ttsState === 'playing'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[100px] truncate hidden md:inline">
                {activeStoryTitle || 'Audio'}
              </span>
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onSelectTab('settings')}
            className={`p-2 rounded-lg transition-colors ${
              currentTab === 'settings' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
            title="Cài đặt"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
