import { db } from './db';
import type { MediaItem } from '../types';
import { thumbnailService } from './thumbnailService';

export const mediaService = {
  /**
   * Fast load of media items metadata without loading heavy binary blobs
   */
  async getMediaList(): Promise<MediaItem[]> {
    return await db.mediaItems.orderBy('lastPlayedAt').reverse().toArray();
  },

  /**
   * Retrieve a playable object URL for a single media item on demand
   */
  async getPlayableUrl(item: MediaItem): Promise<string> {
    // 1. Direct web stream
    if (item.type === 'stream' || item.url.startsWith('http://') || item.url.startsWith('https://')) {
      return item.url;
    }

    // 2. Vault media (already decrypted in memory)
    if (item.id.startsWith('vault_')) {
      return item.url;
    }

    // 3. Separate mediaBlobs table (High performance storage)
    const blobRecord = await db.mediaBlobs.get(item.id);
    if (blobRecord && blobRecord.blob) {
      return URL.createObjectURL(blobRecord.blob);
    }

    // 4. Legacy embedded fileBlob fallback
    if (item.fileBlob) {
      return URL.createObjectURL(item.fileBlob);
    }

    return item.url;
  },

  /**
   * Safely revoke object URL when player closes to free memory immediately
   */
  revokePlayableUrl(url: string) {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Revoke URL error:', e);
      }
    }
  },

  /**
   * Import local files: extracts duration & thumbnail preview in parallel,
   * stores binary blob in mediaBlobs, and saves lightweight metadata in mediaItems
   */
  async importLocalFiles(files: FileList | File[], onProgress?: (current: number, total: number) => void): Promise<MediaItem[]> {
    const fileList = Array.from(files);
    const addedItems: MediaItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isVideo = file.type.startsWith('video') || /\.(mp4|mkv|webm|avi|mov|flv|3gp|m4v|ts)$/i.test(file.name);
      const isAudio = file.type.startsWith('audio') || /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(file.name);
      const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'mp3');
      const itemId = `local_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;

      // 1. Store heavy binary blob into dedicated mediaBlobs table
      await db.mediaBlobs.put({
        id: itemId,
        blob: file
      });

      // 2. Extract duration and thumbnail for videos
      let duration = 0;
      let thumbnailUrl: string | undefined = undefined;

      if (isVideo) {
        try {
          const meta = await thumbnailService.extractVideoMeta(file);
          duration = meta.duration;
          thumbnailUrl = meta.thumbnail;
        } catch (e) {
          console.warn('Metadata extraction failed:', e);
        }
      }

      // 3. Save clean, lightweight metadata record into mediaItems table
      const newItem: MediaItem = {
        id: itemId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        url: '', // Object URL generated lazily on playback
        type: isVideo ? 'video' : 'audio',
        duration,
        currentTime: 0,
        progressPercent: 0,
        sizeBytes: file.size,
        format: ext,
        thumbnailUrl,
        isFavorite: false,
        lastPlayedAt: Date.now(),
        createdAt: Date.now()
      };

      await db.mediaItems.put(newItem);
      addedItems.push(newItem);

      if (onProgress) {
        onProgress(i + 1, fileList.length);
      }
    }

    return addedItems;
  },

  /**
   * Delete media: removes metadata and blob from database
   */
  async deleteMedia(id: string): Promise<void> {
    await Promise.all([
      db.mediaItems.delete(id),
      db.mediaBlobs.delete(id)
    ]);
  },

  /**
   * Background backfill: generates thumbnails and durations for existing items that lack them
   */
  async backfillMissingThumbnails(): Promise<void> {
    const items = await db.mediaItems.where('type').equals('video').toArray();
    for (const item of items) {
      if (!item.thumbnailUrl || !item.duration || item.duration <= 0) {
        try {
          let blob: Blob | undefined;
          const blobRecord = await db.mediaBlobs.get(item.id);
          if (blobRecord) {
            blob = blobRecord.blob;
          } else if (item.fileBlob) {
            blob = item.fileBlob;
          }

          if (blob) {
            const meta = await thumbnailService.extractVideoMeta(blob);
            if (meta.duration > 0 || meta.thumbnail) {
              await db.mediaItems.update(item.id, {
                duration: meta.duration > 0 ? meta.duration : item.duration,
                thumbnailUrl: meta.thumbnail || item.thumbnailUrl
              });
            }
          }
        } catch {
          // Continue silently
        }
      }
    }
  }
};
