import JSZip from 'jszip';
import type { Story, Chapter } from '../../types';

export async function exportStoryToEpub(story: Story, chapters: Chapter[]): Promise<Blob> {
  const zip = new JSZip();

  // 1. mimetype (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXml);

  // 3. CSS Style
  const css = `body { font-family: sans-serif; line-height: 1.6; margin: 5%; }
h1, h2, h3 { text-align: center; }
p { text-indent: 1.5em; margin: 0.5em 0; }`;
  zip.file('OEBPS/style.css', css);

  // 4. Chapter HTML files
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navPoints: string[] = [];

  chapters.forEach((ch, idx) => {
    const filename = `chapter_${idx + 1}.xhtml`;
    const escapedTitle = escapeXml(ch.title || `Chương ${ch.chapterNumber}`);
    const paragraphs = (ch.content || '')
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeXml(p)}</p>`)
      .join('\n');

    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi">
<head>
  <title>${escapedTitle}</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <h2>${escapedTitle}</h2>
  ${paragraphs}
</body>
</html>`;

    zip.file(`OEBPS/${filename}`, xhtml);

    manifestItems.push(`<item id="ch_${idx + 1}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="ch_${idx + 1}"/>`);
    navPoints.push(`
    <navPoint id="np_${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapedTitle}</text></navLabel>
      <content src="${filename}"/>
    </navPoint>`);
  });

  // 5. OEBPS/toc.ncx
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${story.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(story.title)}</text></docTitle>
  <docAuthor><text>${escapeXml(story.author)}</text></docAuthor>
  <navMap>
    ${navPoints.join('')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // 6. OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(story.title)}</dc:title>
    <dc:creator opf:role="aut">${escapeXml(story.author)}</dc:creator>
    <dc:language>vi</dc:language>
    <dc:identifier id="BookID">urn:uuid:${story.id}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

export function exportStoryToTxt(story: Story, chapters: Chapter[]): Blob {
  let fullText = `${story.title.toUpperCase()}\n`;
  fullText += `Tác giả: ${story.author}\n`;
  if (story.description) fullText += `Giới thiệu: ${story.description}\n`;
  fullText += `Xuất từ Chill Reader: ${new Date().toLocaleDateString('vi-VN')}\n`;
  fullText += `=========================================\n\n`;

  chapters.forEach((ch) => {
    fullText += `\n\n=== ${ch.title || `Chương ${ch.chapterNumber}`} ===\n\n`;
    fullText += (ch.content || '').trim() + '\n';
  });

  return new Blob([fullText], { type: 'text/plain;charset=utf-8' });
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
