const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanChapterContent(html) {
  // Primary: TruyenHH3D uses <article class="art">
  const artMatch = html.match(/<article[^>]+class="art"[^>]*>([\s\S]*?)<\/article>/i);
  const containerHtml = artMatch ? artMatch[1] : html;

  // Extract paragraphs
  const pMatches = [...containerHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decodeHtmlEntities(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()))
    .filter(s => {
      if (s.length === 0) return false;
      if (s.includes('Thiên Cơ Các') || s.includes('Trang chủ ›') || s.includes('truyenhh3d')) return false;
      if (s.includes('Đọc truyện online') || s.includes('Chúc bạn đọc truyện')) return false;
      return true;
    });

  if (pMatches.length > 2) {
    return pMatches.join('\n\n');
  }

  // Fallback container extraction
  const cMatch = html.match(/<div[^>]+class="[^"]*(?:chapter-c|chapter-content|reading-content|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (cMatch) {
    let text = decodeHtmlEntities(cMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  return '';
}

async function handleSearch(keyword) {
  const url = `https://truyenhh3d.com/tim-kiem?q=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Lỗi tìm kiếm: HTTP ${res.status}`);
  const html = await res.text();

  const cardRegex = /<a[^>]+class="card-novel"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const urlPath = match[1];
    const inner = match[2];

    const titleMatch = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    const metaMatch = inner.match(/<div class="meta"[^>]*>([\s\S]*?)<\/div>/i);
    const meta = metaMatch ? decodeHtmlEntities(metaMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    const coverMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
    let coverUrl = coverMatch ? coverMatch[1] : '';
    if (coverUrl && !coverUrl.startsWith('http')) {
      coverUrl = 'https://truyenhh3d.com' + coverUrl;
    }

    if (title) {
      const slug = urlPath.replace('/truyen/', '').replace('/', '');
      results.push({
        id: `hh3d-${slug}`,
        title,
        author: 'Đang cập nhật',
        coverUrl,
        description: meta,
        latestChapter: meta,
        sourceUrl: 'https://truyenhh3d.com' + urlPath,
        sourceName: 'TruyenHH3D'
      });
    }
  }

  return results;
}

async function handleStoryDetail(storyUrl) {
  const res = await fetch(storyUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Lỗi tải thông tin truyện: HTTP ${res.status}`);
  const html = await res.text();

  // Title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Truyện Online';

  // Author
  const authorMatch = html.match(/class="author-link"[^>]*>([\s\S]*?)<\/a>/i) ||
                      html.match(/Tác giả:?[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                      html.match(/Tác giả:?\s*([^<\n]+)/i);
  const author = authorMatch ? decodeHtmlEntities(authorMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Đang cập nhật';

  // Cover
  const coverMatch = html.match(/<img[^>]+(?:class="[^"]*cover[^"]*"|src="([^"]*(?:covers|images)[^"]*)")/i);
  let coverUrl = coverMatch ? (coverMatch[1] || coverMatch[0]) : '';
  if (coverUrl && !coverUrl.startsWith('http')) {
    coverUrl = 'https://truyenhh3d.com' + coverUrl;
  }

  // Synopsis
  const synopsisMatch = html.match(/class="synopsis"[^>]*>([\s\S]*?)<\/div>/i);
  let description = '';
  if (synopsisMatch) {
    const cleanP = [...synopsisMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').trim()))
      .filter(s => s.length > 0 && !s.includes('Giới Thiệu Truyện') && !s.includes('Lưu ý:'));
    description = cleanP.join('\n\n');
  }

  // Chapter count & dropdown pages
  const totalChMatch = html.match(/(\d+)\s*chương/i);
  const declaredTotalChapters = totalChMatch ? parseInt(totalChMatch[1]) : 0;

  // Extract chapters from page 1
  const chapterLinks = [...html.matchAll(/<a[^>]+href="(\/truyen\/[^"]*\/chuong-(\d+))"[^>]*>([\s\S]*?)<\/a>/gi)];
  const chapters = [];
  const seen = new Set();

  for (const m of chapterLinks) {
    const chNum = parseInt(m[2]);
    if (seen.has(chNum)) continue;
    seen.add(chNum);
    const rawTitle = m[3].replace(/<span class="lock[^"]*"[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '').trim();
    chapters.push({
      number: chNum,
      title: decodeHtmlEntities(rawTitle) || `Chương ${chNum}`,
      url: 'https://truyenhh3d.com' + m[1]
    });
  }

  chapters.sort((a, b) => a.number - b.number);

  // If story has declared total chapters greater than page 1 (100 chapters),
  // generate remaining chapter URLs based on the standard pattern
  const baseStorySlug = storyUrl.replace('https://truyenhh3d.com', '').replace(/\/$/, '');
  const totalToBuild = Math.max(declaredTotalChapters, chapters.length);
  if (totalToBuild > chapters.length) {
    for (let num = chapters.length + 1; num <= totalToBuild; num++) {
      chapters.push({
        number: num,
        title: `Chương ${num}`,
        url: `https://truyenhh3d.com${baseStorySlug}/chuong-${num}`
      });
    }
  }

  return {
    title,
    author,
    coverUrl,
    description,
    sourceUrl,
    totalChapters: chapters.length,
    chapters
  };
}

async function handleChapter(chapterUrl, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(chapterUrl, { 
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error(`Lỗi tải chương: HTTP ${res.status}`);
      const html = await res.text();

      const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

      const content = cleanChapterContent(html);
      if (!content) {
        throw new Error('Nội dung chương trống hoặc không tìm thấy.');
      }

      return {
        title,
        content,
        wordCount: content.split(/\s+/).length
      };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
    }
  }
}

async function handleBatchChapters(urls) {
  // Fetch with concurrency pool of 6
  const results = [];
  const concurrency = 6;
  
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (u) => {
        try {
          const data = await handleChapter(u);
          return { url: u, ...data, success: true };
        } catch (err) {
          return { url: u, error: err.message, success: false };
        }
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = urlObj.searchParams.get('action') || (req.body && req.body.action);

    if (action === 'search') {
      const q = urlObj.searchParams.get('q') || '';
      const results = await handleSearch(q);
      res.status(200).json({ success: true, results });
      return;
    }

    if (action === 'detail') {
      const url = urlObj.searchParams.get('url') || '';
      if (!url) throw new Error('Thiếu tham số url');
      const detail = await handleStoryDetail(url);
      res.status(200).json({ success: true, detail });
      return;
    }

    if (action === 'chapter') {
      const url = urlObj.searchParams.get('url') || '';
      if (!url) throw new Error('Thiếu tham số url');
      const chapter = await handleChapter(url);
      res.status(200).json({ success: true, chapter });
      return;
    }

    if (action === 'batch' && req.method === 'POST') {
      const urls = req.body && req.body.urls;
      if (!Array.isArray(urls)) throw new Error('Tham số urls phải là một danh sách');
      const chapters = await handleBatchChapters(urls);
      res.status(200).json({ success: true, chapters });
      return;
    }

    res.status(400).json({ success: false, error: `Hành động không hỗ trợ: ${action}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
