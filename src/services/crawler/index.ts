import type { CrawlSearchResult } from '../../types';

export interface CrawledStoryDetail {
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  sourceUrl: string;
  chapters: { title: string; url: string; number: number }[];
}

// Public CORS proxies to bypass browser restrictions
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

async function fetchWithCorsFallback(targetUrl: string): Promise<string> {
  // Try direct fetch first (works when running in Capacitor/Electron or on same origin)
  try {
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) return await res.text();
  } catch {
    // continue to proxies
  }

  // Try proxies
  for (const proxyGen of CORS_PROXIES) {
    try {
      const proxyUrl = proxyGen(targetUrl);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        return await res.text();
      }
    } catch {
      continue;
    }
  }

  throw new Error('Không thể kết nối đến trang truyện (Lỗi CORS hoặc mạng).');
}

/**
 * Curated Vietnamese novel sources
 */
export const POPULAR_RECOMMENDED_STORIES: CrawlSearchResult[] = [
  {
    id: 'dau-pha-thuong-khung',
    title: 'Đấu Phá Thương Khung',
    author: 'Thiên Tằm Thổ Đậu',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
    description: 'Đây là thế giới thuộc về Đấu Khí, không có ma pháp hoa lệ diễm lệ, chỉ có đấu khí đã phồn thịnh tới đỉnh cao!',
    latestChapter: 'Chương 1641: Kết Cục',
    sourceUrl: 'https://truyenfull.io/dau-pha-thuong-khung/',
    sourceName: 'TruyenFull'
  },
  {
    id: 'pham-nhan-tu-tien',
    title: 'Phàm Nhân Tu Tiên',
    author: 'Vong Ngữ',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
    description: 'Một thiếu niên bình thường nơi thôn quê nghèo khó, tình cờ bước vào con đường tu tiên đầy chông gai...',
    latestChapter: 'Chương 2446: Phi thăng',
    sourceUrl: 'https://truyenfull.io/pham-nhan-tu-tien/',
    sourceName: 'TruyenFull'
  },
  {
    id: 'quy-bi-chi-chu',
    title: 'Quỷ Bí Chi Chủ (Lord of Mysteries)',
    author: 'Ái Tiềm Thủy Đích Ô Tặc',
    coverUrl: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=300&q=80',
    description: 'Trong làn sương mù mờ ảo của hơi nước và máy móc, ai có thể tiếp cận được siêu phàm...',
    latestChapter: 'Chương 1432: Kẻ Khờ',
    sourceUrl: 'https://truyenfull.io/quy-bi-chi-chu/',
    sourceName: 'TruyenFull'
  },
  {
    id: 'muc-than-ky',
    title: 'Mục Thần Ký',
    author: 'Trạch Trư',
    coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e372fe?w=300&q=80',
    description: 'Đại Khư tàn tích, đêm tối buông xuống, bóng tối thôn phệ vạn vật...',
    latestChapter: 'Chương 1830: Đại kết cục',
    sourceUrl: 'https://truyenfull.io/muc-than-ky/',
    sourceName: 'TruyenFull'
  }
];

export async function searchStories(keyword: string): Promise<CrawlSearchResult[]> {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return POPULAR_RECOMMENDED_STORIES;

  // Filter curated first
  const localMatches = POPULAR_RECOMMENDED_STORIES.filter(s => 
    s.title.toLowerCase().includes(trimmed) || 
    s.author.toLowerCase().includes(trimmed)
  );

  try {
    // Search TruyenFull via proxy
    const searchUrl = `https://truyenfull.io/tim-kiem/?tukhoa=${encodeURIComponent(trimmed)}`;
    const html = await fetchWithCorsFallback(searchUrl);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('.list-truyen .row');

    const results: CrawlSearchResult[] = [];
    items.forEach((row, idx) => {
      const titleElem = row.querySelector('.truyen-title a');
      const authorElem = row.querySelector('.author');
      const coverElem = row.querySelector('[data-image], img');

      if (titleElem && titleElem.textContent) {
        const title = titleElem.textContent.trim();
        const url = (titleElem as HTMLAnchorElement).href;
        const author = authorElem?.textContent?.trim() || 'Chưa rõ';
        const coverUrl = coverElem?.getAttribute('data-image') || (coverElem as HTMLImageElement)?.src || '';

        results.push({
          id: `tf-${idx}-${Date.now()}`,
          title,
          author,
          coverUrl,
          sourceUrl: url,
          sourceName: 'TruyenFull'
        });
      }
    });

    return results.length > 0 ? results : (localMatches.length > 0 ? localMatches : POPULAR_RECOMMENDED_STORIES);
  } catch (err) {
    console.warn('Lỗi cào tìm kiếm trực tiếp, hiển thị kết quả đề xuất:', err);
    return localMatches.length > 0 ? localMatches : POPULAR_RECOMMENDED_STORIES;
  }
}

export async function fetchStoryDetail(storyUrl: string): Promise<CrawledStoryDetail> {
  const html = await fetchWithCorsFallback(storyUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const title = doc.querySelector('.title, h3.title')?.textContent?.trim() || 'Truyện Online';
  const author = doc.querySelector('.info .author a, .info .author')?.textContent?.trim() || 'Chưa rõ';
  const desc = doc.querySelector('.desc-text')?.textContent?.trim() || '';
  const coverUrl = (doc.querySelector('.book img') as HTMLImageElement)?.src || '';

  // Extract chapters from list
  const chapterLinks = doc.querySelectorAll('.list-chapter li a');
  const chapters: { title: string; url: string; number: number }[] = [];

  chapterLinks.forEach((a, idx) => {
    chapters.push({
      number: idx + 1,
      title: a.textContent?.trim() || `Chương ${idx + 1}`,
      url: (a as HTMLAnchorElement).href
    });
  });

  return {
    title,
    author,
    coverUrl,
    description: desc,
    sourceUrl: storyUrl,
    chapters
  };
}

export async function fetchChapterContent(chapterUrl: string): Promise<string> {
  const html = await fetchWithCorsFallback(chapterUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const contentElem = doc.querySelector('.chapter-c, #chapter-c, .chapter-content');
  if (!contentElem) {
    throw new Error('Không thể tìm thấy nội dung chương trên trang nguồn.');
  }

  // Remove ad scripts, watermarks
  contentElem.querySelectorAll('script, style, iframe, .ads, .ads-holder, a[href*="truyenfull"]').forEach(el => el.remove());

  // Replace br tags with newlines
  contentElem.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

  let text = contentElem.textContent || '';
  
  // Clean ads phrases
  text = text.replace(/Bạn đang xem truyện được sao chép tại:?[^\n]+/gi, '')
             .replace(/Chúc bạn đọc truyện vui vẻ[^\n]*/gi, '')
             .replace(/Nguồn:[^\n]+/gi, '')
             .replace(/\n{3,}/g, '\n\n')
             .trim();

  return text;
}
