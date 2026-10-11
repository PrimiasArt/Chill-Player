import React, { useState, useEffect } from 'react';
import type { MediaItem } from './types';
import { db } from './services/db';
import { Header } from './components/Header';
import { MediaLibrary } from './components/MediaLibrary';
import { VideoPlayer } from './components/VideoPlayer';
import { NetworkStreamModal } from './components/NetworkStreamModal';
import { SettingsModal } from './components/SettingsModal';
import { appUpdater } from './services/appUpdater';

export const App: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Load items from database
  const refreshItems = async () => {
    const list = await db.mediaItems.orderBy('lastPlayedAt').reverse().toArray();
    setMediaItems(list);
  };

  useEffect(() => {
    refreshItems();

    // Check updates in background on launch
    setTimeout(() => {
      appUpdater.checkForUpdates(false).catch(() => {});
    }, 2000);

    // Android hardware back button handler
    const handlePopState = () => {
      if (activeMedia) {
        setActiveMedia(null);
      } else if (isStreamModalOpen) {
        setIsStreamModalOpen(false);
      } else if (isSettingsModalOpen) {
        setIsSettingsModalOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeMedia, isStreamModalOpen, isSettingsModalOpen]);

  // Handle Play
  const handlePlayMedia = (item: MediaItem) => {
    setActiveMedia(item);
  };

  // Next / Previous in list
  const handleNextMedia = () => {
    if (!activeMedia || mediaItems.length === 0) return;
    const idx = mediaItems.findIndex(m => m.id === activeMedia.id);
    if (idx !== -1 && idx < mediaItems.length - 1) {
      setActiveMedia(mediaItems[idx + 1]);
    }
  };

  const handlePrevMedia = () => {
    if (!activeMedia || mediaItems.length === 0) return;
    const idx = mediaItems.findIndex(m => m.id === activeMedia.id);
    if (idx > 0) {
      setActiveMedia(mediaItems[idx - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* If playing, show fullscreen player */}
      {activeMedia ? (
        <VideoPlayer
          media={activeMedia}
          onBack={() => {
            setActiveMedia(null);
            refreshItems();
          }}
          onNextMedia={handleNextMedia}
          onPrevMedia={handlePrevMedia}
        />
      ) : (
        <>
          <Header
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenNetworkStream={() => setIsStreamModalOpen(true)}
          />

          <main className="flex-1 pb-12">
            <MediaLibrary
              items={mediaItems}
              onPlayMedia={handlePlayMedia}
              onOpenNetworkStream={() => setIsStreamModalOpen(true)}
              onRefreshItems={refreshItems}
            />
          </main>
        </>
      )}

      {/* Network Stream Modal */}
      <NetworkStreamModal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        onPlayStream={(streamItem) => {
          db.mediaItems.put(streamItem).then(() => {
            refreshItems();
            setActiveMedia(streamItem);
          });
        }}
      />

      {/* Settings & Updater Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
};

export default App;
