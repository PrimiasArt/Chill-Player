import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink, 
  Sliders, 
  Database,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { appUpdater, type UpdateState } from '../services/appUpdater';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [updateState, setUpdateState] = useState<UpdateState>(appUpdater.getCurrentVersion() as any);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checkResultMsg, setCheckResultMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = appUpdater.subscribe((state) => {
      setUpdateState(state);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setCheckResultMsg(null);
    try {
      const res = await appUpdater.checkForUpdates(true);
      if (res.hasUpdate) {
        setCheckResultMsg(`Phát hiện bản mới: v${res.latestVersion?.versionName}`);
      } else {
        setCheckResultMsg('Bạn đang sử dụng phiên bản mới nhất!');
      }
    } catch {
      setCheckResultMsg('Không thể kiểm tra cập nhật. Vui lòng kiểm tra lại mạng.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 text-zinc-100 font-bold text-base">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <span>Cài Đặt & Cập Nhật</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Version & Update Card */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block">Phiên bản hiện tại</span>
                <span className="text-sm font-bold text-zinc-100">
                  v{updateState.currentVersion?.versionName || '1.0.1'} (Build {updateState.currentVersion?.versionCode || 101})
                </span>
              </div>
              <button
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || updateState.isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Kiểm tra cập nhật</span>
              </button>
            </div>

            {checkResultMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{checkResultMsg}</span>
              </div>
            )}

            {updateState.updateAvailable?.hasUpdate && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">Có bản cập nhật mới sẵn sàng!</span>
                  <span className="font-mono text-zinc-300">v{updateState.updateAvailable.latestVersion?.versionName}</span>
                </div>
                <p className="text-[11px] text-zinc-300 line-clamp-2">
                  {updateState.updateAvailable.latestVersion?.releaseNotes}
                </p>
                <button
                  onClick={() => appUpdater.startUpdate()}
                  disabled={updateState.isDownloading}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>{updateState.isDownloading ? 'Đang tải bản cập nhật...' : 'Cập nhật ngay (1-Click APK)'}</span>
                </button>
              </div>
            )}

            {updateState.isDownloading && updateState.progress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>Tiến độ tải APK:</span>
                  <span>{updateState.progress.percent}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${updateState.progress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* App Info Card */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>Hệ sinh thái NKI (Chill Player)</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Trình phát video, media và audio cá nhân cao cấp. Kế thừa các tính năng cốt lõi của MX Player: cử chỉ vuốt thông minh, phụ đề đa định dạng, Audio Boost 200%, hỗ trợ HLS m3u8 và hoàn toàn sạch quảng cáo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
