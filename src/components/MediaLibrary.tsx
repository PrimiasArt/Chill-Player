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
  HardDrive
} from 'lucide-react';
import type { MediaItem } from '../types';
import { db } from '../services/db';

interface MediaLibraryProps {
  items: MediaItem[];
  onPlayMedia: (item: MediaItem) => void;
  onOpenNetworkStream: () => void;
  onRefreshItems: () => Promise<void>;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  items,
  onPlayMedia,
  onOpenNetworkStream,
  onRefreshItems
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'stream' | 'favorites'>('all');

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
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (activeTab === 'video') return item.type === 'video';
    if (activeTab === 'audio') return item.type === 'audio';
    if (activeTab === 'stream') return item.type === 'stream';
    if (activeTab === 'favorites') return item.isFavorite;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <span>Thư viện Media</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
              {items.length} mục
            </span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Trình phát video & audio cá nhân siêu mượt, hỗ trợ cử chỉ và tăng âm lượng 200%
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs border border-zinc-700/80 transition-all cursor-pointer"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Mở Stream URL</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 self-start">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === tab.id ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Tìm video, audio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 pl-8 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Grid of Media Items */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-zinc-800/80 text-zinc-500">
            <FileVideo className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-200">Chưa có tệp media nào</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              Bấm nút "Mở tệp Media" để chọn phim ảnh từ máy tính hoặc "Mở Stream URL" để xem luồng trực tiếp.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => onPlayMedia(item)}
              className="group p-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/70 border border-zinc-800 hover:border-emerald-500/40 shadow-lg hover:shadow-emerald-500/5 transition-all cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden"
            >
              {/* Media Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-800/90 text-emerald-400 border border-zinc-700/60 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">
                  {item.type === 'video' ? <Film className="w-5 h-5" /> : item.type === 'audio' ? <Music className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleFavorite(item, e)}
                    className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer ${
                      item.isFavorite ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title={item.isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  >
                    <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Xóa mục"
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
                  <span className="uppercase px-1.5 py-0.5 rounded bg-zinc-800 font-bold text-emerald-400 font-sans text-[10px]">
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
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
