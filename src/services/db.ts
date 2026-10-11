import Dexie, { type Table } from 'dexie';
import type { MediaItem, StreamHistoryItem } from '../types';
import type { VaultMediaItem } from './vaultService';

export class ChillPlayerDatabase extends Dexie {
  mediaItems!: Table<MediaItem, string>;
  streamHistory!: Table<StreamHistoryItem, string>;
  vaultItems!: Table<VaultMediaItem, string>;

  constructor() {
    super('ChillPlayerDB');
    this.version(1).stores({
      mediaItems: 'id, title, type, isFavorite, lastPlayedAt, createdAt',
      streamHistory: 'id, url, title, lastPlayedAt',
      vaultItems: 'id, title, type, createdAt, lastViewedAt'
    });
  }
}

export const db = new ChillPlayerDatabase();

