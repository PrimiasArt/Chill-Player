import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import type { Story, Chapter } from '../../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  userId: string;
  autoSync: boolean;
  enabled: boolean;
}

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: '',
  anonKey: '',
  userId: 'default_user',
  autoSync: true,
  enabled: false
};

class SupabaseSyncService {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig = DEFAULT_SUPABASE_CONFIG;
  private isSyncing = false;
  private syncListeners: Set<(isSyncing: boolean, lastSyncTime?: number) => void> = new Set();
  private lastSyncTime: number | null = null;

  public async init() {
    const savedConfig = await db.getSetting<SupabaseConfig>('supabaseConfig', DEFAULT_SUPABASE_CONFIG);
    this.config = savedConfig;
    if (savedConfig.enabled && savedConfig.url && savedConfig.anonKey) {
      this.setupClient(savedConfig.url, savedConfig.anonKey);
    }
  }

  public getConfig(): SupabaseConfig {
    return this.config;
  }

  public async updateConfig(newConfig: Partial<SupabaseConfig>): Promise<boolean> {
    this.config = { ...this.config, ...newConfig };
    await db.saveSetting('supabaseConfig', this.config);

    if (this.config.enabled && this.config.url && this.config.anonKey) {
      const ok = this.setupClient(this.config.url, this.config.anonKey);
      return ok;
    } else {
      this.client = null;
      return true;
    }
  }

  private setupClient(url: string, key: string): boolean {
    try {
      this.client = createClient(url, key, {
        auth: { persistSession: true }
      });
      return true;
    } catch (err) {
      console.error('Failed to setup Supabase client:', err);
      this.client = null;
      return false;
    }
  }

  public isConnected(): boolean {
    return this.client !== null && this.config.enabled;
  }

  public addListener(listener: (isSyncing: boolean, lastSyncTime?: number) => void) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private notify() {
    this.syncListeners.forEach(l => l(this.isSyncing, this.lastSyncTime || undefined));
  }

