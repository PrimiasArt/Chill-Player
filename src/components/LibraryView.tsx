import React, { useState } from 'react';
import { 
  BookOpen, 
  Headphones, 
  Heart, 
  Trash2, 
  Search, 
  FolderPlus, 
  Compass, 
  Clock, 
  Layers,
  Sparkles
} from 'lucide-react';
import type { Story } from '../types';

interface LibraryViewProps {
  stories: Story[];
  onOpenStory: (story: Story, mode: 'read' | 'listen') => void;
  onToggleFavorite: (storyId: string) => void;
  onDeleteStory: (storyId: string) => void;
  onOpenImport: () => void;
  onOpenCrawler: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  stories,
  onOpenStory,
  onToggleFavorite,
  onDeleteStory,
  onOpenImport,
  onOpenCrawler
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'reading' | 'favorites'>('all');

  const filteredStories = stories.filter(story => {
    const matchesSearch = 
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.author.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'reading') return story.currentProgressPercent > 0;
    if (filterTab === 'favorites') return story.isFavorite;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            Tủ sách của bạn
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
              {stories.length} cuốn
            </span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Không gian đọc & nghe truyện riêng tư, mượt mà và không quảng cáo
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            Nạp file truyện
          </button>
          <button
            onClick={onOpenCrawler}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm border border-zinc-700 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4 text-amber-400" />
            Tìm truyện online
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-800/80 rounded-xl border border-zinc-700/60 self-start">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTab === 'all'
                ? 'bg-zinc-700 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tất cả ({stories.length})
          </button>
          <button
            onClick={() => setFilterTab('reading')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTab === 'reading'
                ? 'bg-zinc-700 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Đang đọc ({stories.filter(s => s.currentProgressPercent > 0).length})
          </button>
          <button
            onClick={() => setFilterTab('favorites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTab === 'favorites'
                ? 'bg-zinc-700 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Yêu thích ({stories.filter(s => s.isFavorite).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên truyện hoặc tác giả..."
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Stories Grid */}
      {filteredStories.length === 0 ? (
        <div className="bg-zinc-800/40 border border-dashed border-zinc-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-1">
            {searchQuery ? 'Không tìm thấy truyện phù hợp' : 'Tủ sách của bạn còn trống'}
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
            {searchQuery
              ? 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
              : 'Hãy nạp file truyện chữ (.txt, .epub, .pdf) từ máy tính hoặc tìm kiếm và cào truyện online.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenImport}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-sm transition-all"
            >
              Nạp file (.txt, .epub, .pdf)
            </button>
            <button
              onClick={onOpenCrawler}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm border border-zinc-700 transition-all"
            >
              Khám phá truyện online
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStories.map((story) => (
            <div
              key={story.id}
              className="group relative bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-black/30"
            >
              {/* Cover & Main Info */}
              <div>
                <div className="flex gap-3 mb-3">
                  {/* Book Cover */}
                  <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700/80 shadow-md shrink-0 flex items-center justify-center">
                    {story.coverUrl ? (
                      <img
                        src={story.coverUrl}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="p-2 text-center">
                        <Sparkles className="w-5 h-5 text-amber-400/60 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-zinc-300 line-clamp-3 leading-tight">
                          {story.title}
                        </span>
                      </div>
                    )}
                    {/* Source Badge */}
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[9px] uppercase font-bold bg-zinc-950/80 text-zinc-300 backdrop-blur-xs">
                      {story.source.replace('local_', '')}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug group-hover:text-amber-300 transition-colors">
                        {story.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 truncate">
                        {story.author}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-2">
                      <Layers className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{story.totalChapters} chương</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      Chương {story.currentChapterNumber || 1}/{story.totalChapters}
                    </span>
                    <span className="font-medium text-amber-400">
                      {Math.round(story.currentProgressPercent || 0)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(2, story.currentProgressPercent || 0))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-700/50">
                <button
                  onClick={() => onOpenStory(story, 'read')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  Đọc tiếp
                </button>

                <button
                  onClick={() => onOpenStory(story, 'listen')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  Nghe audio
                </button>

                <button
                  onClick={() => onToggleFavorite(story.id)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    story.isFavorite
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : 'border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={story.isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                >
                  <Heart className="w-3.5 h-3.5" fill={story.isFavorite ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Bạn có chắc muốn xóa truyện "${story.title}" khỏi tủ sách?`)) {
                      onDeleteStory(story.id);
                    }
                  }}
                  className="p-1.5 rounded-lg border border-zinc-700/50 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Xóa truyện"
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
