import Dexie, { type Table } from 'dexie';
import type { MediaItem, StreamHistoryItem } from '../types';

export class ChillPlayerDatabase extends Dexie {
  mediaItems!: Table<MediaItem, string>;
  streamHistory!: Table<StreamHistoryItem, string>;

  constructor() {
    super('ChillPlayerDB');
    this.version(1).stores({
      mediaItems: 'id, title, type, isFavorite, lastPlayedAt, createdAt',
      streamHistory: 'id, url, title, lastPlayedAt'
    });
  }
}

export const db = new ChillPlayerDatabase();
