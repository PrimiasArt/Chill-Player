import React, { useState } from 'react';
import { 
  FolderPlus, 
  Globe, 
  Search, 
  Film, 
  Music, 
  Heart, 
  Trash2, 
  Play, 
  Clock, 
  FileVideo, 
  Layers, 
  Sparkles, 
  HardDrive,
  Lock,
  ShieldCheck
} from 'lucide-react';
import type { MediaItem } from '../types';
import { db } from '../services/db';
import { vaultService } from '../services/vaultService';

interface MediaLibraryProps {
  items: MediaItem[];
  onPlayMedia: (item: MediaItem) => void;
  onOpenNetworkStream: () => void;
  onRefreshItems: () => Promise<void>;
  onOpenVault: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  items,
  onPlayMedia,
  onOpenNetworkStream,
  onRefreshItems,
  onOpenVault
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'stream' | 'favorites'>('all');
  const [movingId, setMovingId] = useState<string | null>(null);

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  // Format seconds to mm:ss or hh:mm:ss
  const formatDuration = (secs?: number) => {
    if (!secs || isNaN(secs)) return '--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // File Picker for local files
  const handleLocalFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video') || /\.(mp4|mkv|webm|avi|mov|flv|3gp|m4v)$/i.test(file.name);
      const isAudio = file.type.startsWith('audio') || /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(file.name);
      const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'mp3');

      const url = URL.createObjectURL(file);

