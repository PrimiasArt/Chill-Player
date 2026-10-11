import React, { useState, useEffect } from 'react';
import type { MediaItem } from './types';
import { db } from './services/db';
import { Header } from './components/Header';
import { MediaLibrary } from './components/MediaLibrary';
import { VideoPlayer } from './components/VideoPlayer';
import { VaultView } from './components/VaultView';
import { NetworkStreamModal } from './components/NetworkStreamModal';
import { SettingsModal } from './components/SettingsModal';
import { appUpdater } from './services/appUpdater';
import { vaultService } from './services/vaultService';
import { backButtonService, useBackButton } from './services/backButton';
import { Film, Lock, Globe, Settings, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'library' | 'vault'>('library');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Initialize hardware back button listener for Android
  useEffect(() => {
    backButtonService.init();
  }, []);

  // Back button handling when modals or vault are active (when player is not active)
  useBackButton(() => {
    setIsStreamModalOpen(false);
  }, isStreamModalOpen && !activeMedia);

  useBackButton(() => {
    setIsSettingsModalOpen(false);
  }, isSettingsModalOpen && !activeMedia);

  useBackButton(() => {
    setCurrentView('library');
  }, currentView === 'vault' && !activeMedia && !isStreamModalOpen && !isSettingsModalOpen);

  // Load items from database
  const refreshItems = async () => {
    const list = await db.mediaItems.orderBy('lastPlayedAt').reverse().toArray();
    list.forEach(item => {
      if (item.fileBlob) {
        item.url = URL.createObjectURL(item.fileBlob);
      }
    });
    setMediaItems(list);
  };

  useEffect(() => {
    refreshItems();

    // Check updates in background on launch
    setTimeout(() => {
      appUpdater.checkForUpdates(false).catch(() => {});
    }, 2000);
  }, []);

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

  const handleClosePlayer = () => {
    if (activeMedia && activeMedia.id.startsWith('vault_')) {
      vaultService.releaseMemoryUrl(activeMedia.id);
    }
    setActiveMedia(null);
    refreshItems();
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans relative selection:bg-emerald-500/30">
      {/* If playing, show fullscreen player */}
      {activeMedia ? (
        <VideoPlayer
          media={activeMedia}
          onBack={handleClosePlayer}
          onNextMedia={handleNextMedia}
          onPrevMedia={handlePrevMedia}
        />
      ) : (
        <>
          <Header
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenNetworkStream={() => setIsStreamModalOpen(true)}
            onOpenVault={() => setCurrentView(currentView === 'vault' ? 'library' : 'vault')}
            isVaultActive={currentView === 'vault'}
          />

          <main className="flex-1 pb-28">
            {currentView === 'vault' ? (
              <VaultView
                onPlayVaultMedia={handlePlayMedia}
                onBackToLibrary={() => setCurrentView('library')}
              />
            ) : (
              <MediaLibrary
                items={mediaItems}
                onPlayMedia={handlePlayMedia}
                onOpenNetworkStream={() => setIsStreamModalOpen(true)}
                onRefreshItems={refreshItems}
                onOpenVault={() => setCurrentView('vault')}
              />
            )}
          </main>

          {/* visionOS Floating Capsule Bottom Dock */}
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <nav className="flex items-center gap-1.5 p-1.5 rounded-full vision-capsule shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/20">
              <button
                onClick={() => setCurrentView('library')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  currentView === 'library'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/30 scale-105'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>Thư viện</span>
              </button>

              <button
                onClick={() => setCurrentView('vault')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  currentView === 'vault'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/30 scale-105'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Két Ẩn</span>
              </button>

              <button
                onClick={() => setIsStreamModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <Globe className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Stream</span>
              </button>

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Cài đặt"
              >
                <Settings className="w-4 h-4" />
              </button>
            </nav>
          </div>
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
