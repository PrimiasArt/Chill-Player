import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LibraryView } from './components/LibraryView';
import { ImportModal } from './components/ImportModal';
import { CrawlView } from './components/CrawlView';
import { ReaderView } from './components/ReaderView';
import { TTSPlayerBar } from './components/TTSPlayerBar';
import { SettingsView } from './components/SettingsView';
import { db, DEFAULT_READER_SETTINGS, DEFAULT_TTS_SETTINGS } from './services/db';
import { ttsEngine, type TTSState } from './services/tts/ttsEngine';
import { supabaseSync } from './services/sync/supabaseSync';
import { INITIAL_SAMPLE_STORY } from './services/sampleData';
import type { Story, Chapter, ReaderSettings, TTSSettings } from './types';

export const App: React.FC = () => {
  // Navigation & View States
  const [currentTab, setCurrentTab] = useState<'library' | 'crawler' | 'settings'>('library');
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [playingStory, setPlayingStory] = useState<{ title: string; author: string; coverUrl?: string } | null>(null);
  const [activeStoryChapters, setActiveStoryChapters] = useState<Chapter[]>([]);
  const [currentChapterNumber, setCurrentChapterNumber] = useState<number>(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFullTTSModalOpen, setIsFullTTSModalOpen] = useState(false);

  // Data
  const [stories, setStories] = useState<Story[]>([]);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>(DEFAULT_TTS_SETTINGS);

  // TTS State
  const [ttsState, setTtsState] = useState<TTSState>('idle');
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(0);
  const [currentSentenceText, setCurrentSentenceText] = useState<string>('');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  // Load Library & Settings from Dexie IndexedDB
  const loadLibrary = useCallback(async () => {
    try {
      const storedStories = await db.stories.orderBy('lastReadAt').reverse().toArray();
      if (storedStories.length === 0) {
        // Seed initial sample story
        await db.stories.add(INITIAL_SAMPLE_STORY.story);
        await db.chapters.bulkAdd(INITIAL_SAMPLE_STORY.chapters);
        setStories([INITIAL_SAMPLE_STORY.story]);
      } else {
        setStories(storedStories);
      }

      // Load Settings
      const savedReaderSettings = await db.getSetting<ReaderSettings>('readerSettings', DEFAULT_READER_SETTINGS);
      const savedTtsSettings = await db.getSetting<TTSSettings>('ttsSettings', DEFAULT_TTS_SETTINGS);
      setReaderSettings(savedReaderSettings);
      setTtsSettings(savedTtsSettings);
      ttsEngine.updateSettings(savedTtsSettings);
      await supabaseSync.init();
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Hook up TTS Engine Listeners
  useEffect(() => {
    const unsubscribe = ttsEngine.addListener({
      onStateChange: (state) => setTtsState(state),
      onSentenceChange: (idx, text) => {
        setActiveSentenceIndex(idx);
        setCurrentSentenceText(text);
      },
      onTimeRemainingUpdate: (seconds) => setCountdownSeconds(seconds),
      onChapterComplete: () => {
        if (ttsSettings.autoNextChapter && activeStory && activeStoryChapters.length > 0) {
          if (currentChapterNumber < activeStoryChapters.length) {
            handleSelectChapter(currentChapterNumber + 1, true);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ttsSettings.autoNextChapter, activeStory, activeStoryChapters, currentChapterNumber]);

  // Handle open a story in reader or directly in audio mode
  const handleOpenStory = async (story: Story, mode: 'read' | 'listen') => {
    try {
      const chapters = await db.getStoryChapters(story.id);
      setActiveStory(story);
      setActiveStoryChapters(chapters);
      const startChapterNumber = story.currentChapterNumber || 1;
      setCurrentChapterNumber(startChapterNumber);

      // Update last read time
      await db.stories.update(story.id, { lastReadAt: Date.now() });

      if (mode === 'listen') {
        setPlayingStory({ title: story.title, author: story.author, coverUrl: story.coverUrl });
        const chapter = chapters.find(c => c.chapterNumber === startChapterNumber) || chapters[0];
        if (chapter) {
          ttsEngine.loadChapter(
            chapter.content,
            {
              title: story.title,
              author: story.author,
              chapterTitle: chapter.title,
              coverUrl: story.coverUrl
            },
            story.currentSentenceIndex || 0
          );
          ttsEngine.play();
          setIsFullTTSModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Failed to open story:', err);
    }
  };

  // Change chapter in reader
  const handleSelectChapter = async (chapterNumber: number, autoStartListen: boolean = false) => {
    setCurrentChapterNumber(chapterNumber);
    if (!activeStory) return;

    // Calculate progress
    const progressPercent = activeStoryChapters.length > 0
      ? Math.round((chapterNumber / activeStoryChapters.length) * 100)
      : 0;

    await db.stories.update(activeStory.id, {
      currentChapterNumber: chapterNumber,
      currentProgressPercent: progressPercent,
      lastReadAt: Date.now()
    });

    const updatedStory: Story = {
      ...activeStory,
      currentChapterNumber: chapterNumber,
      currentProgressPercent: progressPercent,
      lastReadAt: Date.now()
    };

    setStories(prev => prev.map(s => s.id === activeStory.id ? updatedStory : s));
    supabaseSync.pushStoryProgress(updatedStory);

    const chapter = activeStoryChapters.find(c => c.chapterNumber === chapterNumber);
    if (chapter && (autoStartListen || ttsState === 'playing')) {
      ttsEngine.loadChapter(
        chapter.content,
        {
          title: activeStory.title,
          author: activeStory.author,
          chapterTitle: chapter.title,
          coverUrl: activeStory.coverUrl
        },
        0
      );
      ttsEngine.play();
    }
  };

  // Start TTS for current chapter
  const handleStartTTS = () => {
    if (!activeStory) return;
    setPlayingStory({ title: activeStory.title, author: activeStory.author, coverUrl: activeStory.coverUrl });
    const chapter = activeStoryChapters.find(c => c.chapterNumber === currentChapterNumber) || activeStoryChapters[0];
    if (chapter) {
      ttsEngine.loadChapter(
        chapter.content,
        {
          title: activeStory.title,
          author: activeStory.author,
          chapterTitle: chapter.title,
          coverUrl: activeStory.coverUrl
        },
        activeSentenceIndex || 0
      );
      ttsEngine.play();
    }
  };

  const handleToggleFavorite = async (storyId: string) => {
    const story = stories.find(s => s.id === storyId);
    if (!story) return;
    const isFav = !story.isFavorite;
    await db.stories.update(storyId, { isFavorite: isFav });
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, isFavorite: isFav } : s));
  };

  const handleDeleteStory = async (storyId: string) => {
    if (activeStory?.id === storyId) {
      ttsEngine.stop();
      setActiveStory(null);
    }
    await db.deleteStoryWithChapters(storyId);
    setStories(prev => prev.filter(s => s.id !== storyId));
  };

  const handleImportComplete = async (story: Story, chapters: Chapter[]) => {
    let finalStory: Story = story;
    await db.transaction('rw', db.stories, db.chapters, async () => {
      const existing = await db.stories.get(story.id);
      if (existing) {
        const existingChapters = await db.getStoryChapters(story.id);
        const allDistinctNumbers = new Set([
          ...existingChapters.map(c => c.chapterNumber),
          ...chapters.map(c => c.chapterNumber)
        ]);

        finalStory = {
          ...existing,
          title: story.title || existing.title,
          coverUrl: story.coverUrl || existing.coverUrl,
          totalChapters: allDistinctNumbers.size,
          sourceUrl: story.sourceUrl || existing.sourceUrl,
          // Preserve user reading progress so reading position is kept!
          currentChapterNumber: existing.currentChapterNumber || 1,
          currentProgressPercent: existing.currentProgressPercent || 0,
          currentSentenceIndex: existing.currentSentenceIndex || 0,
          lastReadAt: Date.now()
        };
        await db.stories.put(finalStory);
      } else {
        await db.stories.put(story);
      }
      await db.chapters.bulkPut(chapters);
    });

    setStories(prev => {
      const idx = prev.findIndex(s => s.id === finalStory.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalStory;
        return next;
      }
      return [finalStory, ...prev];
    });

    supabaseSync.pushStoryProgress(finalStory);
    // Immediately open the newly imported or updated story
    handleOpenStory(finalStory, 'read');
  };

  const handleUpdateReaderSettings = async (newSettings: Partial<ReaderSettings>) => {
    const updated = { ...readerSettings, ...newSettings };
    setReaderSettings(updated);
    await db.saveSetting('readerSettings', updated);
  };

  const handleUpdateTtsSettings = async (newSettings: Partial<TTSSettings>) => {
    const updated = { ...ttsSettings, ...newSettings };
    setTtsSettings(updated);
    ttsEngine.updateSettings(updated);
    await db.saveSetting('ttsSettings', updated);
  };

  const currentChapter = activeStoryChapters.find(c => c.chapterNumber === currentChapterNumber) || activeStoryChapters[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* If reading a story, show ReaderView, otherwise show Main App with Header */}
      {activeStory ? (
        <ReaderView
          story={activeStory}
          chapters={activeStoryChapters}
          currentChapterNumber={currentChapterNumber}
          onSelectChapter={handleSelectChapter}
          onBackToLibrary={() => {
            setActiveStory(null);
            loadLibrary();
          }}
          settings={readerSettings}
          onUpdateSettings={handleUpdateReaderSettings}
          ttsState={ttsState}
          onStartTTS={handleStartTTS}
          onToggleTTS={() => ttsEngine.togglePlayPause()}
          activeSentenceIndex={activeSentenceIndex}
        />
      ) : (
        <>
          <Header
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            onOpenImport={() => setIsImportModalOpen(true)}
            ttsState={ttsState}
            onOpenTTSPlayer={() => setIsFullTTSModalOpen(true)}
            activeStoryTitle={playingStory?.title}
          />

          <main className="flex-1 pb-24">
            {currentTab === 'library' && (
              <LibraryView
                stories={stories}
                onOpenStory={handleOpenStory}
                onToggleFavorite={handleToggleFavorite}
                onDeleteStory={handleDeleteStory}
                onOpenImport={() => setIsImportModalOpen(true)}
                onOpenCrawler={() => setCurrentTab('crawler')}
              />
            )}

            {currentTab === 'crawler' && (
              <CrawlView
                onStoryCrawled={handleImportComplete}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsView
                readerSettings={readerSettings}
                onUpdateReaderSettings={handleUpdateReaderSettings}
                ttsSettings={ttsSettings}
                onUpdateTtsSettings={handleUpdateTtsSettings}
                onLibraryReload={loadLibrary}
              />
            )}
          </main>
        </>
      )}

      {/* Floating Bottom TTS Player & Fullscreen Audio Modal */}
      <TTSPlayerBar
        ttsState={ttsState}
        bookTitle={playingStory?.title || activeStory?.title || 'Chill Reader'}
        author={playingStory?.author || activeStory?.author || 'Tác giả'}
        chapterTitle={currentChapter?.title || 'Chương truyện'}
        coverUrl={playingStory?.coverUrl || activeStory?.coverUrl}
        currentSentenceText={currentSentenceText}
        sentenceIndex={activeSentenceIndex}
        totalSentences={ttsEngine.getTotalSentences()}
        countdownSeconds={countdownSeconds}
        settings={ttsSettings}
        onUpdateSettings={handleUpdateTtsSettings}
        onClosePlayer={() => ttsEngine.stop()}
        isOpenFullModal={isFullTTSModalOpen}
        onSetOpenFullModal={setIsFullTTSModalOpen}
      />

      {/* File Import Modal (.txt, .epub, .pdf) */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};

export default App;