      const newItem: MediaItem = {
        id: `local_${Date.now()}_${i}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        url,
        fileBlob: file, // Persist blob data
        type: isVideo ? 'video' : 'audio',
        duration: 0,
        currentTime: 0,
        progressPercent: 0,
        sizeBytes: file.size,
        format: ext,
        isFavorite: false,
        lastPlayedAt: Date.now(),
        createdAt: Date.now()
      };

      await db.mediaItems.put(newItem);
    }

    await onRefreshItems();
  };

  // Move item to encrypted vault
  const handleMoveToVault = async (item: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!vaultService.isUnlocked()) {
      alert('Vui lòng mở khóa Két riêng tư (Private Vault) trước khi chuyển tệp vào!');
      onOpenVault();
      return;
    }

    if (confirm(`Bạn muốn mã hóa và chuyển "${item.title}" vào Két bí mật? Tệp sẽ biến mất hoàn toàn khỏi Thư viện của ứng dụng.`)) {
      setMovingId(item.id);
      try {
        const ok = await vaultService.moveItemToVault(item);
        if (ok) {
          await onRefreshItems();
          alert(
            `Đã chuyển "${item.title}" vào Két bí mật an toàn! 🔒\n\n` +
            `• Media đã được mã hóa AES-256 và biến mất khỏi Thư viện app.\n` +
            `• Để ẩn hoàn toàn khỏi thiết bị, bạn hãy xóa file gốc trong Bộ sưu tập của máy.`
          );
        } else {
          alert('Không thể chuyển tệp vào Két. Vui lòng kiểm tra lại.');
        }
      } catch (err) {
        alert('Lỗi: ' + err);
      } finally {
        setMovingId(null);
      }
    }
  };

  // Delete media item
  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bạn muốn xóa mục này khỏi danh sách?')) {
      await db.mediaItems.delete(id);
      await onRefreshItems();
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (item: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.mediaItems.update(item.id, { isFavorite: !item.isFavorite });
    await onRefreshItems();
  };

  // Filter items
  const filtered = items.filter(item => {
    // Strictly isolate: NEVER show vault items in public library
    if (item.id.startsWith('vault_')) return false;

    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (activeTab === 'video') return item.type === 'video';
    if (activeTab === 'audio') return item.type === 'audio';
    if (activeTab === 'stream') return item.type === 'stream';
    if (activeTab === 'favorites') return item.isFavorite;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">
      {/* Top Banner - visionOS Spatial Frosted Glass */}
      <div className="p-6 rounded-3xl vision-glass flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute -right-16 -top-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-52 h-52 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Thư viện Media
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full vision-glass text-emerald-300 font-semibold border-emerald-500/30">
              {items.length} mục
            </span>
          </div>
          <p className="text-xs text-zinc-300 mt-1 max-w-lg font-light leading-relaxed">
            Trình phát đa phương tiện thuần khiết theo ngôn ngữ Apple visionOS. Cử chỉ vuốt chạm chuẩn MX Player, khuếch đại âm lượng 200% và bảo mật két ẩn AES-256.
          </p>
        </div>

        {/* Action Buttons - visionOS Glass Capsules */}
        <div className="flex items-center gap-2.5 relative z-10">
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-95">
            <FolderPlus className="w-4 h-4" />
            <span>Mở tệp Media</span>
            <input
              type="file"
              multiple
              accept="video/*,audio/*,.mkv,.avi,.mp4,.webm,.m3u8,.mp3,.flac,.wav,.aac"
              onChange={handleLocalFilesUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={onOpenNetworkStream}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full vision-btn-circle text-zinc-200 font-semibold text-xs transition-all cursor-pointer"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Stream URL</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search - visionOS Floating Pill Navigation */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Tabs Capsule */}
        <div className="flex items-center gap-1 p-1 rounded-full vision-capsule self-start overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'video', label: 'Video', icon: Film },
            { id: 'audio', label: 'Audio', icon: Music },
            { id: 'stream', label: 'Trực tuyến', icon: Globe },
            { id: 'favorites', label: 'Yêu thích', icon: Heart }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          ))}

          {/* Quick link to Vault */}
          <button
            onClick={onOpenVault}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer whitespace-nowrap border-l border-white/10 pl-3 ml-1"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Két Bí Mật</span>
          </button>
        </div>

        {/* Search Input - visionOS Pill */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Tìm phim, video, bài hát..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 pl-9 rounded-full vision-glass text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
          />
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Grid of Media Items */}
      {filtered.length === 0 ? (
        <div className="p-14 text-center rounded-3xl vision-glass flex flex-col items-center gap-4">
          <div className="p-4 rounded-full vision-btn-circle text-zinc-500">
            <FileVideo className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-200">Chưa có tệp media nào</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              Bấm nút "Mở tệp Media" để chọn phim từ bộ nhớ hoặc mở đường link trực tiếp Stream URL.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.fileBlob) {
                  item.url = URL.createObjectURL(item.fileBlob);
                }
                onPlayMedia(item);
              }}
              className="vision-card p-4.5 flex flex-col justify-between gap-3 relative cursor-pointer group"
            >
              {/* Media Card Top Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 rounded-2xl vision-capsule text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform shadow-md shadow-emerald-500/10">
                  {item.type === 'video' ? <Film className="w-5 h-5" /> : item.type === 'audio' ? <Music className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                </div>

                <div className="flex items-center gap-1">
                  {/* Move to Vault Button */}
                  <button
                    onClick={(e) => handleMoveToVault(item, e)}
                    disabled={movingId === item.id}
                    className="p-1.5 rounded-xl vision-btn-circle text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Ẩn vào Két bí mật (Mã hóa AES-256)"
                  >
                    <Lock className={`w-3.5 h-3.5 ${movingId === item.id ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => handleToggleFavorite(item, e)}
                    className={`p-1.5 rounded-xl vision-btn-circle transition-colors cursor-pointer ${
                      item.isFavorite ? 'text-rose-400' : 'text-zinc-400 hover:text-white'
                    }`}
                    title={item.isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="p-1.5 rounded-xl vision-btn-circle text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Xóa mục"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title & Info */}
              <div>
                <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-emerald-300 transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-400 font-mono">
                  <span className="uppercase px-1.5 py-0.5 rounded-md vision-glass font-bold text-emerald-400 font-sans text-[10px]">
                    {item.format || item.type}
                  </span>
                  {item.duration > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formatDuration(item.duration)}
                    </span>
                  )}
                  {item.sizeBytes && (
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-zinc-500" />
                      {formatBytes(item.sizeBytes)}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar (if watched) */}
              {item.progressPercent > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Đã xem {item.progressPercent}%</span>
                    <span>{formatDuration(item.currentTime)}</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Play Hint */}
              <div className="pt-2 flex items-center justify-between border-t border-white/5 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1 text-emerald-400 font-medium group-hover:translate-x-1 transition-transform">
                  <Play className="w-3 h-3 fill-current" />
                  <span>Phát ngay</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {new Date(item.lastPlayedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
