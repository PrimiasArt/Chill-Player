import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import type { Story } from '../../types';

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

      // 1. Fetch all cloud stories for this user
      const { data: cloudStories, error } = await this.client
        .from('user_stories')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const cloudMap = new Map((cloudStories || []).map(cs => [cs.id, cs]));

      // 2. Compare local vs cloud
      for (const local of localStories) {
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
            is_favorite: local.isFavorite,
            last_read_at: local.lastReadAt,
            created_at: local.createdAt
          });
          pushed++;
        } else {
          // Both exist: check which one is newer based on last_read_at
          if (local.lastReadAt > (cloud.last_read_at || 0)) {
            // Local is newer -> push to cloud
            await this.client.from('user_stories').update({
              current_chapter_number: local.currentChapterNumber,
              current_progress_percent: local.currentProgressPercent,
              current_sentence_index: local.currentSentenceIndex,
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
              isFavorite: cloud.is_favorite,
              lastReadAt: cloud.last_read_at
            });
            pulled++;
          }
          // Remove from cloudMap to find stories only on cloud
          cloudMap.delete(local.id);
        }
      }

      // 3. Any remaining stories in cloudMap exist ONLY in cloud -> pull to local
      for (const [, cloud] of cloudMap) {
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
          isFavorite: cloud.is_favorite,
          tags: ['CLOUD_SYNC'],
          lastReadAt: cloud.last_read_at || Date.now(),
          createdAt: cloud.created_at || Date.now()
        };
        await db.stories.add(newLocalStory);
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