  /**
   * Test connection to Supabase
   */
  public async testConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const testClient = createClient(url, anonKey);
      // Query user_stories table
      const { error } = await testClient.from('user_stories').select('id').limit(1);
      if (error) {
        // If table does not exist, give helpful SQL schema hint
        if (error.code === '42P01') {
          return {
            success: false,
            message: 'Kết nối thành công nhưng chưa tạo bảng "user_stories". Hãy chạy đoạn mã SQL trong phần hướng dẫn.'
          };
        }
        return { success: false, message: `Lỗi Supabase: ${error.message}` };
      }
      return { success: true, message: 'Kết nối Supabase thành công!' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Không thể kết nối đến Supabase.' };
    }
  }

  /**
   * Delete story from Supabase and mark as deleted locally
   */
  public async deleteStory(storyId: string): Promise<void> {
    const deletedIds = await db.getSetting<string[]>('deletedStoryIds', []);
    if (!deletedIds.includes(storyId)) {
      deletedIds.push(storyId);
      await db.saveSetting('deletedStoryIds', deletedIds);
    }

    if (this.isConnected() && this.client) {
      try {
        await this.client.from('user_stories').delete().eq('id', storyId);
        try {
          await this.client.from('user_chapters').delete().eq('story_id', storyId);
        } catch {}
      } catch (err) {
        console.warn('Failed to delete story from Supabase:', err);
      }
    }
  }

  /**
   * Unmark a story if re-added
   */
  public async unmarkDeletedStory(storyId: string): Promise<void> {
    const deletedIds = await db.getSetting<string[]>('deletedStoryIds', []);
    if (deletedIds.includes(storyId)) {
      await db.saveSetting('deletedStoryIds', deletedIds.filter(id => id !== storyId));
    }
  }

  /**
   * Push chapters of a story to Supabase user_chapters table
   */
  public async pushStoryChapters(storyId: string, chapters?: Chapter[]): Promise<number> {
    if (!this.isConnected() || !this.client) return 0;
    try {
      const chs = chapters || await db.getStoryChapters(storyId);
      if (!chs || chs.length === 0) return 0;

      let count = 0;
      // Push in chunks of 30 to avoid payload size errors
      for (let i = 0; i < chs.length; i += 30) {
        const chunk = chs.slice(i, i + 30).map(c => ({
          id: c.id,
          story_id: c.storyId,
          chapter_number: c.chapterNumber,
          title: c.title,
          content: c.content,
          word_count: c.wordCount || 0,
          source_url: c.sourceUrl || '',
          created_at: Date.now()
        }));

        const { error } = await this.client
          .from('user_chapters')
          .upsert(chunk, { onConflict: 'id' });

        if (error) {
          if (error.code === '42P01') return 0;
          console.warn('Upsert chapters error:', error.message);
          break;
        }
        count += chunk.length;
      }
      return count;
    } catch (err: any) {
      if (err?.code !== '42P01') {
        console.warn('Failed to push chapters to Supabase:', err);
      }
      return 0;
    }
  }

  /**
   * Pull chapters of a story from Supabase user_chapters table
   */
  public async pullStoryChapters(storyId: string): Promise<number> {
    if (!this.isConnected() || !this.client) return 0;
    try {
      let allChapters: any[] = [];
      let from = 0;
      const batchSize = 1000;

      while (true) {
        const { data: cloudChapters, error } = await this.client
          .from('user_chapters')
          .select('*')
          .eq('story_id', storyId)
          .order('chapter_number', { ascending: true })
          .range(from, from + batchSize - 1);

        if (error) {
          if (error.code === '42P01') return 0;
          throw error;
        }

        if (!cloudChapters || cloudChapters.length === 0) break;
        allChapters = allChapters.concat(cloudChapters);
        if (cloudChapters.length < batchSize) break;
        from += batchSize;
      }

      if (allChapters.length > 0) {
        const chaptersToInsert: Chapter[] = allChapters.map(c => ({
          id: c.id,
          storyId: c.story_id,
          chapterNumber: c.chapter_number,
          title: c.title || `Chương ${c.chapter_number}`,
          content: c.content || '',
          wordCount: c.word_count || 0,
          sourceUrl: c.source_url
        }));
        await db.chapters.bulkPut(chaptersToInsert);
        return chaptersToInsert.length;
      }
    } catch (err: any) {
      if (err?.code !== '42P01') {
        console.warn('Failed to pull chapters from Supabase:', err);
      }
    }
    return 0;
  }

  /**
   * Push a story's latest progress to Cloud
   */
  public async pushStoryProgress(story: Story): Promise<void> {
    if (!this.isConnected() || !this.client || !this.config.autoSync) return;

    try {
      const payload = {
        id: story.id,
        user_id: this.config.userId || 'default_user',
        title: story.title,
        author: story.author,
        cover_url: story.coverUrl || '',
        description: story.description || '',
        total_chapters: story.totalChapters,
        current_chapter_number: story.currentChapterNumber,
        current_progress_percent: story.currentProgressPercent,
        current_sentence_index: story.currentSentenceIndex,
        source: story.source,
        source_url: story.sourceUrl || '',
        is_favorite: story.isFavorite,
        last_read_at: story.lastReadAt,
        created_at: story.createdAt
      };

      await this.client.from('user_stories').upsert(payload);
    } catch (err) {
      console.warn('Failed to push story progress to Supabase:', err);
    }
  }

  /**
   * Full two-way sync between Local (IndexedDB) and Cloud (Supabase)
   */
  public async syncAll(): Promise<{ pushed: number; pulled: number }> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Chưa kết nối Supabase.');
    }

    this.isSyncing = true;
    this.notify();

    let pushed = 0;
    let pulled = 0;

    try {
      const localStories = await db.stories.toArray();
      const userId = this.config.userId || 'default_user';
      const deletedStoryIds = await db.getSetting<string[]>('deletedStoryIds', []);

      // 0. Clean up deleted stories from cloud so they never resurrect
      if (deletedStoryIds.length > 0) {
        try {
          await this.client.from('user_stories').delete().in('id', deletedStoryIds);
          try {
            await this.client.from('user_chapters').delete().in('story_id', deletedStoryIds);
          } catch {}
        } catch (delErr) {
          console.warn('Error purging deleted stories:', delErr);
        }
      }

      // 1. Fetch all cloud stories for this user
      const { data: cloudStories, error } = await this.client
        .from('user_stories')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const cloudMap = new Map((cloudStories || []).map(cs => [cs.id, cs]));

      // 2. Compare local vs cloud
      for (const local of localStories) {
        // If local story was previously deleted, remove locally
        if (deletedStoryIds.includes(local.id)) {
          await db.deleteStoryWithChapters(local.id);
          continue;
        }

        const cloud = cloudMap.get(local.id);

        if (!cloud) {
          // Push local story to cloud
          await this.client.from('user_stories').upsert({
            id: local.id,
            user_id: userId,
            title: local.title,
            author: local.author,
            cover_url: local.coverUrl || '',
            description: local.description || '',
            total_chapters: local.totalChapters,
            current_chapter_number: local.currentChapterNumber,
            current_progress_percent: local.currentProgressPercent,
            current_sentence_index: local.currentSentenceIndex,
            source: local.source,
            source_url: local.sourceUrl || '',
            is_favorite: local.isFavorite,
            last_read_at: local.lastReadAt,
            created_at: local.createdAt
          });
          // Also try to push chapters
          await this.pushStoryChapters(local.id);
          pushed++;
        } else {
          // Both exist: check which one is newer based on last_read_at
          if (local.lastReadAt > (cloud.last_read_at || 0)) {
            // Local is newer -> push to cloud
            await this.client.from('user_stories').update({
              current_chapter_number: local.currentChapterNumber,
              current_progress_percent: local.currentProgressPercent,
              current_sentence_index: local.currentSentenceIndex,
              source_url: local.sourceUrl || cloud.source_url || '',
              is_favorite: local.isFavorite,
              last_read_at: local.lastReadAt
            }).eq('id', local.id);
            pushed++;
          } else if ((cloud.last_read_at || 0) > local.lastReadAt) {
            // Cloud is newer -> update local
            await db.stories.update(local.id, {
              currentChapterNumber: cloud.current_chapter_number,
              currentProgressPercent: cloud.current_progress_percent,
              currentSentenceIndex: cloud.current_sentence_index,
              sourceUrl: cloud.source_url || local.sourceUrl,
              isFavorite: cloud.is_favorite,
              lastReadAt: cloud.last_read_at
            });
            pulled++;
          }

          // If local has 0 chapters, try pulling chapters from cloud
          const localChapterCount = await db.chapters.where('storyId').equals(local.id).count();
          if (localChapterCount === 0) {
            await this.pullStoryChapters(local.id);
          } else {
            // Local has chapters, ensure cloud also has them
            await this.pushStoryChapters(local.id);
          }

          // Remove from cloudMap to find stories only on cloud
          cloudMap.delete(local.id);
        }
      }

      // 3. Any remaining stories in cloudMap exist ONLY in cloud -> pull to local (unless deleted)
      for (const [, cloud] of cloudMap) {
        if (deletedStoryIds.includes(cloud.id)) {
          // If deleted on this device, skip and remove from cloud
          try {
            await this.client.from('user_stories').delete().eq('id', cloud.id);
          } catch {}
          continue;
        }

        const newLocalStory: Story = {
          id: cloud.id,
          title: cloud.title,
          author: cloud.author,
          coverUrl: cloud.cover_url,
          description: cloud.description,
          totalChapters: cloud.total_chapters,
          currentChapterNumber: cloud.current_chapter_number,
          currentProgressPercent: cloud.current_progress_percent,
          currentSentenceIndex: cloud.current_sentence_index,
          source: cloud.source || 'crawler',
          sourceUrl: cloud.source_url || undefined,
          isFavorite: cloud.is_favorite,
          tags: ['CLOUD_SYNC'],
          lastReadAt: cloud.last_read_at || Date.now(),
          createdAt: cloud.created_at || Date.now()
        };
        await db.stories.add(newLocalStory);

        // Pull full chapter content from cloud into local IndexedDB
        await this.pullStoryChapters(cloud.id);
        pulled++;
      }

      this.lastSyncTime = Date.now();
      return { pushed, pulled };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const supabaseSync = new SupabaseSyncService();
