import React, { useRef, useState, useEffect } from 'react';
import { 
  Settings, 
  Download, 
  Upload, 
  Trash2, 
  Volume2, 
  Sparkles,
  Type,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  User
} from 'lucide-react';
import { db } from '../services/db';
import { supabaseSync, type SupabaseConfig } from '../services/sync/supabaseSync';
import { ttsEngine, type VoiceOption } from '../services/tts/ttsEngine';
import type { ReaderSettings, TTSSettings } from '../types';

interface SettingsViewProps {
  readerSettings: ReaderSettings;
  onUpdateReaderSettings: (settings: Partial<ReaderSettings>) => void;
  ttsSettings: TTSSettings;
  onUpdateTtsSettings: (settings: Partial<TTSSettings>) => void;
  onLibraryReload: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  readerSettings,
  onUpdateReaderSettings,
  ttsSettings,
  onUpdateTtsSettings,
  onLibraryReload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud Sync state
  const [cloudConfig, setCloudConfig] = useState<SupabaseConfig>(supabaseSync.getConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // TTS Voice state
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    supabaseSync.init().then(() => {
      setCloudConfig(supabaseSync.getConfig());
    });

    setVoices(ttsEngine.getAllAvailableVoices());
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoices(ttsEngine.getAllAvailableVoices());
      };
    }
  }, []);

  const handleTestVoice = async (voiceId: string) => {
    if (testingVoiceId) return;
    setTestingVoiceId(voiceId);
    try {
      await ttsEngine.testVoice(voiceId);
    } catch (e) {
      console.warn('Test voice error:', e);
    } finally {
      setTestingVoiceId(null);
    }
  };

  const handleTestConnection = async () => {
    if (!cloudConfig.url || !cloudConfig.anonKey) {
      setTestResult({ success: false, message: 'Vui lòng nhập đầy đủ Supabase URL và Anon Key.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await supabaseSync.testConnection(cloudConfig.url, cloudConfig.anonKey);
      setTestResult(res);
      if (res.success) {
        await supabaseSync.updateConfig({ ...cloudConfig, enabled: true });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCloudConfig = async () => {
    await supabaseSync.updateConfig(cloudConfig);
    alert('Đã lưu cấu hình Cloud thành công!');
  };

  const handleSyncNow = async () => {
    if (!supabaseSync.isConnected()) {
      alert('Vui lòng cấu hình và kết nối Supabase trước khi đồng bộ.');
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const result = await supabaseSync.syncAll();
      setSyncStatusMsg(`Đồng bộ thành công! (Đã tải lên: ${result.pushed} mốc, Cập nhật về máy: ${result.pulled} mốc)`);
      onLibraryReload();
    } catch (err: any) {
      setSyncStatusMsg(`Lỗi đồng bộ: ${err?.message || 'Không thể đồng bộ'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export full library backup (JSON)
  const handleExportBackup = async () => {
    try {
      const stories = await db.stories.toArray();
      const chapters = await db.chapters.toArray();
      const backupData = {
        app: 'ChillReader',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        stories,
        chapters,
        readerSettings,
        ttsSettings
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chill_reader_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Có lỗi xảy ra khi sao lưu dữ liệu.');
    }
  };

  // Import library backup (JSON)
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.app !== 'ChillReader' || !Array.isArray(data.stories) || !Array.isArray(data.chapters)) {
        throw new Error('File sao lưu không hợp lệ của Chill Reader.');
      }

      await db.transaction('rw', db.stories, db.chapters, async () => {
        await db.stories.bulkPut(data.stories);
        await db.chapters.bulkPut(data.chapters);
      });

      alert(`Đã khôi phục thành công ${data.stories.length} bộ truyện!`);
      onLibraryReload();
    } catch (err: any) {
      console.error('Import error:', err);
      alert(err?.message || 'Lỗi khi khôi phục dữ liệu.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearAll = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ tủ sách và dữ liệu đọc trên thiết bị này?')) {
      await db.stories.clear();
      await db.chapters.clear();
      alert('Đã xóa toàn bộ tủ sách.');
      onLibraryReload();
    }
  };

  const sqlSchemaText = `-- Tạo bảng lưu tủ truyện và tiến độ đọc đồng bộ đa thiết bị
create table if not exists user_stories (
  id text primary key,
  user_id text not null,
  title text not null,
  author text,
  cover_url text,
  description text,
  total_chapters int default 1,
  current_chapter_number int default 1,
  current_progress_percent float default 0,
  current_sentence_index int default 0,
  source text,
  is_favorite boolean default false,
  last_read_at bigint,
  created_at bigint
);

-- Tắt RLS để bạn dùng cá nhân qua Anon Key đơn giản nhất
alter table user_stories enable row level security;
create policy "Allow all personal operations" on user_stories for all using (true);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-400" />
          Cài đặt & Đồng bộ cá nhân
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Quản lý đồng bộ Cloud, cấu hình đọc, bộ đọc giọng nói và chuyển đổi dữ liệu giữa các thiết bị
        </p>
      </div>

      {/* 1. CLOUD SYNC (SUPABASE) CARD */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                Đồng bộ Online (Supabase Cloud)
                {supabaseSync.isConnected() ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Đã kết nối
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
                    Chưa kích hoạt
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                Tự động đồng bộ chương và câu đang đọc dở giữa Máy tính (Web) và Điện thoại (App Android)
              </p>
            </div>
          </div>

          <button
            onClick={handleSyncNow}
            disabled={isSyncing || !cloudConfig.enabled}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-semibold text-xs transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
          </button>
        </div>

        {syncStatusMsg && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{syncStatusMsg}</span>
          </div>
        )}

        {/* Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              value={cloudConfig.url}
              onChange={(e) => setCloudConfig(prev => ({ ...prev, url: e.target.value.trim() }))}
              placeholder="https://xxxxxxxx.supabase.co"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Supabase Anon Key (Public Key)
            </label>
            <input
              type="password"
              value={cloudConfig.anonKey}
              onChange={(e) => setCloudConfig(prev => ({ ...prev, anonKey: e.target.value.trim() }))}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSyncToggle"
              checked={cloudConfig.autoSync}
              onChange={(e) => setCloudConfig(prev => ({ ...prev, autoSync: e.target.checked }))}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <label htmlFor="autoSyncToggle" className="text-xs text-zinc-300 cursor-pointer">
              Tự động lưu mốc đọc lên Cloud mỗi khi chuyển chương
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
            >
              {isTesting ? 'Đang thử...' : 'Kiểm tra kết nối'}
            </button>
            <button
              onClick={handleSaveCloudConfig}
              className="px-4 py-1.5 rounded-lg bg-zinc-700 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>

        {testResult && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            testResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Collapsible SQL Schema Guide */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
          <button
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="w-full flex items-center justify-between p-3 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              💡 Hướng dẫn tạo bảng Supabase miễn phí (1 phút)
            </span>
            {showSqlGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSqlGuide && (
            <div className="p-4 border-t border-zinc-800 space-y-3 text-xs text-zinc-300">
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>Truy cập <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-amber-400 underline">supabase.com</a> và tạo một Project miễn phí.</li>
                <li>Vào mục <strong>SQL Editor</strong> ở thanh menu bên trái.</li>
                <li>Dán đoạn mã SQL bên dưới rồi bấm <strong>Run</strong>:</li>
              </ol>

              <div className="relative">
                <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                  {sqlSchemaText}
                </pre>
                <button
                  onClick={copySqlToClipboard}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] border border-zinc-700 transition-all"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedSql ? 'Đã copy' : 'Sao chép'}
                </button>
              </div>

              <p className="text-[11px] text-zinc-500">
                Vào <strong>Project Settings &gt; API</strong> để lấy <code>Project URL</code> và <code>anon public key</code> điền vào 2 ô ở trên.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. MANUAL BACKUP & RESTORE (OFFLINE FILE) */}
      <div className="bg-gradient-to-r from-amber-500/10 via-zinc-800 to-zinc-900 border border-amber-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-2">
          <Sparkles className="w-4 h-4" />
          Sao lưu thủ công bằng file (Backup JSON)
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          Nếu không muốn dùng Cloud, bạn có thể xuất toàn bộ sách và tiến độ đọc ra file `.json` nhẹ tênh để lưu trữ hoặc gửi qua Zalo/Drive nạp vào máy khác.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Xuất file sao lưu tủ sách (Backup JSON)
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium text-xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            Khôi phục từ file sao lưu
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportBackup}
          />
        </div>
      </div>

      {/* 3. READER APPEARANCE DEFAULTS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
          <Type className="w-4 h-4 text-amber-400" />
          Giao diện đọc mặc định
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Màu nền ưa thích</label>
            <select
              value={readerSettings.theme}
              onChange={(e) => onUpdateReaderSettings({ theme: e.target.value as any })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="sepia">Vàng giấy Sepia (Bảo vệ mắt)</option>
              <option value="dark">Ban đêm Dark (Dịu nhẹ)</option>
              <option value="amoled">OLED Đen kịt (Tiết kiệm pin)</option>
              <option value="light">Sáng trắng cổ điển</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">Kiểu phông chữ</label>
            <select
              value={readerSettings.fontFamily}
              onChange={(e) => onUpdateReaderSettings({ fontFamily: e.target.value as any })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="lora">Lora (Chữ có chân tiểu thuyết)</option>
              <option value="merriweather">Merriweather (Sách báo)</option>
              <option value="sans">Không chân (Hiện đại, dễ đọc)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. TTS AUDIO & VOICE SETTINGS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              Cấu hình Giọng đọc Audio (TTS)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Hỗ trợ giọng AI Neural truyền cảm tự nhiên, giọng Google và giọng có sẵn trên thiết bị
            </p>
          </div>
        </div>

        {/* Voice Selector with preview */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-zinc-300 block">
            Chọn giọng đọc ưa thích:
          </label>

          <div className="space-y-2">
            {voices.map((v) => {
              const isSelected = (ttsSettings.voiceURI || 'edge:vi-VN-NamMinhNeural') === v.id;
              const isTesting = testingVoiceId === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    onUpdateTtsSettings({ voiceURI: v.id, engine: v.category });
                    ttsEngine.updateSettings({ voiceURI: v.id, engine: v.category });
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                      : 'bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected 
                        ? 'bg-amber-500 text-zinc-950 font-bold' 
                        : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      <User className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>
                          {v.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          v.category === 'ai' 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : v.category === 'google'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {v.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                        {v.description}
                      </p>
                    </div>
                  </div>

                  {/* Audition / Test Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestVoice(v.id);
                    }}
                    disabled={isTesting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                      isTesting
                        ? 'bg-amber-500 text-zinc-950'
                        : isSelected
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-zinc-950'
                        : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                    }`}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang phát...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Nghe thử
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Speed, Pitch, and Behavior Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>Tốc độ đọc</span>
              <span className="font-bold text-amber-400">{ttsSettings.rate || 1.0}x</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[0.8, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    onUpdateTtsSettings({ rate });
                    ttsEngine.updateSettings({ rate });
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    (ttsSettings.rate || 1.0) === rate
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>Cao độ giọng (Pitch)</span>
              <span className="font-bold text-amber-400">
                {(ttsSettings.pitch || 1.0) < 1.0 ? 'Trầm' : (ttsSettings.pitch || 1.0) > 1.0 ? 'Cao' : 'Chuẩn'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Trầm ấm', val: 0.9 },
                { label: 'Chuẩn', val: 1.0 },
                { label: 'Trong trẻo', val: 1.1 }
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => {
                    onUpdateTtsSettings({ pitch: p.val });
                    ttsEngine.updateSettings({ pitch: p.val });
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    (ttsSettings.pitch || 1.0) === p.val
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-800/80">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={ttsSettings.autoNextChapter}
              onChange={(e) => {
                onUpdateTtsSettings({ autoNextChapter: e.target.checked });
                ttsEngine.updateSettings({ autoNextChapter: e.target.checked });
              }}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span>Tự động chuyển chương khi nghe xong</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={ttsSettings.highlightSentence !== false}
              onChange={(e) => {
                onUpdateTtsSettings({ highlightSentence: e.target.checked });
                ttsEngine.updateSettings({ highlightSentence: e.target.checked });
              }}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span>Bôi sáng câu đang đọc trong văn bản</span>
          </label>
        </div>
      </div>

      {/* 5. DATA RESET */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-zinc-100">Dọn dẹp bộ nhớ thiết bị</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Xóa toàn bộ các truyện đã lưu trong IndexedDB của trình duyệt</p>
        </div>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Xóa toàn bộ
        </button>
      </div>

      {/* App Info */}
      <div className="text-center text-xs text-zinc-500 pt-6 space-y-1">
        <p className="font-medium text-zinc-400">Chill Reader • Ứng dụng đọc truyện & nghe audio cá nhân</p>
        <p>Phiên bản 1.0 • Hoàn toàn riêng tư, không quảng cáo, đồng bộ Supabase Cloud đa nền tảng</p>
      </div>
    </div>
  );
};
