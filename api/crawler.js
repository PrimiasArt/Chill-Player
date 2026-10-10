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

function cleanWetruyenText(rawHtml) {
  if (!rawHtml) return '';
  let clean = decodeHtmlEntities(
    rawHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  );

  clean = clean
    .replace(/Bạn đang đọc truyện tại:?[^\n]+/gi, '')
    .replace(/Truyện được cập nhật tại[^\n]+/gi, '')
    .replace(/Chúc bạn đọc truyện vui vẻ[^\n]*/gi, '')
    .replace(/Nguồn:[^\n]+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return clean;
}

function cleanHH3DText(html) {
  const artMatch = html.match(/<article[^>]+class="art"[^>]*>([\s\S]*?)<\/article>/i);
  const containerHtml = artMatch ? artMatch[1] : html;

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

  const cMatch = html.match(/<div[^>]+class="[^"]*(?:chapter-c|chapter-content|reading-content|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (cMatch) {
    let text = decodeHtmlEntities(cMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  return '';
}

// ---------------------- SEARCH ----------------------
async function handleSearch(keyword) {
  const trimmed = keyword.trim();
  const results = [];

  // Try WeTruyen (Dtruyen) first - fast, unblocked on Vercel
  try {
    const url = `https://wetruyen.com/tim-kiem/?tukhoa=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const html = await res.text();
      const rows = html.split('<div class="row" itemscope');

      for (let i = 1; i < rows.length; i++) {
        const block = rows[i];
        const titleM = block.match(/<h3 class="truyen-title"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"/i) ||
                       block.match(/<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"/i);
        if (!titleM) continue;

        const sourceUrl = titleM[1];
        const title = decodeHtmlEntities(titleM[2].trim());

        const authorM = block.match(/itemprop="author"[^>]*>([\s\S]*?)(?:<\/div>|<span class="author">)/i) ||
                        block.match(/<span class="author"[^>]*itemprop="author"[^>]*>([\s\S]*?)<\/span>/i);
        const author = authorM ? decodeHtmlEntities(authorM[1].replace(/<[^>]+>/g, '').trim()) : 'Đang cập nhật';

        const chM = block.match(/(\d+)\s*chương/i);
        const latestChapter = chM ? `${chM[1]} chương` : '';

        const coverM = block.match(/data-desk-image="([^"]+)"/i) ||
                       block.match(/data-image="([^"]+)"/i) ||
                       block.match(/src="([^"]*(?:covers|medias)[^"]*)"/i);
        const coverUrl = coverM ? coverM[1] : '';

        const slug = sourceUrl.split('/').filter(Boolean).pop() || '';

        results.push({
          id: `wt-${slug}`,
          title,
          author,
          coverUrl,
          description: latestChapter ? `${latestChapter} · Đọc miễn phí` : '',
          latestChapter,
          sourceUrl,
          sourceName: 'WeTruyen'
        });
      }
    }
  } catch (err) {
    console.warn('WeTruyen search failed, trying fallback:', err.message);
  }

  // If WeTruyen returned results, return them
  if (results.length > 0) {
    return results;
  }

  // Fallback: Try TruyenHH3D (for local dev / residential IPs)
  try {
    const url = `https://truyenhh3d.com/tim-kiem?q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const html = await res.text();
      const cardRegex = /<a[^>]+class="card-novel"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
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
    }
  } catch (err) {
    console.warn('TruyenHH3D search fallback failed:', err.message);
  }

  return results;
}

// ---------------------- DETAIL ----------------------
async function handleStoryDetail(storyUrl) {
  const isWetruyen = storyUrl.includes('wetruyen.com') || storyUrl.includes('dtruyen.com');

  if (isWetruyen) {
    const res = await fetch(storyUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Lỗi tải thông tin truyện: HTTP ${res.status}`);
    const html = await res.text();

    const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleM ? decodeHtmlEntities(titleM[1].replace(/<[^>]+>/g, '').trim()) : 'Truyện Online';

    const authorM = html.match(/itemprop="author"[^>]*>([\s\S]*?)<\/(?:a|span)>/i) ||
                    html.match(/Tác giả:[^<]*<a[^>]*>([\s\S]*?)<\/a>/i);
    const author = authorM ? decodeHtmlEntities(authorM[1].replace(/<[^>]+>/g, '').trim()) : 'Đang cập nhật';

    const coverM = html.match(/<img[^>]+itemprop="image"[^>]+src="([^"]+)"/i) ||
                   html.match(/src="([^"]*(?:covers|medias)[^"]*)"/i);
    const coverUrl = coverM ? coverM[1] : '';

    const descM = html.match(/class="desc-text"[^>]*>([\s\S]*?)<\/div>/i) ||
                  html.match(/itemprop="description"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descM ? decodeHtmlEntities(descM[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()) : '';

    // Base slug for chapters: e.g. https://wetruyen.com/dau-pha-thuong-khung.12/ => https://wetruyen.com/dau-pha-thuong-khung
    const baseSlug = storyUrl.replace(/\.\d+\/?$/, '').replace(/\/$/, '');

    // Extract chapters from page 1
    const knownChapters = new Map();
    const p1Matches = [...html.matchAll(/<a[^>]+href="([^"]*chuong-(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of p1Matches) {
      const num = parseInt(m[2]);
      const rawTitle = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').trim());
      knownChapters.set(num, {
        number: num,
        title: rawTitle ? (rawTitle.toLowerCase().startsWith('chương') ? rawTitle : `Chương ${num}: ${rawTitle}`) : `Chương ${num}`,
        url: m[1]
      });
    }

    // Determine total chapters from pagination
    const pageMatches = [...html.matchAll(/trang-(\d+)/gi)].map(m => parseInt(m[1]));
    const lastPage = pageMatches.length > 0 ? Math.max(...pageMatches) : 1;

    let totalChapters = 50;
    if (lastPage > 1) {
      try {
        const lastPageUrl = `${storyUrl.replace(/\/$/, '')}/trang-${lastPage}/`;
        const lastRes = await fetch(lastPageUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(4000) });
        if (lastRes.ok) {
          const lastHtml = await lastRes.text();
          const lastChMatches = [...lastHtml.matchAll(/<a[^>]+href="([^"]*chuong-(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi)];
          for (const m of lastChMatches) {
            const num = parseInt(m[2]);
            const rawTitle = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').trim());
            knownChapters.set(num, {
              number: num,
              title: rawTitle ? (rawTitle.toLowerCase().startsWith('chương') ? rawTitle : `Chương ${num}: ${rawTitle}`) : `Chương ${num}`,
              url: m[1]
            });
          }
          const chNums = [...lastHtml.matchAll(/chuong-(\d+)/gi)].map(m => parseInt(m[1]));
          if (chNums.length > 0) {
            totalChapters = Math.max(...chNums);
          } else {
            totalChapters = lastPage * 50;
          }
        }
      } catch (e) {
        totalChapters = lastPage * 50;
      }
    } else {
      const chNums = [...html.matchAll(/chuong-(\d+)/gi)].map(m => parseInt(m[1]));
      if (chNums.length > 0) totalChapters = Math.max(...chNums);
    }

    const chapters = [];
    for (let i = 1; i <= Math.min(totalChapters, 2500); i++) {
      if (knownChapters.has(i)) {
        chapters.push(knownChapters.get(i));
      } else {
        chapters.push({
          number: i,
          title: `Chương ${i}`,
          url: `${baseSlug}/chuong-${i}.html`
        });
      }
    }

    return {
      title,
      author,
      coverUrl,
      description,
      sourceUrl: storyUrl,
      totalChapters: chapters.length,
      chapters
    };
  }

  // TruyenHH3D handler
  const res = await fetch(storyUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Lỗi tải thông tin truyện: HTTP ${res.status}`);
  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Truyện Online';

  const authorMatch = html.match(/class="author-link"[^>]*>([\s\S]*?)<\/a>/i) ||
                      html.match(/Tác giả:?[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                      html.match(/Tác giả:?\s*([^<\n]+)/i);
  const author = authorMatch ? decodeHtmlEntities(authorMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Đang cập nhật';

  const coverMatch = html.match(/<img[^>]+(?:class="[^"]*cover[^"]*"|src="([^"]*(?:covers|images)[^"]*)")/i);
  let coverUrl = coverMatch ? (coverMatch[1] || coverMatch[0]) : '';
  if (coverUrl && !coverUrl.startsWith('http')) {
    coverUrl = 'https://truyenhh3d.com' + coverUrl;
  }

  const synopsisMatch = html.match(/class="synopsis"[^>]*>([\s\S]*?)<\/div>/i);
  let description = '';
  if (synopsisMatch) {
    const cleanP = [...synopsisMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').trim()))
      .filter(s => s.length > 0 && !s.includes('Giới Thiệu Truyện') && !s.includes('Lưu ý:'));
    description = cleanP.join('\n\n');
  }

  const totalChMatch = html.match(/(\d+)\s*chương/i);
  const declaredTotalChapters = totalChMatch ? parseInt(totalChMatch[1]) : 0;

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
    sourceUrl: storyUrl,
    totalChapters: chapters.length,
    chapters
  };
}

// ---------------------- CHAPTER ----------------------
async function handleChapter(chapterUrl, retries = 2) {
  const isWetruyen = chapterUrl.includes('wetruyen.com') || chapterUrl.includes('dtruyen.com');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(chapterUrl, { 
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error(`Lỗi tải chương: HTTP ${res.status}`);
      const html = await res.text();

      if (isWetruyen) {
        const titleM = html.match(/class="chapter-title"[^>]*>([\s\S]*?)<\/a>/i) ||
                       html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleM ? decodeHtmlEntities(titleM[1].replace(/<[^>]+>/g, '').trim()) : '';

        const cM = html.match(/class="chapter-c"[^>]*>([\s\S]*?)<\/div>/i);
        if (!cM) throw new Error('Không tìm thấy nội dung chương.');

        const content = cleanWetruyenText(cM[1]);
        if (!content) throw new Error('Nội dung chương trống.');

        return {
          title,
          content,
          wordCount: content.split(/\s+/).length
        };
      }

      // HH3D chapter
      const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

      const content = cleanHH3DText(html);
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
