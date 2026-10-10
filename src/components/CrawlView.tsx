import React, { useState } from 'react';
import { 
  Search, 
  Compass, 
  Download, 
  Loader2, 
  Layers, 
  Sparkles,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { 
  searchStories, 
  fetchStoryDetail, 
  fetchChapterContent,
  batchDownloadChapters,
  generateStoryId,
  POPULAR_RECOMMENDED_STORIES,
  type CrawledStoryDetail
} from '../services/crawler';
import { db } from '../services/db';
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
  const [detailError, setDetailError] = useState<string | null>(null);

  // Existing local chapters in IndexedDB
  const [existingLocalChapters, setExistingLocalChapters] = useState<Chapter[]>([]);

  // Chapter range selection
  const [fromChapter, setFromChapter] = useState<number>(1);
  const [toChapter, setToChapter] = useState<number>(50);
  const [skipExisting, setSkipExisting] = useState<boolean>(true);

  // Preview state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ title: string; content: string } | null>(null);
  
  // Download progress
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; title?: string } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
    setDetailError(null);
    setPreviewContent(null);
    setDownloadError(null);
    setExistingLocalChapters([]);

    try {
      const storyId = generateStoryId(story.sourceUrl, story.title);
      const [detail, localChs] = await Promise.all([
        fetchStoryDetail(story.sourceUrl),
        db.getStoryChapters(storyId).catch(() => [] as Chapter[])
      ]);

      setStoryDetail(detail);
      setExistingLocalChapters(localChs);

      const maxLocal = localChs.length > 0 ? Math.max(...localChs.map(c => c.chapterNumber)) : 0;
      const start = maxLocal > 0 ? maxLocal + 1 : 1;
      const totalCh = detail.totalChapters || detail.chapters.length || 50;
      const end = Math.min(totalCh, maxLocal > 0 ? maxLocal + 50 : 50);

      setFromChapter(start);
      setToChapter(Math.max(start, end));
      setSkipExisting(true);
    } catch (err: any) {
      console.error('Cannot fetch story detail:', err);
      setDetailError(err.message || 'Không thể tải chi tiết truyện từ nguồn.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handlePreviewChapterOne = async () => {
    if (!storyDetail || storyDetail.chapters.length === 0) return;
    setIsPreviewLoading(true);
    setPreviewContent(null);

    try {
      const ch1 = storyDetail.chapters[0];
      const data = await fetchChapterContent(ch1.url);
      setPreviewContent({
        title: data.title || ch1.title,
        content: data.content
      });
    } catch (err: any) {
      alert('Lỗi xem thử: ' + (err.message || 'Không tải được chương 1'));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownloadAndSave = async () => {
    if (!storyDetail || storyDetail.chapters.length === 0) return;

    const start = Math.max(1, Math.min(fromChapter, toChapter));
    const end = Math.min(storyDetail.chapters.length, Math.max(fromChapter, toChapter));

    // Slice all chapters in selected range
    const rangeChapters = storyDetail.chapters.slice(start - 1, end);

    const existingSet = new Set(existingLocalChapters.map(c => c.chapterNumber));
    const targetChapters = skipExisting
      ? rangeChapters.filter(c => !existingSet.has(c.number))
      : rangeChapters;

    if (targetChapters.length === 0) {
      alert(`Tất cả các chương từ ${start} đến ${end} đã có sẵn trong tủ sách của bạn!`);
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ current: 0, total: targetChapters.length, title: 'Bắt đầu kết nối...' });

    try {
      const downloadedResults = await batchDownloadChapters(targetChapters, (curr, tot, title) => {
        setDownloadProgress({ current: curr, total: tot, title });
      });

      const storyId = generateStoryId(storyDetail.sourceUrl, storyDetail.title);
      const now = Date.now();
      const validChapters: Chapter[] = [];

      downloadedResults.forEach((res) => {
        if (res.success && res.content && res.content.trim().length > 30) {
          const chMeta = targetChapters.find(tc => tc.url === res.url);
          const chNum = chMeta ? chMeta.number : 1;

          validChapters.push({
            id: `${storyId}_ch_${chNum}`,
            storyId: storyId,
            chapterNumber: chNum,
            title: res.title || chMeta?.title || `Chương ${chNum}`,
            content: res.content,
            wordCount: res.wordCount || res.content.split(/\s+/).length,
            sourceUrl: res.url
          });
        }
      });

      if (validChapters.length === 0) {
        throw new Error('Không thể tải được nội dung thực tế của các chương từ nguồn. Vui lòng thử lại sau.');
      }

      const existingStory = await db.stories.get(storyId);
      const story: Story = {
        id: storyId,
        title: storyDetail.title,
        author: storyDetail.author,
        coverUrl: storyDetail.coverUrl || existingStory?.coverUrl || '',
        description: storyDetail.description || existingStory?.description || storyDetail.title,
        totalChapters: validChapters.length,
        currentChapterNumber: existingStory?.currentChapterNumber || 1,
        currentProgressPercent: existingStory?.currentProgressPercent || 0,
        currentSentenceIndex: existingStory?.currentSentenceIndex || 0,
        source: 'crawler',
        sourceUrl: storyDetail.sourceUrl,
        isFavorite: existingStory?.isFavorite || false,
        tags: ['ONLINE', 'CRAWLER'],
        lastReadAt: existingStory?.lastReadAt || now,
        createdAt: existingStory?.createdAt || now
      };

      setIsDownloading(false);
      setDownloadProgress(null);
      setSelectedStory(null);
      onStoryCrawled(story, validChapters);
    } catch (err: any) {
      console.error('Download error:', err);
      setIsDownloading(false);
      setDownloadError(err.message || 'Lỗi trong quá trình tải chương.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase mb-1">
          <Compass className="w-4 h-4" />
          Kho truyện trực tuyến siêu tốc
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Tìm kiếm & Cào truyện online
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Cào truyện tốc độ cao, trích xuất dữ liệu thật 100%, tự động làm sạch quảng cáo và lưu vào tủ sách offline.
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
            placeholder="Nhập tên truyện (vd: Đấu Phá Thương Khung, Phàm Nhân Tu Tiên, Mục Thần Ký...)"
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
            {keyword ? `Kết quả tìm kiếm cho "${keyword}"` : 'Truyện đề cử phổ biến'}
          </h2>
          <span className="text-xs text-zinc-400">{searchResults.length} tác phẩm</span>
        </div>

        {searchResults.length === 0 ? (
          <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-2xl p-8 text-center max-w-md mx-auto my-8">
            <BookOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
            <p className="text-zinc-300 font-semibold text-sm">Không tìm thấy truyện phù hợp</p>
            <p className="text-xs text-zinc-500 mt-1">
              Hãy thử tìm kiếm với từ khóa khác hoặc ngắn gọn hơn (ví dụ: <span className="text-amber-400">Đấu Phá</span>, <span className="text-amber-400">Kiếm Lai</span>, <span className="text-amber-400">Phàm Nhân</span>).
            </p>
          </div>
        ) : (
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
                          loading="lazy"
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
                        <p className="text-[11px] text-amber-400/90 mt-2 line-clamp-2 font-medium">
                          {item.latestChapter}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
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
        )}
      </div>

      {/* Story Detail & Download Modal */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100 text-sm truncate pr-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Thông tin & Tùy chọn cào truyện
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

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {isLoadingDetail ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-zinc-400">Đang phân tích danh sách chương từ nguồn...</p>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    Không thể kết nối đến nguồn truyện
                  </div>
                  <p>{detailError}</p>
                </div>
              ) : storyDetail ? (
                <>
                  <div className="flex gap-4">
                    <div className="w-24 h-32 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                      {storyDetail.coverUrl ? (
                        <img
                          src={storyDetail.coverUrl}
                          alt={storyDetail.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-zinc-500">
                          {storyDetail.title}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-base text-zinc-100 leading-snug">{storyDetail.title}</h2>
                      <p className="text-xs text-zinc-400 mt-1">Tác giả: <span className="text-zinc-200 font-medium">{storyDetail.author}</span></p>
                      <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1 font-semibold">
                        <Layers className="w-3.5 h-3.5" />
                        Tìm thấy {storyDetail.totalChapters} chương
                      </p>
                      
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handlePreviewChapterOne}
                          disabled={isPreviewLoading || isDownloading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer"
                        >
                          {isPreviewLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          Xem thử nội dung chương 1
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chapter 1 Preview Box */}
                  {previewContent && (
                    <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-amber-500/30 text-xs space-y-2">
                      <div className="flex items-center justify-between text-amber-400 font-semibold border-b border-zinc-800 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Nội dung thật từ nguồn: {previewContent.title}
                        </span>
                        <button 
                          onClick={() => setPreviewContent(null)}
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-zinc-300 max-h-36 overflow-y-auto whitespace-pre-line leading-relaxed font-serif text-[13px] pr-1">
                        {previewContent.content.slice(0, 700)}...
                      </div>
                    </div>
                  )}

                  {storyDetail.description && (
                    <div className="bg-zinc-800/40 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed max-h-24 overflow-y-auto">
                      {storyDetail.description}
                    </div>
                  )}

                  {/* Existing Local Chapters Status */}
                  {existingLocalChapters.length > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          Đã có trong tủ sách: {existingLocalChapters.length} / {storyDetail.totalChapters} chương
                        </span>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          (Đã tải đến chương {Math.max(...existingLocalChapters.map(c => c.chapterNumber))})
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        Hệ thống đã tự động chọn tải tiếp từ chương mới. Vị trí đang đọc và đánh dấu của bạn sẽ được giữ nguyên!
                      </p>
                    </div>
                  )}

                  {/* Chapter Range Selector */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-200">
                        Chọn khoảng chương tải về:
                      </label>
                      <span className="text-[11px] text-amber-400 font-medium">
                        Tổng {storyDetail.totalChapters} chương có sẵn
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] text-zinc-400 mb-1 block">Từ chương:</label>
                        <input
                          type="number"
                          min={1}
                          max={storyDetail.totalChapters}
                          value={fromChapter}
                          onChange={(e) => setFromChapter(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-zinc-100 font-semibold focus:outline-none"
                        />
                      </div>

                      <div className="pt-4 text-zinc-500 font-bold text-sm">→</div>

                      <div className="flex-1">
                        <label className="text-[11px] text-zinc-400 mb-1 block">Đến chương:</label>
                        <input
                          type="number"
                          min={1}
                          max={storyDetail.totalChapters}
                          value={toChapter}
                          onChange={(e) => setToChapter(Math.min(storyDetail.totalChapters, parseInt(e.target.value) || 1))}
                          className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-zinc-100 font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {existingLocalChapters.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const maxLocal = Math.max(...existingLocalChapters.map(c => c.chapterNumber));
                              setFromChapter(maxLocal + 1);
                              setToChapter(Math.min(storyDetail.totalChapters, maxLocal + 50));
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/70 text-[11px] text-zinc-300 font-medium transition-colors cursor-pointer"
                          >
                            +50 chương tiếp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const maxLocal = Math.max(...existingLocalChapters.map(c => c.chapterNumber));
                              setFromChapter(maxLocal + 1);
                              setToChapter(Math.min(storyDetail.totalChapters, maxLocal + 100));
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/70 text-[11px] text-zinc-300 font-medium transition-colors cursor-pointer"
                          >
                            +100 chương tiếp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const maxLocal = Math.max(...existingLocalChapters.map(c => c.chapterNumber));
                              setFromChapter(maxLocal + 1);
                              setToChapter(Math.min(storyDetail.totalChapters, maxLocal + 500));
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/70 text-[11px] text-zinc-300 font-medium transition-colors cursor-pointer"
                          >
                            +500 chương tiếp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const maxLocal = Math.max(...existingLocalChapters.map(c => c.chapterNumber));
                              setFromChapter(maxLocal + 1);
                              setToChapter(storyDetail.totalChapters);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-amber-500/40 text-[11px] text-amber-300 font-medium transition-colors cursor-pointer"
                          >
                            Tất cả còn lại
                          </button>
                        </>
                      ) : (
                        <>
                          {[50, 100, 300, 500, 1000].map(count => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                setFromChapter(1);
                                setToChapter(Math.min(storyDetail.totalChapters, count));
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/70 text-[11px] text-zinc-300 font-medium transition-colors cursor-pointer"
                            >
                              {count} chương đầu
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setFromChapter(1);
                              setToChapter(storyDetail.totalChapters);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-amber-500/40 text-[11px] text-amber-300 font-medium transition-colors cursor-pointer"
                          >
                            Toàn bộ ({storyDetail.totalChapters} ch)
                          </button>
                        </>
                      )}
                    </div>

                    {/* Skip existing chapters checkbox */}
                    <div className="pt-1.5 space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={skipExisting}
                          onChange={(e) => setSkipExisting(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-zinc-800 border-zinc-700"
                        />
                        <span>
                          <strong className="text-zinc-200">Tự động bỏ qua chương đã tải</strong> (Tránh tải trùng dữ liệu)
                        </span>
                      </label>
                      {!skipExisting && (
                        <p className="text-[11px] text-amber-400/90 pl-6">
                          ⚠️ Đang tắt bỏ qua: Hệ thống sẽ cào đè và cập nhật lại toàn bộ chương trong khoảng đã chọn.
                        </p>
                      )}
                    </div>

                    {/* Estimated download calculation */}
                    {(() => {
                      const start = Math.max(1, Math.min(fromChapter, toChapter));
                      const end = Math.min(storyDetail.chapters.length, Math.max(fromChapter, toChapter));
                      const range = storyDetail.chapters.slice(start - 1, end);
                      const existingSet = new Set(existingLocalChapters.map(c => c.chapterNumber));
                      const toDownload = skipExisting ? range.filter(c => !existingSet.has(c.number)).length : range.length;
                      const skipped = range.length - toDownload;

                      return (
                        <div className="text-[11px] text-zinc-400 bg-zinc-800/40 border border-zinc-700/50 p-2.5 rounded-xl flex items-center justify-between">
                          <span>Sẽ tải: <strong className="text-amber-400 font-semibold">{toDownload}</strong> chương mới</span>
                          {skipped > 0 && skipExisting && (
                            <span className="text-emerald-400 font-medium">(Bỏ qua {skipped} chương đã có)</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Download Error */}
                  {downloadError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{downloadError}</span>
                    </div>
                  )}

                  {/* Real-time Download Progress */}
                  {isDownloading && downloadProgress && (
                    <div className="space-y-2.5 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
                      <div className="flex justify-between text-xs font-medium text-amber-300">
                        <span className="truncate pr-2">{downloadProgress.title || 'Đang tải...'}</span>
                        <span className="shrink-0 font-bold">{downloadProgress.current} / {downloadProgress.total}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                          style={{ width: `${Math.round((downloadProgress.current / downloadProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 text-center">
                        Tốc độ tải batch đa luồng song song · Trích xuất nội dung thật
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <button
                onClick={() => setSelectedStory(null)}
                disabled={isDownloading}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>

              {(() => {
                if (!storyDetail) return null;
                const start = Math.max(1, Math.min(fromChapter, toChapter));
                const end = Math.min(storyDetail.chapters.length, Math.max(fromChapter, toChapter));
                const range = storyDetail.chapters.slice(start - 1, end);
                const existingSet = new Set(existingLocalChapters.map(c => c.chapterNumber));
                const toDownload = skipExisting ? range.filter(c => !existingSet.has(c.number)).length : range.length;

                return (
                  <button
                    onClick={handleDownloadAndSave}
                    disabled={isDownloading || isLoadingDetail || !storyDetail || toDownload === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs transition-all shadow-md cursor-pointer"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang lưu vào máy...
                      </>
                    ) : toDownload === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Đã có đủ các chương này
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Tải {toDownload} chương về tủ sách
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
