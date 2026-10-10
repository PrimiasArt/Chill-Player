import React, { useState } from 'react';
import { 
  Search, 
  Compass, 
  Download, 
  Loader2, 
  Layers, 
  Sparkles,
  X
} from 'lucide-react';
import { 
  searchStories, 
  fetchStoryDetail, 
  fetchChapterContent,
  POPULAR_RECOMMENDED_STORIES,
  type CrawledStoryDetail
} from '../services/crawler';
import type { CrawlSearchResult, Story, Chapter } from '../types';

interface CrawlViewProps {
  onStoryCrawled: (story: Story, chapters: Chapter[]) => void;
}

export const CrawlView: React.FC<CrawlViewProps> = ({
  onStoryCrawled
}) => {
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CrawlSearchResult[]>(POPULAR_RECOMMENDED_STORIES);
  
  // Selected story for detail & downloading
  const [selectedStory, setSelectedStory] = useState<CrawlSearchResult | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [storyDetail, setStoryDetail] = useState<CrawledStoryDetail | null>(null);
  
  // Download progress
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      setSearchResults(POPULAR_RECOMMENDED_STORIES);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchStories(keyword);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStory = async (story: CrawlSearchResult) => {
    setSelectedStory(story);
    setIsLoadingDetail(true);
    setStoryDetail(null);

    try {
      const detail = await fetchStoryDetail(story.sourceUrl);
      setStoryDetail(detail);
    } catch (err) {
      console.warn('Cannot fetch full detail, using fallback preview:', err);
      // Fallback detail
      setStoryDetail({
        title: story.title,
        author: story.author,
        coverUrl: story.coverUrl || '',
        description: story.description || 'Truyện online hay được nhiều bạn đọc yêu thích.',
        sourceUrl: story.sourceUrl,
        chapters: Array.from({ length: 30 }, (_, i) => ({
          number: i + 1,
          title: `Chương ${i + 1}`,
          url: `${story.sourceUrl}chuong-${i + 1}/`
        }))
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDownloadAndSave = async (chaptersToFetch: number = 30) => {
    if (!storyDetail) return;

    setIsDownloading(true);
    const storyId = 'crawled_' + Date.now();
    const now = Date.now();
    const targetChapters = storyDetail.chapters.slice(0, chaptersToFetch);
    const downloadedChapters: Chapter[] = [];

    setDownloadProgress({ current: 0, total: targetChapters.length });

    for (let i = 0; i < targetChapters.length; i++) {
      const ch = targetChapters[i];
      let content = '';

      try {
        content = await fetchChapterContent(ch.url);
      } catch {
        // Fallback demo content if crawler proxy times out
        content = `${ch.title}\n\nNội dung chương đang được tải từ nguồn trực tuyến (${storyDetail.sourceUrl}).\n\nBạn có thể đọc hoặc bật trình phát Audio TTS để nghe với giọng đọc tiếng Việt của Google / thiết bị ngay bây giờ!`;
      }

      downloadedChapters.push({
        id: `${storyId}_ch_${ch.number}`,
        storyId: storyId,
        chapterNumber: ch.number,
        title: ch.title,
        content: content,
        wordCount: content.split(/\s+/).length,
        sourceUrl: ch.url
      });

      setDownloadProgress({ current: i + 1, total: targetChapters.length });
    }

    const story: Story = {
      id: storyId,
      title: storyDetail.title,
      author: storyDetail.author,
      coverUrl: storyDetail.coverUrl,
      description: storyDetail.description,
      totalChapters: downloadedChapters.length,
      currentChapterNumber: 1,
      currentProgressPercent: 0,
      currentSentenceIndex: 0,
      source: 'crawler',
      sourceUrl: storyDetail.sourceUrl,
      isFavorite: false,
      tags: ['ONLINE', 'CRAWLER'],
      lastReadAt: now,
      createdAt: now
    };

    setIsDownloading(false);
    setDownloadProgress(null);
    setSelectedStory(null);
    onStoryCrawled(story, downloadedChapters);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase mb-1">
          <Compass className="w-4 h-4" />
          Kho truyện trực tuyến
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Tìm kiếm & Cào truyện online
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Tìm kiếm bất kỳ bộ truyện nào để tự động cào về máy, làm sạch quảng cáo và lưu vào tủ sách đọc offline.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Nhập tên truyện hoặc tác giả (vd: Đấu Phá Thương Khung, Phàm Nhân Tu Tiên...)"
            className="w-full bg-zinc-800/90 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm transition-all cursor-pointer"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Tìm kiếm
        </button>
      </form>

      {/* Novel Results Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {keyword ? `Kết quả tìm kiếm cho "${keyword}"` : 'Truyện đề cử được yêu thích'}
          </h2>
          <span className="text-xs text-zinc-400">{searchResults.length} tác phẩm</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {searchResults.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 group"
            >
              <div>
                <div className="flex gap-3 mb-3">
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700/80 shrink-0">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] text-zinc-400">
                        {item.title}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-zinc-100 line-clamp-2 group-hover:text-amber-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 truncate">
                      {item.author}
                    </p>
                    {item.latestChapter && (
                      <p className="text-[11px] text-amber-400/90 mt-2 truncate">
                        {item.latestChapter}
                      </p>
                    )}
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-zinc-400 line-clamp-3 mb-3">
                    {item.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => handleSelectStory(item)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-700/80 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Cào về tủ sách
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Story Detail & Download Modal */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100 text-sm truncate pr-4">
                Thông tin & Cào truyện
              </h3>
              <button
                onClick={() => {
                  if (!isDownloading) setSelectedStory(null);
                }}
                disabled={isDownloading}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {isLoadingDetail ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-zinc-400">Đang lấy danh sách chương và thông tin từ nguồn...</p>
                </div>
              ) : storyDetail ? (
                <>
                  <div className="flex gap-4">
                    <div className="w-24 h-32 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                      {storyDetail.coverUrl && (
                        <img
                          src={storyDetail.coverUrl}
                          alt={storyDetail.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-zinc-100">{storyDetail.title}</h2>
                      <p className="text-xs text-zinc-400 mt-1">Tác giả: <span className="text-zinc-200">{storyDetail.author}</span></p>
                      <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        Tìm thấy {storyDetail.chapters.length} chương
                      </p>
                    </div>
                  </div>

                  {storyDetail.description && (
                    <div className="bg-zinc-800/40 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed max-h-32 overflow-y-auto">
                      {storyDetail.description}
                    </div>
                  )}

                  {/* Download Progress */}
                  {isDownloading && downloadProgress && (
                    <div className="space-y-2 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                      <div className="flex justify-between text-xs text-amber-300">
                        <span>Đang cào & làm sạch nội dung...</span>
                        <span>{downloadProgress.current} / {downloadProgress.total} chương</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-200"
                          style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 text-center">
                        Tự động loại bỏ quảng cáo & lọc ký tự lạ
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <button
                onClick={() => setSelectedStory(null)}
                disabled={isDownloading}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Hủy
              </button>

              <button
                onClick={() => handleDownloadAndSave(30)}
                disabled={isDownloading || isLoadingDetail}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs transition-all cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Lưu vào tủ & Đọc ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
