import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pin, Search, Plus, Trash2, Edit3, Bookmark, 
  BookmarkCheck, Bold, Italic, List, Highlighter, 
  Code, Tag, Check, Calendar, ArrowLeft, FolderPlus,
  AlertCircle
} from 'lucide-react';
import { VaultNote } from '../types';
import { getAllFromStore, addToStore, updateInStore, deleteFromStore } from '../lib/db';

interface NotesTabProps {
  onNotify: (message: string, type: 'success' | 'error') => void;
  searchTerm: string;
}

const CATEGORIES = ['All', 'Personal', 'Work', 'Finance', 'Ideas', 'Secrets'];

export default function NotesTab({ onNotify, searchTerm }: NotesTabProps) {
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<VaultNote[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  
  // Drawer / Editor state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentNote, setCurrentNote] = useState<Partial<VaultNote> | null>(null);
  
  // Editor inputs
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [category, setCategory] = useState<string>('Personal');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState<boolean>(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    filterAndSearchNotes();
  }, [notes, activeCategory, searchTerm]);

  const loadNotes = async () => {
    try {
      const data = await getAllFromStore<VaultNote>('notes');
      // Sort: pinned first, then newest first
      const sorted = data.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
      setNotes(sorted);
    } catch (err) {
      onNotify('Failed to fetch notes', 'error');
    }
  };

  const filterAndSearchNotes = () => {
    let result = [...notes];
    
    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter(n => n.category === activeCategory);
    }
    
    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(term) || 
        n.content.toLowerCase().includes(term) ||
        n.tags.some(t => t.toLowerCase().includes(term))
      );
    }
    
    setFilteredNotes(result);
  };

  const openNewNote = () => {
    setCurrentNote(null);
    setTitle('');
    setContent('');
    setCategory('Personal');
    setTags([]);
    setTagInput('');
    setPinned(false);
    setIsEditing(true);
  };

  const openEditNote = (note: VaultNote) => {
    setCurrentNote(note);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTags(note.tags || []);
    setTagInput('');
    setPinned(note.pinned || false);
    setIsEditing(true);
  };

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) {
      onNotify('Note title or content is required', 'error');
      return;
    }

    try {
      const noteData: Omit<VaultNote, 'id'> = {
        title: title || 'Untitled Note',
        content: content,
        category: category,
        tags: tags,
        pinned: pinned,
        favorite: currentNote?.favorite || false,
        timestamp: Date.now()
      };

      if (currentNote && currentNote.id) {
        await updateInStore('notes', { ...noteData, id: currentNote.id });
        onNotify('Note updated successfully', 'success');
      } else {
        await addToStore('notes', noteData);
        onNotify('Note saved successfully', 'success');
      }
      
      setIsEditing(false);
      loadNotes();
    } catch (err) {
      onNotify('Failed to save note', 'error');
    }
  };

  const deleteNote = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await deleteFromStore('notes', id);
      onNotify('Note deleted', 'success');
      if (isEditing && currentNote?.id === id) {
        setIsEditing(false);
      }
      loadNotes();
    } catch (err) {
      onNotify('Failed to delete note', 'error');
    }
  };

  const togglePin = async (note: VaultNote, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = { ...note, pinned: !note.pinned };
      await updateInStore('notes', updated);
      onNotify(updated.pinned ? 'Note pinned to top' : 'Note unpinned', 'success');
      loadNotes();
    } catch (err) {
      onNotify('Failed to pin/unpin note', 'error');
    }
  };

  const toggleFavorite = async (note: VaultNote, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = { ...note, favorite: !note.favorite };
      await updateInStore('notes', updated);
      onNotify(updated.favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
      loadNotes();
    } catch (err) {
      onNotify('Failed to update favorite status', 'error');
    }
  };

  // Tag helper
  const addTag = () => {
    const clean = tagInput.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, i) => i !== indexToRemove));
  };

  // Rich formatting helper functions (inserts rich elements into selected text)
  const formatText = (syntax: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let replacement = '';
    if (syntax === 'bold') replacement = `**${selected || 'bold text'}**`;
    else if (syntax === 'italic') replacement = `_${selected || 'italic text'}_`;
    else if (syntax === 'list') replacement = `\n- ${selected || 'list item'}`;
    else if (syntax === 'highlight') replacement = `==${selected || 'highlighted text'}==`;
    else if (syntax === 'code') replacement = `\`${selected || 'code code'}\``;

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setContent(newContent);
    
    // Reset cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2 + (selected || 'text').length);
    }, 50);
  };

  // Helper to parse notes markdown styles on screen
  const renderNotePreview = (text: string) => {
    if (!text) return 'Empty Note...';
    // Clean preview snippet without markdown formatting syntax for neat view
    let clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/==(.*?)==/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\n- /g, ' ');
    if (clean.length > 80) return clean.slice(0, 80) + '...';
    return clean;
  };

  return (
    <div id="notes-tab-root" className="w-full flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col"
          >
            {/* Category horizontal scroller */}
            <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] text-white shadow-[0_2px_10px_rgba(123,47,247,0.4)]'
                      : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-purple-900/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Note Grid */}
            <div className="flex-1 px-4 py-3 overflow-y-auto pb-24">
              {filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 text-purple-900 mb-2 animate-bounce" />
                  <p className="text-sm">No notes found in this folder.</p>
                  <button 
                    onClick={openNewNote}
                    className="mt-4 text-xs font-semibold text-[#C77DFF] hover:underline"
                  >
                    Create Your First Note
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredNotes.map((note) => (
                    <motion.div
                      key={note.id}
                      onClick={() => openEditNote(note)}
                      layoutId={`note-card-${note.id}`}
                      className="group relative bg-gradient-to-br from-[#1E1E1E] to-[#151515] p-4 rounded-2xl border border-purple-950/20 hover:border-purple-800/40 shadow-md hover:shadow-[0_0_15px_rgba(123,47,247,0.1)] transition-all duration-300 flex flex-col justify-between cursor-pointer"
                    >
                      {/* Note Header */}
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-gray-100 text-sm tracking-tight line-clamp-1 group-hover:text-[#C77DFF] transition-colors duration-200">
                            {note.title}
                          </h3>
                          <div className="flex items-center gap-1">
                            {note.pinned && (
                              <button 
                                onClick={(e) => togglePin(note, e)}
                                className="p-1 rounded-full text-[#C77DFF] hover:bg-purple-950/30 transition-all"
                              >
                                <Pin className="w-3.5 h-3.5 fill-[#C77DFF]" />
                              </button>
                            )}
                            <button
                              onClick={(e) => toggleFavorite(note, e)}
                              className="p-1 rounded-full text-gray-500 hover:text-yellow-400 hover:bg-purple-950/30 transition-all"
                            >
                              <Bookmark className={`w-3.5 h-3.5 ${note.favorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Note Snippet */}
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                          {renderNotePreview(note.content)}
                        </p>
                      </div>

                      {/* Note Footer */}
                      <div className="mt-4 pt-3 border-t border-purple-900/10 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-[#9D4EDD] bg-[#2D124D]/40 px-2 py-0.5 rounded-full border border-purple-900/25">
                          {note.category}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {note.tags && note.tags.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="text-[9px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-medium">
                              #{t}
                            </span>
                          ))}
                          <span className="text-[9px] font-mono text-gray-600">
                            {new Date(note.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick action button inside the tab scope */}
            <div className="fixed bottom-20 right-6 z-40">
              <button
                onClick={openNewNote}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-[#7B2FF7] to-[#C77DFF] hover:from-[#9D4EDD] hover:to-[#C77DFF] flex items-center justify-center shadow-[0_4px_20px_rgba(123,47,247,0.5)] active:scale-95 transition-all text-white cursor-pointer"
              >
                <Plus className="w-7 h-7" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* Secure Drawer/Editor Mode */
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col bg-[#0A0A0A] p-4 pb-20"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-purple-950/30">
              <button 
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Vault Notes</span>
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPinned(!pinned)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    pinned 
                      ? 'bg-[#7B2FF7]/15 border-[#7B2FF7] text-[#C77DFF]' 
                      : 'bg-[#1A1A1A] border-purple-950/20 text-gray-400'
                  }`}
                  title="Pin note"
                >
                  <Pin className="w-4 h-4" />
                </button>
                {currentNote?.id && (
                  <button
                    onClick={() => deleteNote(currentNote.id!)}
                    className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-red-950/30 border border-purple-950/20 text-red-400 hover:border-red-800 transition-all cursor-pointer"
                    title="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={saveNote}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] hover:from-[#9D4EDD] text-xs font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* Note Editor Body */}
            <div className="flex-1 flex flex-col mt-4 gap-3">
              {/* Category selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">Section:</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-[#161616] border border-purple-950/40 text-gray-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#7B2FF7] outline-none"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Title Input */}
              <input
                type="text"
                placeholder="Note Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-white placeholder-gray-600 outline-none border-b border-transparent focus:border-purple-900/30 pb-1"
              />

              {/* Rich text helper bar */}
              <div className="flex items-center gap-1.5 p-1 bg-[#151515] rounded-lg border border-purple-950/20 max-w-max">
                <button 
                  onClick={() => formatText('bold')}
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-900/20 transition-all"
                  title="Bold (**text**)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => formatText('italic')}
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-900/20 transition-all"
                  title="Italic (_text_)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => formatText('list')}
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-900/20 transition-all"
                  title="Bullet List (- item)"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-purple-950/40 mx-1" />
                <button 
                  onClick={() => formatText('highlight')}
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-900/20 transition-all"
                  title="Highlight (==text==)"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => formatText('code')}
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-purple-900/20 transition-all"
                  title="Code (`text`)"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content Textarea */}
              <textarea
                ref={textareaRef}
                placeholder="Start typing secrets or logs... Shortcuts enabled."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-700 outline-none resize-none leading-relaxed min-h-[180px]"
              />

              {/* Tags Section */}
              <div className="border-t border-purple-950/20 pt-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="flex items-center gap-1 text-[11px] font-medium bg-[#1F1235] text-[#C77DFF] px-2 py-0.5 rounded-full border border-purple-900/30"
                    >
                      <span>#{tag}</span>
                      <button 
                        onClick={() => removeTag(idx)} 
                        className="hover:text-red-400 ml-1 transition-colors"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 max-w-xs">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Add tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      className="w-full bg-[#121212] border border-purple-950/30 text-xs rounded-xl pl-8 pr-3 py-1.5 text-gray-200 outline-none focus:border-[#7B2FF7]"
                    />
                  </div>
                  <button 
                    onClick={addTag}
                    className="px-3 py-1.5 bg-[#1C1C1C] text-xs font-semibold rounded-xl text-gray-300 hover:text-white border border-purple-950/15"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
