import JSZip from 'jszip';
import type { ParsedBook, ParsedChapter } from './txtParser';

export async function parseEpubFile(file: File | ArrayBuffer): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(file);

  // 1. Locate container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    throw new Error('File EPUB không hợp lệ (thiếu container.xml)');
  }

  // 2. Parse container.xml to find .opf path
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/i);
  if (!opfPathMatch) {
    throw new Error('Không tìm thấy đường dẫn OPF trong container.xml');
  }

  const opfPath = opfPathMatch[1];
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  const opfContent = await zip.file(opfPath)?.async('text');
  if (!opfContent) {
    throw new Error('Không thể đọc file OPF: ' + opfPath);
  }

  // 3. Extract Metadata from OPF
  const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
  const descMatch = opfContent.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);

  const title = titleMatch ? titleMatch[1].trim() : 'Truyện EPUB';
  const author = authorMatch ? authorMatch[1].trim() : 'Khuyết danh';
  const description = descMatch ? stripHtml(descMatch[1].trim()) : '';

  // 4. Parse Manifest (id -> href)
  const manifest: Record<string, string> = {};
  const itemRegex = /<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*\/?>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(opfContent)) !== null) {
    manifest[itemMatch[1]] = decodeURIComponent(itemMatch[2]);
  }
  // Try alternative attribute ordering (href before id)
  const itemRegexAlt = /<item\s+[^>]*href="([^"]+)"[^>]*id="([^"]+)"[^>]*\/?>/gi;
  while ((itemMatch = itemRegexAlt.exec(opfContent)) !== null) {
    manifest[itemMatch[2]] = decodeURIComponent(itemMatch[1]);
  }

  // 5. Parse Spine (linear order of chapters)
  const spineIds: string[] = [];
  const spineRegex = /<itemref\s+[^>]*idref="([^"]+)"[^>]*\/?>/gi;
  let spineMatch: RegExpExecArray | null;
  while ((spineMatch = spineRegex.exec(opfContent)) !== null) {
    spineIds.push(spineMatch[1]);
  }

  // 6. Try to find Table of Contents (toc.ncx or nav.xhtml)
  const tocTitles: Record<string, string> = {};
  const ncxFileKey = Object.values(manifest).find(f => f.endsWith('.ncx'));
  if (ncxFileKey) {
    const ncxPath = resolvePath(opfDir, ncxFileKey);
    const ncxContent = await zip.file(ncxPath)?.async('text');
    if (ncxContent) {
      const navPointRegex = /<navPoint[\s\S]*?<navLabel>\s*<text>([^<]+)<\/text>\s*<\/navLabel>\s*<content\s+src="([^"#]+)(?:#[^"]*)?"/gi;
      let navMatch: RegExpExecArray | null;
      while ((navMatch = navPointRegex.exec(ncxContent)) !== null) {
        const navTitle = navMatch[1].trim();
        const navSrc = decodeURIComponent(navMatch[2]);
        tocTitles[navSrc] = navTitle;
      }
    }
  }

  // 7. Extract chapters in spine order
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < spineIds.length; i++) {
    const id = spineIds[i];
    const href = manifest[id];
    if (!href) continue;

    const fullPath = resolvePath(opfDir, href);
    const chapterHtml = await zip.file(fullPath)?.async('text');
    if (!chapterHtml) continue;

    const cleanText = extractReadableTextFromHtml(chapterHtml);
    if (cleanText.trim().length < 20) {
      // Skip empty wrapper pages / title pages with almost no text
      continue;
    }

    // Determine chapter title
    let chapterTitle = tocTitles[href] || tocTitles[href.split('/').pop() || ''];
    if (!chapterTitle) {
      const hMatch = chapterHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
      if (hMatch) {
        chapterTitle = stripHtml(hMatch[1]).trim();
      }
    }
    if (!chapterTitle || chapterTitle.length > 100) {
      chapterTitle = `Chương ${chapters.length + 1}`;
    }

    chapters.push({
      chapterNumber: chapters.length + 1,
      title: chapterTitle,
      content: cleanText
    });
  }

  return {
    title,
    author,
    description: description || `Truyện gồm ${chapters.length} chương.`,
    chapters
  };
}

function resolvePath(dir: string, file: string): string {
  if (file.startsWith('/')) file = file.slice(1);
  return dir ? `${dir}${file}` : file;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function extractReadableTextFromHtml(html: string): string {
  // 1. Remove script, style, head
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[\s\S]*?<\/style>/gi, '')
                  .replace(/<head[\s\S]*?<\/head>/gi, '');

  // 2. Replace block elements with newlines
  clean = clean.replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n\n')
               .replace(/<br\s*\/?>/gi, '\n');

  // 3. Strip all remaining tags
  clean = stripHtml(clean);

  // 4. Normalize spacing
  return clean.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}
