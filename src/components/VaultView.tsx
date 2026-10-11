import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  KeyRound, 
  Plus, 
  Film, 
  Music, 
  Trash2, 
  RotateCcw, 
  Play, 
  Clock, 
  HardDrive, 
  AlertCircle,
  Eye,
  EyeOff,
  ShieldAlert,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { vaultService, type VaultMediaItem } from '../services/vaultService';
import type { MediaItem } from '../types';

interface VaultViewProps {
  onPlayVaultMedia: (mediaItem: MediaItem) => void;
  onBackToLibrary: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  onPlayVaultMedia,
  onBackToLibrary
}) => {
  const [hasPin, setHasPin] = useState(vaultService.hasPin());
  const [isUnlocked, setIsUnlocked] = useState(vaultService.isUnlocked());
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(!vaultService.hasPin());
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);

  // Vault Items
  const [vaultItems, setVaultItems] = useState<VaultMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);

  const loadVaultItems = async () => {
    setIsLoading(true);
    try {
      const items = await vaultService.getAllVaultItems();
      setVaultItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      loadVaultItems();
    }
  }, [isUnlocked]);

  // Handle number click on visionOS numpad
  const handleKeyClick = (digit: string) => {
    setErrorMsg('');
    if (pinInput.length < 6) {
      const newPin = pinInput + digit;
      setPinInput(newPin);

      // Auto submit on 6 digits
      if (newPin.length === 6) {
        processPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setPinInput('');
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPinInput('');
    }, 600);
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const processPin = async (enteredPin: string) => {
    if (isSettingUp) {
      if (setupStep === 'create') {
        setPinConfirmInput(enteredPin);
        setPinInput('');
        setSetupStep('confirm');
      } else {
        if (enteredPin === pinConfirmInput) {
          const success = await vaultService.setupPin(enteredPin);
          if (success) {
            setHasPin(true);
            setIsSettingUp(false);
            setIsUnlocked(true);
          } else {
            triggerError('Lỗi thiết lập mã PIN. Vui lòng thử lại.');
          }
        } else {
          triggerError('Mã PIN xác nhận không khớp! Vui lòng làm lại.');
          setSetupStep('create');
          setPinConfirmInput('');
        }
      }
    } else {
      const success = await vaultService.unlock(enteredPin);
      if (success) {
        setIsUnlocked(true);
      } else {
        triggerError('Mã PIN không chính xác!');
      }
    }
  };

  // Lock Vault
  const handleLock = () => {
    vaultService.lock();
    setIsUnlocked(false);
    setPinInput('');
    setVaultItems([]);
  };

  // Play decrypted media
  const handlePlay = async (vaultItem: VaultMediaItem) => {
    setDecryptingId(vaultItem.id);
    try {
      const mediaItem = await vaultService.getDecryptedMediaItem(vaultItem);
      onPlayVaultMedia(mediaItem);
    } catch (e) {
      alert('Không thể giải mã tệp này: ' + e);
    } finally {
      setDecryptingId(null);
    }
  };

  // Import files into vault
  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop() || '';
        await vaultService.encryptAndStoreFile(file, file.name, ext);
      }
      await loadVaultItems();
    } catch (err) {
      alert('Lỗi khi mã hóa tệp vào két: ' + err);
    } finally {
      setIsImporting(false);
    }
  };

  // Restore item to library
  const handleRestore = async (item: VaultMediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Khôi phục tệp này về Thư viện Media thông thường?')) {
      await vaultService.restoreToLibrary(item);
      await loadVaultItems();
    }
  };

  // Delete item permanently
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('XÓA VĨNH VIỄN tệp này khỏi Két bí mật? Không thể hoàn tác!')) {
      await vaultService.deleteItem(id);
      await loadVaultItems();
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  // -------------------------------------------------------------
  // Render Lock Screen if not unlocked
  // -------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 relative">
        {/* Back button */}
        <button
          onClick={onBackToLibrary}
          className="absolute top-4 left-4 flex items-center gap-2 px-3.5 py-2 rounded-full vision-glass hover:bg-white/10 text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về Thư viện</span>
        </button>

        {/* Lock Shield Icon & Header */}
        <div className="flex flex-col items-center text-center max-w-sm w-full mb-8">
          <div className="w-18 h-18 rounded-3xl vision-capsule flex items-center justify-center mb-4 text-emerald-400 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white tracking-wide">
            {isSettingUp 
              ? (setupStep === 'create' ? 'Tạo mã PIN Két bí mật' : 'Xác nhận lại mã PIN') 
              : 'Két Riêng Tư (Private Vault)'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {isSettingUp 
              ? 'Nhập 6 số để tạo mật khẩu bảo vệ media ẩn' 
              : 'Nhập mã PIN để giải mã và truy cập media riêng tư'}
          </p>

          {/* PIN Indicators Dots */}
          <div className={`flex items-center gap-3.5 my-6 ${shake ? 'animate-bounce' : ''}`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  pinInput.length > i 
                    ? 'bg-emerald-400 scale-110 shadow-[0_0_12px_rgba(52,211,153,0.8)]' 
                    : 'bg-white/20 border border-white/30'
                }`}
              />
            ))}
          </div>

          {errorMsg && (
            <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 mb-2">
              {errorMsg}
            </div>
          )}
        </div>

        {/* visionOS Circular Keypad */}
        <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyClick(digit)}
              className="w-18 h-18 mx-auto vision-btn-circle text-xl font-light text-white flex items-center justify-center cursor-pointer select-none active:scale-95"
            >
              {digit}
            </button>
          ))}

          <button
            onClick={handleClear}
            className="w-18 h-18 mx-auto vision-btn-circle text-xs font-semibold text-zinc-400 flex items-center justify-center cursor-pointer active:scale-95"
          >
            XÓA
          </button>

          <button
            onClick={() => handleKeyClick('0')}
            className="w-18 h-18 mx-auto vision-btn-circle text-xl font-light text-white flex items-center justify-center cursor-pointer select-none active:scale-95"
          >
            0
          </button>

          <button
            onClick={handleBackspace}
            className="w-18 h-18 mx-auto vision-btn-circle text-xs font-semibold text-zinc-400 flex items-center justify-center cursor-pointer active:scale-95"
          >
            ⌫
          </button>
        </div>

        {/* Security Badge */}
        <div className="mt-8 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mã hóa phần cứng AES-256-GCM độc lập</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render Unlocked Vault View
  // -------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar with visionOS Glass */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl vision-glass">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl vision-capsule flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            <Unlock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide">
                Két Riêng Tư (Private Vault)
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AES-256
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Đang mở khóa • {vaultItems.length} mục bí mật được bảo vệ
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Thêm vào Két</span>
            <input
              type="file"
              multiple
              accept="video/*,audio/*"
              onChange={handleImportFiles}
              className="hidden"
              disabled={isImporting}
            />
          </label>

          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full vision-btn-circle text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
            title="Khóa két ngay"
          >
            <Lock className="w-4 h-4 text-rose-400" />
            <span>Khóa Két</span>
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="p-3.5 rounded-2xl vision-glass border-emerald-500/20 flex items-center gap-3 text-xs text-zinc-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          Media trong Két đã được mã hóa AES-256. Khi phát, dữ liệu được giải mã trực tiếp trong bộ nhớ RAM và không bao giờ lộ ra bộ nhớ ngoài của điện thoại.
        </div>
      </div>

      {/* Loading & Importing status */}
      {isImporting && (
        <div className="p-4 rounded-2xl vision-glass text-center text-xs text-emerald-300 font-semibold animate-pulse">
          Đang mã hóa tệp vào Két bí mật (AES-256-GCM)...
        </div>
      )}

      {/* Grid of Vault Items */}
      {vaultItems.length === 0 && !isLoading ? (
        <div className="p-14 text-center rounded-3xl vision-glass flex flex-col items-center gap-4">
          <div className="p-4 rounded-full vision-btn-circle text-zinc-500">
            <Lock className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-200">Két bí mật đang trống</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              Bấm nút "Thêm vào Két" ở trên hoặc chọn "Chuyển vào Két ẩn" từ các video trong Thư viện để giấu media an toàn.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaultItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handlePlay(item)}
              className="vision-card p-4 flex flex-col justify-between gap-3 relative cursor-pointer group"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 rounded-2xl vision-capsule text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                  {item.type === 'video' ? <Film className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleRestore(item, e)}
                    className="p-1.5 rounded-xl vision-btn-circle text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Khôi phục về thư viện thường"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1.5 rounded-xl vision-btn-circle text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Xóa vĩnh viễn khỏi két"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Info */}
              <div>
                <h3 className="text-sm font-bold text-zinc-100 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-400 font-mono">
                  <span className="uppercase px-1.5 py-0.5 rounded-md vision-glass font-bold text-emerald-400 font-sans text-[10px]">
                    {item.format}
                  </span>
                  {item.sizeBytes && (
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-zinc-500" />
                      {formatBytes(item.sizeBytes)}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-zinc-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Play Badge */}
              <div className="pt-2 flex items-center justify-between border-t border-white/5 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  {decryptingId === item.id ? (
                    <>
                      <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-emerald-300">Đang giải mã trong RAM...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Chạm để giải mã & phát</span>
                    </>
                  )}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full vision-glass text-zinc-400">
                  Mã hóa AES-256
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
