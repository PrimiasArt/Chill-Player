import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Sparkles, 
  AlertCircle, 
  ExternalLink, 
  X, 
  Loader2, 
  ShieldAlert 
} from 'lucide-react';
import { appUpdater, FALLBACK_DOWNLOAD_URL, type UpdateState } from '../services/appUpdater';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const [state, setState] = useState<UpdateState>(() => appUpdater.getState());

  useEffect(() => {
    return appUpdater.subscribe((newState) => {
      setState({ ...newState });
    });
  }, []);

  if (!isOpen && !state?.updateAvailable?.hasUpdate && !state?.isDownloading) {
    return null;
  }

  const update = state?.updateAvailable?.latestVersion;
  const current = state?.currentVersion || { versionName: '1.0', versionCode: 100 };
  const progress = state?.progress;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-500/15 via-zinc-800 to-zinc-900 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Bản cập nhật mới
                {update && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-bold">
                    {update.versionName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Phiên bản hiện tại: <span className="text-zinc-300 font-medium">{current.versionName}</span>
              </p>
            </div>
          </div>

          {!state.isDownloading && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Version Stats */}
          {update && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-xs">
              <div>
                <span className="text-zinc-400 block text-[11px]">Dung lượng:</span>
                <span className="font-semibold text-zinc-200">
                  {update.assetSize ? formatBytes(update.assetSize) : '~6.5 MB'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Kênh phát hành:</span>
                <span className="font-semibold text-emerald-400">GitHub Release</span>
              </div>
            </div>
          )}

          {/* Release Notes */}
          {update?.releaseNotes && (
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Nội dung cập nhật:
              </label>
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
                {update.releaseNotes}
              </div>
            </div>
          )}

          {/* Permission Alert if Required on Android 8+ */}
          {state.permissionRequired && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold">Cần cấp quyền cài đặt APK:</p>
                <p className="text-[11px] text-zinc-300">
                  Vui lòng bật tùy chọn <strong>"Cho phép từ nguồn này"</strong> để Chill Reader tự động cài đặt bản cập nhật.
                </p>
                <button
                  type="button"
                  onClick={() => appUpdater.openInstallPermissionSettings()}
                  className="px-2.5 py-1 rounded bg-amber-500 text-zinc-950 font-bold text-[11px] hover:bg-amber-400 transition-colors inline-block cursor-pointer"
                >
                  Mở cài đặt quyền
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {state.error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <p className="flex-1">{state.error}</p>
            </div>
          )}

          {/* Download Progress Bar */}
          {state.isDownloading && progress && (
            <div className="p-4 bg-zinc-800/80 rounded-xl border border-zinc-700/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  Đang tải bản cập nhật...
                </span>
                <span className="font-bold text-amber-400">{progress.percent}%</span>
              </div>

              <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-200 rounded-full"
                  style={{ width: `${Math.max(5, progress.percent)}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>{progress.receivedBytes > 0 ? formatBytes(progress.receivedBytes) : 'Đang chuẩn bị...'}</span>
                <span>{progress.totalBytes > 100 ? formatBytes(progress.totalBytes) : ''}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 flex flex-col gap-2">
          {state.isDownloading ? (
            <div className="text-center text-xs text-zinc-400 py-1">
              File APK đang được tải về máy, ứng dụng sẽ tự động mở cài đặt khi hoàn tất...
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => appUpdater.startUpdate()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Cập nhật ngay (Tự động tải & cài đặt)</span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const url = update?.downloadUrl || FALLBACK_DOWNLOAD_URL;
                    window.open(url, '_blank');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tải bằng trình duyệt</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
