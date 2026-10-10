import Dexie, { type Table } from 'dexie';
import type { Story, Chapter, ReaderSettings, TTSSettings } from '../types';

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'sepia',
  fontFamily: 'lora',
  fontSize: 19,
  lineHeight: 1.8,
  letterSpacing: 0.3,
  paragraphSpacing: 16,
  readerMode: 'scroll',
  autoScroll: false,
  autoScrollSpeed: 3
};

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  voiceURI: 'edge:vi-VN-NamMinhNeural',
  engine: 'ai',
  rate: 1.0,
  pitch: 1.0,
  sleepTimerMinutes: null,
  highlightSentence: true,
  autoNextChapter: true
};

export class ChillReaderDB extends Dexie {
  stories!: Table<Story, string>;
  chapters!: Table<Chapter, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('ChillReaderDB');
    this.version(1).stores({
      stories: 'id, title, author, isFavorite, lastReadAt, createdAt',
      chapters: 'id, storyId, chapterNumber, [storyId+chapterNumber]',
      settings: 'key'
    });
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const item = await this.settings.get(key);
    return item ? (item.value as T) : defaultValue;
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    await this.settings.put({ key, value });
  }

  async getStoryChapters(storyId: string): Promise<Chapter[]> {
    return await this.chapters.where('storyId').equals(storyId).sortBy('chapterNumber');
  }

  async getChapter(storyId: string, chapterNumber: number): Promise<Chapter | undefined> {
    return await this.chapters.where('[storyId+chapterNumber]').equals([storyId, chapterNumber]).first();
  }

  async deleteStoryWithChapters(storyId: string): Promise<void> {
    await this.transaction('rw', this.stories, this.chapters, async () => {
      await this.chapters.where('storyId').equals(storyId).delete();
      await this.stories.delete(storyId);
    });
  }
}

export const db = new ChillReaderDB();
