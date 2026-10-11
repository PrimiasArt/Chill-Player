import React from 'react';
import { Settings, Globe, FolderPlus } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenNetworkStream: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenNetworkStream
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-zinc-700/80 shadow-md shadow-emerald-500/10 flex items-center justify-center bg-white">
            <img src="/favicon.png" alt="Chill Player" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wider text-zinc-100 uppercase">
                Chill Player
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                NKI
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 block -mt-0.5">
              Trình phát Media & Video Đỉnh Cao
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNetworkStream}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
            title="Mở luồng trực tuyến (Stream URL)"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
            title="Cài đặt"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
