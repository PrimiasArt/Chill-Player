import React from 'react';
import { BookOpen, Compass, PlusCircle, Settings } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'library' | 'crawler' | 'settings';
  onSelectTab: (tab: 'library' | 'crawler' | 'settings') => void;
  onOpenImport: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenImport
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 text-zinc-400 px-3 py-1.5 flex items-center justify-around md:hidden shadow-2xl safe-area-bottom">
      {/* 1. Library Tab */}
      <button
        onClick={() => onSelectTab('library')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
          currentTab === 'library'
            ? 'text-amber-400 font-bold scale-105'
            : 'text-zinc-400 hover:text-zinc-200 active:scale-95'
        }`}
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Tủ sách</span>
      </button>

      {/* 2. Crawler Tab */}
      <button
        onClick={() => onSelectTab('crawler')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
          currentTab === 'crawler'
            ? 'text-amber-400 font-bold scale-105'
            : 'text-zinc-400 hover:text-zinc-200 active:scale-95'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Khám phá</span>
      </button>

      {/* 3. Quick Import Button */}
      <button
        onClick={onOpenImport}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer text-zinc-300 hover:text-amber-400 active:scale-95"
      >
        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-sm">
          <PlusCircle className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight text-amber-400/90 font-medium">Nạp file</span>
      </button>

      {/* 4. Settings Tab */}
      <button
        onClick={() => onSelectTab('settings')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
          currentTab === 'settings'
            ? 'text-amber-400 font-bold scale-105'
            : 'text-zinc-400 hover:text-zinc-200 active:scale-95'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Cài đặt</span>
      </button>
    </nav>
  );
};
