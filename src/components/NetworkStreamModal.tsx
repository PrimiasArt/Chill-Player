import React, { useState } from 'react';
import { Globe, X, Play, Link2, Sparkles, AlertCircle } from 'lucide-react';
import type { MediaItem } from '../types';

interface NetworkStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayStream: (streamItem: MediaItem) => void;
}

const SAMPLE_STREAMS = [
  {
    title: 'Big Buck Bunny (HLS Stream Demo)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    format: 'm3u8'
  },
  {
    title: 'Tears of Steel (4K Sci-Fi Short Movie)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    format: 'mp4'
  },
  {
    title: 'Elephants Dream (Classic Open Movie)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    format: 'mp4'
  }
];

export const NetworkStreamModal: React.FC<NetworkStreamModalProps> = ({
  isOpen,
  onClose,
  onPlayStream
}) => {
  const [streamUrl, setStreamUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartPlay = (urlToPlay: string, titleToPlay: string) => {
    const trimmed = urlToPlay.trim();
    if (!trimmed) {
      setError('Vui lòng nhập đường dẫn phát sóng (URL).');
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError('Định dạng URL không hợp lệ (cần bắt đầu bằng http:// hoặc https://).');
      return;
    }

    const isM3u8 = trimmed.toLowerCase().includes('.m3u8');
    const isMp4 = trimmed.toLowerCase().includes('.mp4');
    const ext = isM3u8 ? 'm3u8' : isMp4 ? 'mp4' : 'stream';

    const item: MediaItem = {
      id: `stream_${Date.now()}`,
      title: titleToPlay.trim() || trimmed.split('/').pop()?.split('?')[0] || 'Luồng Trực Tuyến',
      url: trimmed,
      type: 'stream',
      duration: 0,
      currentTime: 0,
      progressPercent: 0,
      format: ext,
      isFavorite: false,
      lastPlayedAt: Date.now(),
      createdAt: Date.now()
    };

    onPlayStream(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 text-zinc-100 font-bold text-base">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <span>Mở Luồng Trực Tuyến (Network Stream)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Đường dẫn Video / Audio (HLS .m3u8, MP4, WebM, MKV...):
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://example.com/live/stream.m3u8"
                value={streamUrl}
                onChange={(e) => {
                  setStreamUrl(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <Link2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Tên gợi nhớ (Tùy chọn):
            </label>
            <input
              type="text"
              placeholder="VD: Kênh phim tài liệu, Nhạc Lo-fi trực tiếp..."
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sample Streams */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Hoặc thử nhanh các luồng mẫu:
            </span>
            <div className="space-y-1.5">
              {SAMPLE_STREAMS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleStartPlay(s.url, s.title)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-left flex items-center justify-between text-xs text-zinc-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-mono group-hover:bg-emerald-500 group-hover:text-zinc-950 font-bold transition-colors">
                    {s.format}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={() => handleStartPlay(streamUrl, streamTitle)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Phát Ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
};
