import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Link as LinkIcon, ExternalLink, Copy, Check, Star, 
  Trash2, Plus, ArrowLeft, Bookmark, Heart, Globe, AlertCircle 
} from 'lucide-react';
import { VaultLink } from '../types';
import { getAllFromStore, addToStore, updateInStore, deleteFromStore } from '../lib/db';

interface LinksTabProps {
  onNotify: (message: string, type: 'success' | 'error') => void;
  searchTerm: string;
}

export default function LinksTab({ onNotify, searchTerm }: LinksTabProps) {
  const [links, setLinks] = useState<VaultLink[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<VaultLink[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Editor states
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [url, setUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    loadLinks();
  }, []);

  useEffect(() => {
    filterAndSearchLinks();
  }, [links, searchTerm]);

  const loadLinks = async () => {
    try {
      const data = await getAllFromStore<VaultLink>('links');
      setLinks(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      onNotify('Failed to fetch links', 'error');
    }
  };

  const filterAndSearchLinks = () => {
    let result = [...links];

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(lnk => 
        lnk.title.toLowerCase().includes(term) || 
        lnk.url.toLowerCase().includes(term)
      );
    }

    setFilteredLinks(result);
  };

  // Auto title suggestion based on URL host string
  const handleUrlChange = (val: string) => {
    setUrl(val);
    
    if (!title && val.trim() !== '') {
      try {
        let host = '';
        if (val.startsWith('http://') || val.startsWith('https://')) {
          host = new URL(val).hostname;
        } else {
          host = new URL('https://' + val).hostname;
        }
        
        // Clean hostname (e.g. "www.github.com" -> "Github")
        let clean = host.replace('www.', '').split('.')[0];
        if (clean) {
          const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
          setTitle(capitalized);
        }
      } catch (e) {
        // quiet ignore for invalid URL drafts
      }
    }
  };

  const saveLink = async () => {
    if (!url.trim()) {
      onNotify('URL path is required', 'error');
      return;
    }

    // Format URL correctly
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      const newLnk: Omit<VaultLink, 'id'> = {
        title: title.trim() || formattedUrl.replace('https://', '').replace('www.', '').split('/')[0],
        url: formattedUrl,
        favorite: false,
        timestamp: Date.now()
      };

      await addToStore('links', newLnk);
      onNotify('Link saved securely', 'success');
      setUrl('');
      setTitle('');
      setIsAdding(false);
      loadLinks();
    } catch (err) {
      onNotify('Failed to save link', 'error');
    }
  };

  const copyToClipboard = async (lnk: VaultLink) => {
    try {
      await navigator.clipboard.writeText(lnk.url);
      setCopiedId(lnk.id || null);
      onNotify('Copied link to clipboard', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      onNotify('Failed to copy', 'error');
    }
  };

  const deleteLink = async (id: number) => {
    if (!window.confirm('Erase this link?')) return;
    try {
      await deleteFromStore('links', id);
      onNotify('Link erased', 'success');
      loadLinks();
    } catch (err) {
      onNotify('Failed to delete link', 'error');
    }
  };

  const toggleFavorite = async (lnk: VaultLink) => {
    try {
      const updated = { ...lnk, favorite: !lnk.favorite };
      await updateInStore('links', updated);
      onNotify(updated.favorite ? 'Marked as favorite' : 'Removed from favorites', 'success');
      loadLinks();
    } catch (err) {
      onNotify('Failed to update favorite', 'error');
    }
  };

  return (
    <div id="links-tab-root" className="w-full flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        {!isAdding ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col px-4 py-2 pb-24"
          >
            {filteredLinks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-gray-500">
                <Globe className="w-12 h-12 text-purple-950 mb-2" />
                <p className="text-sm">No web links saved.</p>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="mt-4 text-xs font-semibold text-[#C77DFF] hover:underline"
                >
                  Add Secure Link
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredLinks.map((lnk) => (
                  <motion.div
                    key={lnk.id}
                    layoutId={`link-card-${lnk.id}`}
                    className="p-4 rounded-2xl bg-gradient-to-br from-[#1A1A1A] to-[#141414] border border-purple-950/15 flex items-center justify-between gap-4 hover:border-purple-800/35 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo or Glob icon */}
                      <div className="w-10 h-10 rounded-xl bg-[#23153C] border border-[#7B2FF7]/20 flex items-center justify-center text-[#C77DFF] flex-shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>

                      {/* Content details */}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-100 truncate pr-2 hover:text-[#C77DFF] transition-colors duration-200">
                          {lnk.title}
                        </h3>
                        <a 
                          href={lnk.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-gray-400 hover:underline flex items-center gap-1 mt-0.5 truncate"
                        >
                          <span className="truncate">{lnk.url}</span>
                          <ExternalLink className="w-3 h-3 text-[#9D4EDD] flex-shrink-0" />
                        </a>
                      </div>
                    </div>

                    {/* Quick Access Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleFavorite(lnk)}
                        className="p-2 rounded-xl bg-[#101010] hover:bg-[#202020] border border-purple-950/20 text-gray-500 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <Heart className={`w-3.5 h-3.5 ${lnk.favorite ? 'text-red-500 fill-red-500' : ''}`} />
                      </button>

                      <button
                        onClick={() => copyToClipboard(lnk)}
                        className="p-2 rounded-xl bg-[#101010] hover:bg-[#202020] border border-purple-950/20 text-gray-400 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedId === lnk.id ? (
                          <Check className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => deleteLink(lnk.id!)}
                        className="p-2 rounded-xl bg-[#101010] hover:bg-red-950/20 border border-purple-950/20 text-gray-500 hover:text-red-400 hover:border-red-950 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Quick action trigger inside LinksTab */}
            <div className="fixed bottom-20 right-6 z-40">
              <button
                onClick={() => setIsAdding(true)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-[#7B2FF7] to-[#C77DFF] hover:from-[#9D4EDD] hover:to-[#C77DFF] flex items-center justify-center shadow-[0_4px_20px_rgba(123,47,247,0.5)] active:scale-95 transition-all text-white cursor-pointer"
              >
                <Plus className="w-7 h-7" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* Create Form Mode */
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col bg-[#0A0A0A] p-4 pb-20"
          >
            <div className="flex items-center justify-between pb-3 border-b border-purple-950/30">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Links Directory</span>
              </button>
              
              <button
                onClick={saveLink}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] text-xs font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Link</span>
              </button>
            </div>

            <div className="flex flex-col mt-6 gap-5 max-w-md mx-auto w-full bg-[#141414] border border-purple-950/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-[#C77DFF] border-b border-purple-950/20 pb-2">
                <LinkIcon className="w-4 h-4" />
                <span>ADD WEBSITE LOCKER</span>
              </div>

              {/* URL input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Website URL</label>
                <input
                  type="text"
                  placeholder="e.g. github.com/settings"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-sm rounded-xl px-3.5 py-2.5 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              {/* Title input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Display Title</label>
                  <span className="text-[9px] font-mono text-purple-400">Auto-suggest enabled</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. GitHub Dashboard"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-sm rounded-xl px-3.5 py-2.5 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              <div className="text-[10px] text-gray-500 leading-relaxed flex items-start gap-1.5 bg-purple-950/5 p-3 rounded-2xl border border-purple-950/10">
                <AlertCircle className="w-4 h-4 text-[#C77DFF] flex-shrink-0 mt-0.5" />
                <span>Web URLs are stored offline. You can launch links directly or copy them without exposing secrets.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
