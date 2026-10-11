import type { SubtitleCue } from '../types';

export function parseSubtitles(text: string): SubtitleCue[] {
  if (!text) return [];
  
  // Normalize line breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cues: SubtitleCue[] = [];

  // Match SRT or VTT blocks
  // Timecode regex: 00:01:20,000 --> 00:01:23,400 or 01:20.000 --> 01:23.400
  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,\.](\d{3})/;

  const blocks = normalized.split(/\n\s*\n/);
  let id = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const match = lines[timeLineIdx].match(timeRegex);
    if (!match) continue;

    const startH = match[1] ? parseInt(match[1], 10) : 0;
    const startM = parseInt(match[2], 10);
    const startS = parseInt(match[3], 10);
    const startMs = parseInt(match[4], 10);
    const startTime = startH * 3600 + startM * 60 + startS + startMs / 1000;

    const endH = match[5] ? parseInt(match[5], 10) : 0;
    const endM = parseInt(match[6], 10);
    const endS = parseInt(match[7], 10);
    const endMs = parseInt(match[8], 10);
    const endTime = endH * 3600 + endM * 60 + endS + endMs / 1000;

    const textLines = lines.slice(timeLineIdx + 1).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    const subtitleText = textLines.join('\n');

    if (subtitleText) {
      cues.push({
        id: id++,
        startTime,
        endTime,
        text: subtitleText
      });
    }
  }

  return cues;
}

export function getActiveSubtitleText(cues: SubtitleCue[], currentTime: number, offsetMs: number = 0): string | null {
  const adjustedTime = currentTime - offsetMs / 1000;
  const match = cues.find(c => adjustedTime >= c.startTime && adjustedTime <= c.endTime);
  return match ? match.text : null;
}
