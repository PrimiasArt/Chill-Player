import React from 'react';
import { Settings, Globe, ShieldCheck, Lock, Sparkles } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenNetworkStream: () => void;
  onOpenVault: () => void;
  isVaultActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenNetworkStream,
  onOpenVault,
  isVaultActive = false
}) => {
  return (
    <header className="sticky top-0 z-30 w-full px-4 py-3 pointer-events-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Brand Logo & visionOS Frosted Pill */}
        <div className="flex items-center gap-3 p-1.5 pr-4 rounded-full vision-glass">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shadow-md shadow-emerald-500/10 flex items-center justify-center bg-zinc-900">
            <img src="/favicon.png" alt="Chill Player" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs tracking-wider text-white uppercase">
                Chill Player
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Spatial
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 block -mt-0.5 font-light">
              visionOS Media Experience
            </span>
          </div>
        </div>

        {/* Header Right Actions - visionOS Floating Glass Buttons */}
        <div className="flex items-center gap-2 p-1.5 rounded-full vision-glass">
          {/* Private Vault Button */}
          <button
            onClick={onOpenVault}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              isVaultActive
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20'
                : 'vision-btn-circle text-zinc-300 hover:text-white hover:border-emerald-500/40'
            }`}
            title="Két Riêng Tư (Private Vault)"
          >
            <Lock className={`w-3.5 h-3.5 ${isVaultActive ? 'text-zinc-950' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline">Két Ẩn</span>
          </button>

          {/* Stream URL */}
          <button
            onClick={onOpenNetworkStream}
            className="w-8 h-8 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
            title="Mở luồng trực tuyến (Stream URL)"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-full vision-btn-circle text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
            title="Cài đặt"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
