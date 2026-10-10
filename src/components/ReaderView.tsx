import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Settings2, 
  Headphones, 
  List, 
  ChevronLeft, 
  ChevronRight, 
  Type, 
  Check, 
  X,
  Search,
  Zap,
  CloudDownload,
  Download,
  BookOpen,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { Story, Chapter, ReaderSettings, ReaderTheme, FontFamily } from '../types';
import { ttsEngine, type TTSState } from '../services/tts/ttsEngine';
import { supabaseSync } from '../services/sync/supabaseSync';
import { fetchStoryDetail, batchDownloadChapters } from '../services/crawler';
import { db } from '../services/db';

interface ReaderViewProps {
  story: Story;
  chapters: Chapter[];
  currentChapterNumber: number;
  onSelectChapter: (chapterNumber: number) => void;
  onBackToLibrary: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  ttsState: TTSState;
  onStartTTS: () => void;
  onToggleTTS: () => void;
  activeSentenceIndex: number;
  onReloadChapters?: () => Promise<void>;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  story,
  chapters,
  currentChapterNumber,
  onSelectChapter,
  onBackToLibrary,
  settings,
  onUpdateSettings,
  ttsState,
  onStartTTS,
  onToggleTTS,
  activeSentenceIndex,
  onReloadChapters
}) => {
  const currentChapter = chapters.find(c => c.chapterNumber === currentChapterNumber) || chapters[0];
  
  // UI states
  const [showControls, setShowControls] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTocDrawer, setShowTocDrawer] = useState(false);

  // Quick jump & TOC search states
  const [tocSearch, setTocSearch] = useState('');
  const [quickJumpInput, setQuickJumpInput] = useState('');

  // On-demand download state for empty chapters
  const [isDownloadingChapters, setIsDownloadingChapters] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handlePullFromCloud = async () => {
    setIsDownloadingChapters(true);
    setDownloadStatus('Đang kết nối Supabase Cloud để tải chương...');
    setDownloadError(null);
    try {
      if (!supabaseSync.isConnected()) {
        throw new Error('Chưa kết nối Supabase. Vui lòng vào Cài đặt để thiết lập tài khoản Supabase.');
      }
      const count = await supabaseSync.pullStoryChapters(story.id);
      if (count > 0) {
        setDownloadStatus(`Đã tải thành công ${count} chương từ đám mây!`);
        if (onReloadChapters) {
          await onReloadChapters();
        }
      } else {
        setDownloadError('Không tìm thấy nội dung chương của truyện này trên Supabase Cloud. (Có thể máy tính chưa tạo bảng user_chapters hoặc chưa đồng bộ lên).');
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Lỗi khi tải chương từ Supabase');
    } finally {
      setIsDownloadingChapters(false);
    }
  };

  const handleDownloadFromOnlineSource = async () => {
    if (!story.sourceUrl) {
      setDownloadError('Truyện này không có liên kết nguồn web để tải tự động.');
      return;
    }

    setIsDownloadingChapters(true);
    setDownloadStatus('Đang lấy danh mục chương từ nguồn web...');
    setDownloadError(null);

    try {
      const detail = await fetchStoryDetail(story.sourceUrl);
      if (!detail.chapters || detail.chapters.length === 0) {
        throw new Error('Không lấy được danh sách chương từ nguồn web này.');
      }

      const targetCount = Math.min(detail.chapters.length, 50);
      const chaptersToDownload = detail.chapters.slice(0, targetCount);

      setDownloadStatus(`Đang tải 1-${targetCount} chương từ nguồn online...`);

      const results = await batchDownloadChapters(
        chaptersToDownload.map((c, i) => ({ title: c.title, url: c.url, number: c.number || (i + 1) })),
        (cur, tot, t) => {
          setDownloadStatus(`Đang tải chương ${cur}/${tot}: ${t || ''}`);
        }
      );

      const successfulChapters: Chapter[] = [];
      results.forEach((r, idx) => {
        if (r.success && r.content) {
          successfulChapters.push({
            id: `${story.id}_ch_${idx + 1}`,
            storyId: story.id,
            chapterNumber: idx + 1,
            title: r.title || `Chương ${idx + 1}`,
            content: r.content,
            wordCount: r.wordCount || 0,
            sourceUrl: r.url
          });
        }
      });

      if (successfulChapters.length === 0) {
        throw new Error('Không tải được nội dung của chương nào. Vui lòng kiểm tra lại kết nối mạng.');
      }

      await db.chapters.bulkPut(successfulChapters);
      await db.stories.update(story.id, {
        totalChapters: detail.totalChapters || successfulChapters.length
      });

      // Also push to Supabase if connected
      await supabaseSync.pushStoryChapters(story.id, successfulChapters);

      setDownloadStatus(`Đã tải xong ${successfulChapters.length} chương!`);
      if (onReloadChapters) {
        await onReloadChapters();
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Lỗi khi tải chương từ nguồn web');
    } finally {
      setIsDownloadingChapters(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const currentChapterButtonRef = useRef<HTMLButtonElement | null>(null);

  // Touch gesture tracker to distinguish scrolling/swiping from clicking
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isTouchDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isTouchDragging.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        isTouchDragging.current = true;
      }
    }
  };

  // Split chapter content into clean readable sentences matching ttsEngine
  const sentences = React.useMemo(() => {
    if (!currentChapter || !currentChapter.content) return [];
    return ttsEngine.splitIntoSentences(currentChapter.content);
  }, [currentChapter]);

  // Scroll to active sentence ONLY if it is out of the visible screen viewport
  useEffect(() => {
    if (ttsState === 'playing' && sentenceRefs.current[activeSentenceIndex]) {
      const el = sentenceRefs.current[activeSentenceIndex];
      if (el) {
        const rect = el.getBoundingClientRect();
        const isInViewport = rect.top >= 90 && rect.bottom <= (window.innerHeight - 110);
        if (!isInViewport) {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
  }, [activeSentenceIndex, ttsState]);

  // Auto-scroll TOC drawer to current chapter when drawer opens
  useEffect(() => {
    if (showTocDrawer) {
      const timer = setTimeout(() => {
        currentChapterButtonRef.current?.scrollIntoView({ block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showTocDrawer]);

  // Handle click on specific sentence to listen from that sentence (guarded against swipes)
  const handleSentenceClick = (index: number) => {
    if (isTouchDragging.current) return;

    if (ttsState === 'idle') {
      ttsEngine.loadChapter(
        currentChapter.content,
        {
          title: story.title,
          author: story.author,
          chapterTitle: currentChapter.title,
          coverUrl: story.coverUrl
        },
        index
      );
      ttsEngine.play();
    } else {
      ttsEngine.jumpToSentence(index);
    }
  };

  // Jump directly to a given chapter number
  const jumpToChapter = (chapterNum: number) => {
    const validNum = Math.max(1, Math.min(chapterNum, chapters.length));
    onSelectChapter(validNum);
    setShowTocDrawer(false);
    setTocSearch('');
    setQuickJumpInput('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(quickJumpInput.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= chapters.length) {
      jumpToChapter(num);
    }
  };

  // Filter chapters for TOC
  const filteredChapters = chapters.filter(c => {
    if (!tocSearch.trim()) return true;
    const q = tocSearch.trim().toLowerCase();
    return c.chapterNumber.toString() === q ||
           c.title.toLowerCase().includes(q) ||
           `chương ${c.chapterNumber}`.includes(q);
  });

  const getThemeClass = (theme: ReaderTheme) => {
    switch (theme) {
      case 'sepia': return 'theme-sepia';
      case 'dark': return 'theme-dark';
      case 'amoled': return 'theme-amoled';
      case 'paper': return 'theme-paper';
      case 'light':
      default: return 'theme-light';
    }
  };

  const getFontFamilyStyle = (font: FontFamily) => {
    switch (font) {
      case 'serif':
      case 'lora':
        return { fontFamily: "'Lora', serif" };
      case 'merriweather':
        return { fontFamily: "'Merriweather', serif" };
      case 'sans':
      default:
        return { fontFamily: "'Be Vietnam Pro', sans-serif" };
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${getThemeClass(settings.theme)} flex flex-col`}>
      {/* Top Floating Control Bar */}
      <div 
        className={`fixed top-0 left-0 right-0 z-30 transition-transform duration-300 ${
          showControls ? 'translate-y-0' : '-translate-y-full'
        } bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100 shadow-md`}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Back & Chapter Info */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBackToLibrary}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              title="Quay lại tủ sách"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold truncate text-zinc-200">
                {story.title}
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">
                {currentChapter?.title || `Chương ${currentChapterNumber}`}
              </p>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* TTS Toggle Button */}
            <button
              disabled={chapters.length === 0}
              onClick={() => {
                if (chapters.length === 0) return;
                if (ttsState === 'idle') {
                  onStartTTS();
                } else {
                  onToggleTTS();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                chapters.length === 0
                  ? 'opacity-40 cursor-not-allowed bg-zinc-800 text-zinc-500 border border-zinc-700'
                  : ttsState === 'playing'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/30 cursor-pointer'
                  : ttsState === 'paused'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-pointer'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer'
              }`}
              title={chapters.length === 0 ? 'Chưa có nội dung để đọc audio' : 'Nghe audio chương này'}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{ttsState === 'playing' ? 'Đang nghe' : (ttsState === 'paused' ? 'Tạm dừng' : 'Nghe audio')}</span>
            </button>

            {/* Table of contents */}
            <button
              disabled={chapters.length === 0}
              onClick={() => setShowTocDrawer(true)}
              className={`p-2 rounded-lg text-zinc-400 transition-colors ${
                chapters.length === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer'
              }`}
              title="Mục lục chương"
            >
              <List className="w-5 h-5" />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettingsModal(!showSettingsModal)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              title="Tùy chỉnh giao diện đọc"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Reading Text Area or Empty State */}
      {chapters.length === 0 ? (
        <main className="flex-1 max-w-xl mx-auto w-full px-5 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-32 rounded-xl overflow-hidden shadow-2xl border border-zinc-700/60 mb-5 bg-zinc-900 shrink-0">
            {story.coverUrl ? (
              <img src={story.coverUrl} alt={story.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <BookOpen className="w-10 h-10" />
              </div>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold mb-1 text-zinc-100">{story.title}</h2>
          <p className="text-xs text-zinc-400 mb-6">{story.author} • {story.totalChapters ? `${story.totalChapters} chương` : 'Chưa có chương'}</p>

          <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertCircle className="w-4 h-4" />
              Chưa có nội dung chữ trên thiết bị này
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Truyện đã được đồng bộ danh mục, nhưng nội dung chi tiết của các chương chưa được tải về máy. Bạn có thể tải ngay dưới đây:
            </p>

            {downloadStatus && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2 text-left">
                {isDownloadingChapters ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-amber-400" /> : <Check className="w-4 h-4 shrink-0 text-emerald-400" />}
                <span className="truncate">{downloadStatus}</span>
              </div>
            )}

            {downloadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{downloadError}</span>
              </div>
            )}

            <div className="pt-2 space-y-2.5">
              <button
                onClick={handlePullFromCloud}
                disabled={isDownloadingChapters}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 disabled:opacity-50 text-zinc-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {isDownloadingChapters ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                Tải nội dung chương từ Supabase Cloud
              </button>

              {story.sourceUrl && (
                <button
                  onClick={handleDownloadFromOnlineSource}
                  disabled={isDownloadingChapters}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-98 disabled:opacity-50 text-zinc-200 border border-zinc-700 font-medium text-xs transition-all cursor-pointer"
                >
                  {isDownloadingChapters ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-amber-400" />}
                  Tải các chương từ nguồn web online
                </button>
              )}

              <button
                onClick={onBackToLibrary}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Quay lại Thư viện
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main 
          ref={containerRef}
          onClick={() => setShowControls(!showControls)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-8 py-20 transition-all select-text cursor-default"
          style={{
            ...getFontFamilyStyle(settings.fontFamily),
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            letterSpacing: `${settings.letterSpacing}px`
          }}
        >
          {/* Chapter Title Heading */}
          <div className="mb-10 pb-4 border-b border-current opacity-20 text-center">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
              {currentChapter?.title}
            </h1>
            <p className="text-xs opacity-60">
              {story.title} • {story.author}
            </p>
          </div>

          {/* Text Sentences */}
          <div className="space-y-4">
            {sentences.map((sentence, idx) => {
              const isActive = ttsState !== 'idle' && idx === activeSentenceIndex;
              return (
                <span
                  key={idx}
                  ref={(el) => { sentenceRefs.current[idx] = el; }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSentenceClick(idx);
                  }}
                  className={`inline-block mr-1 rounded px-0.5 transition-colors cursor-pointer hover:bg-amber-500/10 ${
                    isActive ? 'tts-highlight font-medium' : ''
                  }`}
                >
                  {sentence}{' '}
                </span>
              );
            })}
          </div>

          {/* Chapter Bottom Navigation */}
          <div className="mt-16 pt-8 border-t border-current opacity-20 flex items-center justify-between gap-4">
            <button
              disabled={currentChapterNumber <= 1}
              onClick={(e) => {
                e.stopPropagation();
                onSelectChapter(currentChapterNumber - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-current opacity-80 hover:opacity-100 text-zinc-950 font-medium text-xs disabled:opacity-20 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Chương trước
            </button>

            <span className="text-xs opacity-75 font-medium">
              {currentChapterNumber} / {chapters.length}
            </span>

            <button
              disabled={currentChapterNumber >= chapters.length}
              onClick={(e) => {
                e.stopPropagation();
                onSelectChapter(currentChapterNumber + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-current opacity-80 hover:opacity-100 text-zinc-950 font-medium text-xs disabled:opacity-20 cursor-pointer"
            >
              Chương sau
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </main>
      )}

      {/* Reader Settings Modal */}
      {showSettingsModal && (
        <div 
          className="fixed bottom-4 right-4 z-40 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl p-4 w-80 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-amber-400" />
              Tùy chỉnh trang đọc
            </span>
            <button 
              onClick={() => setShowSettingsModal(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Palette */}
          <div>
            <label className="text-[11px] text-zinc-400 font-medium block mb-2">Màu nền</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => onUpdateSettings({ theme: 'sepia' })}
                className={`py-2 rounded-xl border text-xs font-medium bg-[#f4ecd8] text-[#5b4636] transition-all ${
                  settings.theme === 'sepia' ? 'ring-2 ring-amber-500 font-bold' : 'border-zinc-700'
                }`}
              >
                Vàng Sepia
              </button>
              <button
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`py-2 rounded-xl border text-xs font-medium bg-[#1e1e24] text-zinc-200 transition-all ${
                  settings.theme === 'dark' ? 'ring-2 ring-amber-500 font-bold' : 'border-zinc-700'
                }`}
              >
                Tối
              </button>
              <button
                onClick={() => onUpdateSettings({ theme: 'amoled' })}
                className={`py-2 rounded-xl border text-xs font-medium bg-black text-zinc-300 transition-all ${
                  settings.theme === 'amoled' ? 'ring-2 ring-amber-500 font-bold' : 'border-zinc-700'
                }`}
              >
                OLED
              </button>
              <button
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`py-2 rounded-xl border text-xs font-medium bg-white text-zinc-900 transition-all ${
                  settings.theme === 'light' ? 'ring-2 ring-amber-500 font-bold' : 'border-zinc-700'
                }`}
              >
                Sáng
              </button>
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="text-[11px] text-zinc-400 font-medium block mb-2">Phông chữ</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateSettings({ fontFamily: 'lora' })}
                className={`py-1.5 rounded-lg border text-xs font-serif transition-all ${
                  settings.fontFamily === 'lora' ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-zinc-700 text-zinc-300'
                }`}
              >
                Lora
              </button>
              <button
                onClick={() => onUpdateSettings({ fontFamily: 'merriweather' })}
                className={`py-1.5 rounded-lg border text-xs font-serif transition-all ${
                  settings.fontFamily === 'merriweather' ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-zinc-700 text-zinc-300'
                }`}
              >
                Merriweather
              </button>
              <button
                onClick={() => onUpdateSettings({ fontFamily: 'sans' })}
                className={`py-1.5 rounded-lg border text-xs font-sans transition-all ${
                  settings.fontFamily === 'sans' ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-zinc-700 text-zinc-300'
                }`}
              >
                Không chân
              </button>
            </div>
          </div>

          {/* Font Size & Line Height */}
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Cỡ chữ</span>
                <span className="font-semibold text-zinc-200">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
                  className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm"
                >
                  -
                </button>
                <input
                  type="range"
                  min="14"
                  max="32"
                  value={settings.fontSize}
                  onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                  className="flex-1 accent-amber-500"
                />
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
                  className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Dãn dòng</span>
                <span className="font-semibold text-zinc-200">{settings.lineHeight.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.4"
                max="2.4"
                step="0.1"
                value={settings.lineHeight}
                onChange={(e) => onUpdateSettings({ lineHeight: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table of Contents Drawer */}
      {showTocDrawer && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setShowTocDrawer(false)}
        >
          <div 
            className="w-full max-w-sm sm:max-w-md h-full bg-zinc-900 border-l border-zinc-800 flex flex-col p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded overflow-hidden bg-white p-0.5 border border-zinc-700/60 shrink-0 flex items-center justify-center">
                  <img src="/icon-192.png" alt="NKI Logo" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-semibold text-sm text-zinc-100 truncate">
                  Mục lục ({chapters.length.toLocaleString('vi-VN')} chương)
                </h3>
              </div>
              <button 
                onClick={() => setShowTocDrawer(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Jump Bar (Đi nhanh tới số chương) */}
            <form onSubmit={handleQuickJumpSubmit} className="flex items-center gap-2 mb-2.5">
              <input
                type="number"
                min="1"
                max={chapters.length}
                placeholder={`Đi nhanh tới số chương (1 - ${chapters.length})...`}
                value={quickJumpInput}
                onChange={(e) => setQuickJumpInput(e.target.value)}
                className="flex-1 bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm shadow-amber-500/20 shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Đi ngay</span>
              </button>
            </form>

            {/* Search Input Filter */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm nhanh theo số chương hoặc tên..."
                value={tocSearch}
                onChange={(e) => setTocSearch(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl pl-8 pr-8 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
              {tocSearch && (
                <button
                  type="button"
                  onClick={() => setTocSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Navigation Presets */}
            <div className="flex items-center gap-1.5 mb-3 text-[11px] overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => jumpToChapter(1)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0 cursor-pointer"
              >
                Đầu (Ch 1)
              </button>
              <button
                type="button"
                onClick={() => {
                  currentChapterButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium transition-colors shrink-0 cursor-pointer"
              >
                Đang đọc (Ch {currentChapterNumber})
              </button>
              <button
                type="button"
                onClick={() => jumpToChapter(chapters.length)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0 cursor-pointer"
              >
                Cuối (Ch {chapters.length})
              </button>
              {tocSearch && (
                <span className="text-[10px] text-zinc-400 ml-auto shrink-0">
                  Khớp {filteredChapters.length} / {chapters.length}
                </span>
              )}
            </div>

            {/* Chapter List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredChapters.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Không tìm thấy chương nào khớp với "{tocSearch}"
                </div>
              ) : (
                filteredChapters.map((ch) => {
                  const isCurrent = ch.chapterNumber === currentChapterNumber;
                  return (
                    <button
                      key={ch.id}
                      ref={isCurrent ? currentChapterButtonRef : null}
                      onClick={() => jumpToChapter(ch.chapterNumber)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 shadow-xs'
                          : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                          isCurrent ? 'bg-amber-500/30 text-amber-200' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          #{ch.chapterNumber}
                        </span>
                        <span className="truncate">{ch.title}</span>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
