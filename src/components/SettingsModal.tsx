import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  KeyRound,
  Sliders, 
  Database,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { appUpdater, type UpdateState } from '../services/appUpdater';
import { vaultService } from '../services/vaultService';

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

  const handleResetVaultPin = () => {
    if (confirm('Bạn có chắc chắn muốn đặt lại mã PIN Két bí mật? Bạn cần nhớ lại PIN cũ hoặc nếu đã mở khóa thì có thể thiết lập mã PIN mới.')) {
      if (!vaultService.isUnlocked() && vaultService.hasPin()) {
        alert('Vui lòng mở khóa Két bí mật trước khi đổi mã PIN!');
        return;
      }
      const newPin = prompt('Nhập mã PIN mới (6 chữ số):');
      if (newPin && newPin.length === 6 && /^\d+$/.test(newPin)) {
        vaultService.setupPin(newPin).then((ok) => {
          if (ok) alert('Đổi mã PIN Két bí mật thành công!');
          else alert('Lỗi khi đổi mã PIN!');
        });
      } else if (newPin) {
        alert('Mã PIN phải đúng 6 chữ số!');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl vision-glass border border-white/20 shadow-[0_30px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/10">
          <div className="flex items-center gap-3 text-white font-bold text-base">
            <div className="w-9 h-9 rounded-2xl vision-capsule flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <span>Cài Đặt & Hệ Thống</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full vision-btn-circle text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Version & Update Card */}
          <div className="p-4 rounded-2xl vision-card border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block font-light">Phiên bản hiện tại</span>
                <span className="text-sm font-bold text-white tracking-wide">
                  v{updateState.currentVersion?.versionName || '1.0.1'} (Build {updateState.currentVersion?.versionCode || 101})
                </span>
              </div>
              <button
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || updateState.isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full vision-btn-circle text-zinc-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
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
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
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
                  className="w-full py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                    style={{ width: `${updateState.progress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vault Security Settings */}
          <div className="p-4 rounded-2xl vision-card border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Két Riêng Tư (Private Vault)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full vision-glass text-emerald-300 font-mono">
                AES-256-GCM
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-light">
              Bảo vệ các tệp video và nhạc bí mật. Dữ liệu được mã hóa cách ly và chỉ giải mã trên RAM khi phát.
            </p>
            <button
              onClick={handleResetVaultPin}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full vision-btn-circle text-xs text-zinc-200 hover:text-white cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đổi mã PIN Két bí mật</span>
            </button>
          </div>

          {/* App Info Card */}
          <div className="p-4 rounded-2xl vision-card border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>Chill Player • visionOS Edition</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              Trình phát media tinh khiết, 100% không quảng cáo, không thu phí, không tracking. Kế thừa cử chỉ thông minh của MX Player (vuốt âm lượng 200%, độ sáng, tua thời gian, phụ đề thời gian thực) trong không gian giao diện Apple visionOS.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full vision-btn-circle text-zinc-300 hover:text-white font-semibold text-xs cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
