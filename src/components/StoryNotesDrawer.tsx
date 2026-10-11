import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  BookOpen, 
  User, 
  Sparkles, 
  Sword, 
  FileText, 
  Search
} from 'lucide-react';
import { db, type StoryNote } from '../services/db';

interface StoryNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  storyTitle: string;
}

type NoteCategory = 'character' | 'cultivation' | 'lore' | 'general';

export const StoryNotesDrawer: React.FC<StoryNotesDrawerProps> = ({
  isOpen,
  onClose,
  storyId,
  storyTitle
}) => {
  const [notes, setNotes] = useState<StoryNote[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // New Note Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<NoteCategory>('character');
  const [newContent, setNewContent] = useState('');

  const loadNotes = async () => {
    if (!storyId) return;
    try {
      const data = await db.getStoryNotes(storyId);
      setNotes(data);
    } catch (e) {
      console.warn('Failed to load story notes:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen, storyId]);

  if (!isOpen) return null;

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const note: StoryNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      storyId,
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      updatedAt: Date.now()
    };

    await db.saveStoryNote(note);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
    await loadNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await db.deleteStoryNote(noteId);
    await loadNotes();
  };

  const filteredNotes = notes.filter((n) => {
    const matchesCat = selectedCategory === 'all' || n.category === selectedCategory;
    const matchesQuery = !searchQuery.trim() || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const getCategoryBadge = (cat: NoteCategory) => {
    switch (cat) {
      case 'character':
        return { label: 'Nhân vật', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: User };
      case 'cultivation':
        return { label: 'Cảnh giới', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: Sparkles };
      case 'lore':
        return { label: 'Pháp bảo / Công pháp', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Sword };
      case 'general':
      default:
        return { label: 'Ghi chép', color: 'bg-zinc-700/50 text-zinc-300 border-zinc-600/40', icon: FileText };
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-zinc-900 h-full border-l border-zinc-800 shadow-2xl flex flex-col p-4 sm:p-5 overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-zinc-100 truncate">Sổ Tay Nhân Vật & Cảnh Giới</h2>
              <p className="text-[11px] text-zinc-400 truncate">{storyTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto text-xs no-scrollbar">
          {(['all', 'character', 'cultivation', 'lore', 'general'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat === 'all' && 'Tất cả'}
              {cat === 'character' && 'Nhân vật'}
              {cat === 'cultivation' && 'Cảnh giới'}
              {cat === 'lore' && 'Pháp bảo'}
              {cat === 'general' && 'Ghi chép'}
            </button>
          ))}
        </div>

        {/* Search Input & Add Button */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="Tìm kiếm nhân vật, cảnh giới..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </div>

        {/* New Note Form */}
        {isAdding && (
          <form onSubmit={handleCreateNote} className="mb-3.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tên nhân vật / Cảnh giới / Pháp bảo..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as NoteCategory)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="character">Nhân vật</option>
                <option value="cultivation">Cảnh giới</option>
                <option value="lore">Pháp bảo</option>
                <option value="general">Ghi chép</option>
              </select>
            </div>
            <textarea
              placeholder="Mô tả chi tiết (ví dụ: Quan hệ, cảnh giới hiện tại, môn phái, bảo vật mang theo...)"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                Lưu ghi chú
              </button>
            </div>
          </form>
        )}

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              Chưa có ghi chú nào. Hãy thêm thông tin nhân vật hoặc cảnh giới để đọc truyện không bị quên tình tiết!
            </div>
          ) : (
            filteredNotes.map((note) => {
              const badge = getCategoryBadge(note.category);
              const BadgeIcon = badge.icon;
              return (
                <div 
                  key={note.id}
                  className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border flex items-center gap-1 font-medium ${badge.color}`}>
                        <BadgeIcon className="w-2.5 h-2.5" />
                        {badge.label}
                      </span>
                      <h3 className="font-semibold text-xs text-zinc-100 truncate">{note.title}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                      title="Xóa ghi chú"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {note.content && (
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
