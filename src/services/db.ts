import Dexie, { type Table } from 'dexie';
import type { MediaItem, StreamHistoryItem } from '../types';
import type { VaultMediaItem } from './vaultService';

export interface MediaBlobRecord {
  id: string;
  blob: Blob;
}

export class ChillPlayerDatabase extends Dexie {
  mediaItems!: Table<MediaItem, string>;
  mediaBlobs!: Table<MediaBlobRecord, string>;
  streamHistory!: Table<StreamHistoryItem, string>;
  vaultItems!: Table<VaultMediaItem, string>;

  constructor() {
    super('ChillPlayerDB');
    this.version(1).stores({
      mediaItems: 'id, title, type, isFavorite, lastPlayedAt, createdAt',
      streamHistory: 'id, url, title, lastPlayedAt',
      vaultItems: 'id, title, type, createdAt, lastViewedAt'
    });

    this.version(2).stores({
      mediaItems: 'id, title, type, isFavorite, lastPlayedAt, createdAt',
      mediaBlobs: 'id',
      streamHistory: 'id, url, title, lastPlayedAt',
      vaultItems: 'id, title, type, createdAt, lastViewedAt'
    }).upgrade(async (tx) => {
      // Migrate existing embedded fileBlobs out of mediaItems into separate mediaBlobs table
      try {
        const items = await tx.table('mediaItems').toArray();
        for (const item of items) {
          if (item.fileBlob) {
            await tx.table('mediaBlobs').put({ id: item.id, blob: item.fileBlob });
            delete item.fileBlob;
            await tx.table('mediaItems').put(item);
          }
        }
      } catch (err) {
        console.warn('Dexie v2 migration notice:', err);
      }
    });
  }
}

export const db = new ChillPlayerDatabase();
