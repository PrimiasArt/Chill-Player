import type { CrawlSearchResult } from '../../types';

export interface CrawledStoryDetail {
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  sourceUrl: string;
  totalChapters: number;
  chapters: { title: string; url: string; number: number }[];
}

export interface FetchedChapterResult {
  url: string;
  title: string;
  content: string;
  wordCount: number;
  success: boolean;
  error?: string;
}

// In Capacitor mobile app, origin is capacitor://localhost so use production Vercel API
const API_BASE = (typeof window !== 'undefined' && window.location.origin.startsWith('http')) 
  ? '' 
  : 'https://chill-reader.vercel.app';

/**
 * Curated popular Vietnamese novels with working real sources
 */
export const POPULAR_RECOMMENDED_STORIES: CrawlSearchResult[] = [
  {
    id: 'dau-pha-thuong-khung',
    title: 'Đấu Phá Thương Khung',
    author: 'Thiên Tàm Thổ Đậu',
    coverUrl: 'https://truyenhh3d.com/static/covers/t320/dau-pha-thuong-khung.jpg.webp?v=1790436119',
    description: 'Đây là thế giới thuộc về Đấu Khí, không có ma pháp hoa lệ, chỉ có đấu khí đã phồn thịnh tới đỉnh cao!',
    latestChapter: '1638 chương · Hoàn thành',
    sourceUrl: 'https://truyenhh3d.com/truyen/dau-pha-thuong-khung',
    sourceName: 'TruyenHH3D'
  },
  {
    id: 'pham-nhan-tu-tien',
    title: 'Phàm Nhân Tu Tiên',
    author: 'Vong Ngữ',
    coverUrl: 'https://truyenhh3d.com/static/covers/t320/pham-nhan-tu-tien.jpg.webp',
    description: 'Một thiếu niên bình thường nơi thôn quê nghèo khó, tình cờ bước vào con đường tu tiên đầy chông gai...',
    latestChapter: '2468 chương · Hoàn thành',
    sourceUrl: 'https://truyenhh3d.com/truyen/pham-nhan-tu-tien',
    sourceName: 'TruyenHH3D'
  },
  {
    id: 'muc-than-ky',
    title: 'Mục Thần Ký',
    author: 'Trạch Trư',
    coverUrl: 'https://truyenhh3d.com/static/covers/t320/muc-than-ky.jpg.webp',
    description: 'Đại Khư tàn tích, đêm tối buông xuống, bóng tối thôn phệ vạn vật...',
    latestChapter: '1830 chương · Hoàn thành',
    sourceUrl: 'https://truyenhh3d.com/truyen/muc-than-ky',
    sourceName: 'TruyenHH3D'
  },
  {
    id: 'quang-am-chi-ngoai',
    title: 'Quang Âm Chi Ngoại',
    author: 'Nhĩ Căn',
    coverUrl: 'https://truyenhh3d.com/static/covers/t320/quang-am-chi-ngoai.jpg.webp',
    description: 'Thần linh mở mắt, nhân gian hóa kiếp. Thiếu niên Hứa Thanh đạp lên con đường sinh tồn...',
    latestChapter: '2100+ chương · Đang ra',
    sourceUrl: 'https://truyenhh3d.com/truyen/quang-am-chi-ngoai',
    sourceName: 'TruyenHH3D'
  }
];

/**
 * Search stories via serverless API with fallback
 */
export async function searchStories(keyword: string): Promise<CrawlSearchResult[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return POPULAR_RECOMMENDED_STORIES;

  try {
    const res = await fetch(`${API_BASE}/api/crawler?action=search&q=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('Lỗi gọi API tìm kiếm, thử tìm kiếm cục bộ:', err);
  }

  // Fallback to local filtering of recommended stories
  const lower = trimmed.toLowerCase();
  const matched = POPULAR_RECOMMENDED_STORIES.filter(s =>
    s.title.toLowerCase().includes(lower) ||
    s.author.toLowerCase().includes(lower)
  );

  return matched.length > 0 ? matched : POPULAR_RECOMMENDED_STORIES;
}

/**
 * Fetch story details & chapter list
 */
export async function fetchStoryDetail(storyUrl: string): Promise<CrawledStoryDetail> {
  const res = await fetch(`${API_BASE}/api/crawler?action=detail&url=${encodeURIComponent(storyUrl)}`, {
    signal: AbortSignal.timeout(12000)
  });

  if (!res.ok) {
    throw new Error(`Không thể lấy thông tin truyện (HTTP ${res.status}).`);
  }

  const data = await res.json();
  if (!data.success || !data.detail) {
    throw new Error(data.error || 'Dữ liệu truyện không hợp lệ.');
  }

  return data.detail;
}

/**
 * Fetch a single chapter's content
 */
export async function fetchChapterContent(chapterUrl: string): Promise<{ title: string; content: string; wordCount: number }> {
  const res = await fetch(`${API_BASE}/api/crawler?action=chapter&url=${encodeURIComponent(chapterUrl)}`, {
    signal: AbortSignal.timeout(12000)
  });

  if (!res.ok) {
    throw new Error(`Lỗi tải chương (HTTP ${res.status}).`);
  }

  const data = await res.json();
  if (!data.success || !data.chapter) {
    throw new Error(data.error || 'Nội dung chương không tồn tại.');
  }

  return data.chapter;
}

/**
 * Batch download multiple chapters concurrently with real-time progress callback
 */
export async function batchDownloadChapters(
  chapters: { title: string; url: string; number: number }[],
  onProgress?: (current: number, total: number, currentTitle: string) => void
): Promise<FetchedChapterResult[]> {
  const total = chapters.length;
  const results: FetchedChapterResult[] = [];
  const chunkSize = 10; // 10 chapters per serverless request

  for (let i = 0; i < chapters.length; i += chunkSize) {
    const chunk = chapters.slice(i, i + chunkSize);
    const chunkUrls = chunk.map(c => c.url);

    try {
      // Try batch endpoint first
      const res = await fetch(`${API_BASE}/api/crawler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', urls: chunkUrls }),
        signal: AbortSignal.timeout(25000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.chapters)) {
          data.chapters.forEach((ch: any, idx: number) => {
            const originalCh = chunk[idx];
            results.push({
              url: ch.url,
              title: ch.title || originalCh.title,
              content: ch.content || '',
              wordCount: ch.wordCount || 0,
              success: ch.success !== false && !!ch.content,
              error: ch.error
            });
            if (onProgress) {
              onProgress(results.length, total, ch.title || originalCh.title);
            }
          });
          continue; // Next chunk
        }
      }
    } catch (e) {
      console.warn('Batch POST failed, falling back to parallel fetch:', e);
    }

    // Fallback: Fetch chunk in parallel with Promise.all
    const chunkPromises = chunk.map(async (ch) => {
      try {
        const data = await fetchChapterContent(ch.url);
        return {
          url: ch.url,
          title: data.title || ch.title,
          content: data.content,
          wordCount: data.wordCount,
          success: true
        };
      } catch (err: any) {
        return {
          url: ch.url,
          title: ch.title,
          content: '',
          wordCount: 0,
          success: false,
          error: err.message
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach((r) => {
      results.push(r);
      if (onProgress) {
        onProgress(results.length, total, r.title);
      }
    });
  }

  return results;
}
