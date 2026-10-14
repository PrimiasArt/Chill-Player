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
  LayoutGrid,
  List,
  ArrowUpDown,
  X,
  RotateCcw,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';
import type { MediaItem } from '../types';
import { db } from '../services/db';
import { mediaService } from '../services/mediaService';
import { vaultService } from '../services/vaultService';

interface MediaLibraryProps {
  items: MediaItem[];
  onPlayMedia: (item: MediaItem) => void;
  onOpenNetworkStream: () => void;
  onRefreshItems: () => Promise<void>;
  onOpenVault: () => void;
}

type SortOption = 'recent' | 'created' | 'name' | 'duration' | 'size';

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  items,
  onPlayMedia,
  onOpenNetworkStream,
  onRefreshItems,
  onOpenVault
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'stream' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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
    if (!secs || isNaN(secs) || secs <= 0) return '--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Relative time helper (e.g., "Vừa xong", "Hôm qua", "3 ngày trước")
  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return new Date(timestamp).toLocaleDateString();
  };

  // High-speed local files import with thumbnail extraction
  const handleImportFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: files.length });

    try {
      await mediaService.importLocalFiles(files, (current, total) => {
        setImportProgress({ current, total });
      });
      await onRefreshItems();
    } catch (e) {
      console.error('Import error:', e);
      alert('Có lỗi xảy ra khi nạp tệp media: ' + e);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleImportFiles(e.dataTransfer.files);
    }
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
    if (confirm('Bạn muốn xóa mục này khỏi Thư viện?')) {
      await mediaService.deleteMedia(id);
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
  const nonVaultItems = items.filter(item => !item.id.startsWith('vault_'));

  const filtered = nonVaultItems.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (activeTab === 'video') return item.type === 'video';
    if (activeTab === 'audio') return item.type === 'audio';
    if (activeTab === 'stream') return item.type === 'stream';
    if (activeTab === 'favorites') return item.isFavorite;
    return true;
  });

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
      case 'created':
        return (b.createdAt || 0) - (a.createdAt || 0);
      case 'name':
        return a.title.localeCompare(b.title);
      case 'duration':
        return (b.duration || 0) - (a.duration || 0);
      case 'size':
        return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      default:
        return 0;
    }
  });

  // Items to resume watching (watched > 0% and < 95%)
  const continueWatchingItems = nonVaultItems
    .filter(item => item.progressPercent > 2 && item.progressPercent < 95 && item.currentTime > 5)
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    .slice(0, 3);

  // Tab counts
  const videoCount = nonVaultItems.filter(i => i.type === 'video').length;
  const audioCount = nonVaultItems.filter(i => i.type === 'audio').length;
  const streamCount = nonVaultItems.filter(i => i.type === 'stream').length;
  const favCount = nonVaultItems.filter(i => i.isFavorite).length;

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="max-w-6xl mx-auto px-4 py-4 space-y-6 relative min-h-[85vh]"
    >
      {/* Fullscreen Drag & Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-emerald-400 pointer-events-none animate-in fade-in duration-150">
          <FolderOpen className="w-16 h-16 text-emerald-400 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold text-white tracking-wide">Thả tệp media vào đây</h2>
          <p className="text-sm text-emerald-200 mt-1">Hỗ trợ các định dạng video, nhạc MP4, MKV, MP3, FLAC...</p>
        </div>
      )}

      {/* Top Banner - visionOS Spatial Frosted Glass */}
      <div className="p-6 sm:p-7 rounded-3xl vision-glass flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Thư viện Media
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full vision-glass text-emerald-300 font-semibold border-emerald-500/30 font-mono">
              {items.length} tệp
            </span>
          </div>
          <p className="text-xs text-zinc-300 mt-1.5 max-w-xl font-light leading-relaxed">
            Trình phát không gian visionOS thuần khiết. Tải nhanh tức thì, trích xuất thumbnail tự động, cử chỉ vuốt MX Player và Két bí mật mã hóa AES-256.
          </p>
        </div>

        {/* Action Buttons - visionOS Glass Capsules */}
        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <label className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-95">
            <FolderPlus className="w-4 h-4" />
            <span>Mở tệp Media</span>
            <input
              type="file"
              multiple
              accept="video/*,audio/*,.mkv,.avi,.mp4,.webm,.m3u8,.mp3,.flac,.wav,.aac,.ts"
              onChange={(e) => {
                if (e.target.files) {
                  handleImportFiles(e.target.files);
                }
              }}
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

      {/* Importing Progress Toast */}
      {isImporting && importProgress && (
        <div className="p-3.5 rounded-2xl vision-glass border border-emerald-500/30 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            <div>
              <span className="text-xs font-bold text-white">Đang nạp và trích xuất thumbnail...</span>
              <span className="text-[11px] text-zinc-400 font-mono block">
                Tệp {importProgress.current} / {importProgress.total}
              </span>
            </div>
          </div>
          <div className="w-28 sm:w-44 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* "Tiếp tục xem" (Continue Watching) Featured Hero */}
      {continueWatchingItems.length > 0 && !searchQuery && activeTab === 'all' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider px-1">
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tiếp tục xem</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {continueWatchingItems.map((item) => (
              <div
                key={`resume_${item.id}`}
                onClick={() => onPlayMedia(item)}
                className="vision-card p-3 rounded-3xl flex items-center gap-3.5 relative cursor-pointer group hover:border-emerald-500/40 transition-all overflow-hidden"
              >
                {/* Thumbnail / Art */}
                <div className="relative w-28 sm:w-32 aspect-video rounded-2xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                  {item.thumbnailUrl ? (
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950/40 to-zinc-900">
                      <Film className="w-6 h-6 text-zinc-600" />
                    </div>
                  )}

                  {/* Play icon overlay */}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 transform group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Bottom progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                    <div 
                      className="h-full bg-emerald-400" 
                      style={{ width: `${item.progressPercent}%` }} 
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 pr-1">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 font-mono">
                    <span className="text-emerald-400 font-bold">{item.progressPercent}%</span>
                    <span>•</span>
                    <span>Còn {formatDuration(Math.max(0, item.duration - item.currentTime))}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-1 block">
                    {formatRelativeTime(item.lastPlayedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs & Search & Sort Controls Toolbar */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Tabs Capsule */}
          <div className="flex items-center gap-1 p-1 rounded-full vision-capsule self-start overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'Tất cả', count: nonVaultItems.length },
              { id: 'video', label: 'Video', icon: Film, count: videoCount },
              { id: 'audio', label: 'Audio', icon: Music, count: audioCount },
              { id: 'stream', label: 'Stream', icon: Globe, count: streamCount },
              { id: 'favorites', label: 'Yêu thích', icon: Heart, count: favCount }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeTab === tab.id ? 'bg-zinc-950/20 text-zinc-900' : 'bg-white/10 text-zinc-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
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

          {/* Search Input & View Controls */}
          <div className="flex items-center gap-2">
            {/* Search Input - visionOS Pill */}
            <div className="relative flex-1 sm:w-60">
              <input
                type="text"
                placeholder="Tìm phim, video..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 pr-7 rounded-full vision-glass text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-0.5 p-1 rounded-full vision-capsule shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Dạng lưới"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Dạng danh sách"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
          <span className="font-mono text-[11px]">Hiển thị {sorted.length} mục</span>

          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3 h-3 text-zinc-500" />
            <span className="text-[11px] text-zinc-400">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-white font-medium text-xs rounded-full px-2 py-1 vision-glass border-none focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-zinc-900 text-white">Gần đây</option>
              <option value="created" className="bg-zinc-900 text-white">Mới thêm</option>
              <option value="name" className="bg-zinc-900 text-white">Tên A-Z</option>
              <option value="duration" className="bg-zinc-900 text-white">Thời lượng</option>
              <option value="size" className="bg-zinc-900 text-white">Dung lượng</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Media Items */}
      {sorted.length === 0 ? (
        <div className="p-14 text-center rounded-3xl vision-glass flex flex-col items-center gap-4">
          <div className="p-4 rounded-full vision-btn-circle text-zinc-500">
            <FileVideo className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-200">
              {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có tệp media nào'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              {searchQuery 
                ? `Không có tệp nào khớp với "${searchQuery}". Hãy thử từ khóa khác.` 
                : 'Bấm nút "Mở tệp Media" để chọn phim từ bộ nhớ hoặc kéo thả video trực tiếp vào đây.'}
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW (16:9 Visual Cards) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {sorted.map((item) => (
            <div
              key={item.id}
              onClick={() => onPlayMedia(item)}
              className="vision-card rounded-3xl p-3 flex flex-col justify-between gap-3 relative cursor-pointer group hover:border-white/25 transition-all overflow-hidden"
            >
              {/* 16:9 Thumbnail Image Container */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 shrink-0">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900">
                    {item.type === 'video' ? (
                      <Film className="w-8 h-8 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                    ) : item.type === 'audio' ? (
                      <Music className="w-8 h-8 text-zinc-600 group-hover:text-sky-400 transition-colors" />
                    ) : (
                      <Globe className="w-8 h-8 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                    )}
                  </div>
                )}

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.6)] transform scale-90 group-hover:scale-100 transition-all">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Top Left Format Badge */}
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span className="uppercase px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-emerald-400 font-sans font-bold text-[9px] border border-white/15">
                    {item.format || item.type}
                  </span>
                </div>

                {/* Bottom Right Duration Badge */}
                {item.duration > 0 && (
                  <div className="absolute bottom-2.5 right-2.5 z-10">
                    <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-mono text-[10px] font-semibold border border-white/10">
                      {formatDuration(item.duration)}
                    </span>
                  </div>
                )}

                {/* Bottom Progress Bar */}
                {item.progressPercent > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                    <div
                      className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="px-1 flex flex-col justify-between flex-1 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-emerald-300 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400 font-mono">
                    {item.sizeBytes && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-zinc-500" />
                        {formatBytes(item.sizeBytes)}
                      </span>
                    )}
                    <span>•</span>
                    <span>{formatRelativeTime(item.lastPlayedAt)}</span>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="text-[10px] text-zinc-400">
                    {item.progressPercent > 0 ? (
                      <span className="text-emerald-400 font-mono font-semibold">Đã xem {item.progressPercent}%</span>
                    ) : (
                      <span className="text-zinc-500">Chưa xem</span>
                    )}
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW (Compact Rows) */
        <div className="space-y-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              onClick={() => onPlayMedia(item)}
              className="vision-card rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer group hover:border-white/25 transition-all"
            >
              {/* Mini 16:9 Thumbnail */}
              <div className="relative w-20 sm:w-24 aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-white/10 shrink-0">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    {item.type === 'video' ? <Film className="w-4 h-4 text-zinc-500" /> : <Music className="w-4 h-4 text-zinc-500" />}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-4 h-4 fill-current text-emerald-400" />
                </div>
              </div>

              {/* Title & Details */}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 font-mono">
                  <span className="uppercase text-emerald-400 font-bold">{item.format || item.type}</span>
                  <span>•</span>
                  <span>{formatDuration(item.duration)}</span>
                  {item.sizeBytes && (
                    <>
                      <span>•</span>
                      <span>{formatBytes(item.sizeBytes)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => handleMoveToVault(item, e)}
                  disabled={movingId === item.id}
                  className="p-1.5 rounded-xl vision-btn-circle text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Ẩn vào Két bí mật"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => handleToggleFavorite(item, e)}
                  className={`p-1.5 rounded-xl vision-btn-circle transition-colors cursor-pointer ${
                    item.isFavorite ? 'text-rose-400' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={(e) => handleDeleteItem(item.id, e)}
                  className="p-1.5 rounded-xl vision-btn-circle text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
