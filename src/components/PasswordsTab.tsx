import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Eye, EyeOff, Copy, Check, Star, Trash2, Plus, 
  ArrowLeft, RefreshCw, Sliders, ShieldAlert, KeyRound, 
  User, Bookmark, AlertCircle, Sparkles, FolderLock 
} from 'lucide-react';
import { VaultPassword } from '../types';
import { getAllFromStore, addToStore, updateInStore, deleteFromStore } from '../lib/db';

interface PasswordsTabProps {
  onNotify: (message: string, type: 'success' | 'error') => void;
  searchTerm: string;
}

const CATEGORIES = ['All', 'Finance', 'Social', 'Email', 'Work', 'Utilities'];

export default function PasswordsTab({ onNotify, searchTerm }: PasswordsTabProps) {
  const [passwords, setPasswords] = useState<VaultPassword[]>([]);
  const [filteredPasswords, setFilteredPasswords] = useState<VaultPassword[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [revealMap, setRevealMap] = useState<Record<number, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

  // Form states
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [service, setService] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [category, setCategory] = useState<string>('Finance');

  // Generator states
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [genLength, setGenLength] = useState<number>(14);
  const [genUpper, setGenUpper] = useState<boolean>(true);
  const [genLower, setGenLower] = useState<boolean>(true);
  const [genNumbers, setGenNumbers] = useState<boolean>(true);
  const [genSymbols, setGenSymbols] = useState<boolean>(true);

  useEffect(() => {
    loadPasswords();
  }, []);

  useEffect(() => {
    filterAndSearchPasswords();
  }, [passwords, activeCategory, searchTerm]);

  const loadPasswords = async () => {
    try {
      const data = await getAllFromStore<VaultPassword>('passwords');
      setPasswords(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      onNotify('Failed to fetch passwords', 'error');
    }
  };

  const filterAndSearchPasswords = () => {
    let result = [...passwords];

    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter(pw => pw.category === activeCategory);
    }

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(pw => 
        pw.service.toLowerCase().includes(term) || 
        pw.username.toLowerCase().includes(term)
      );
    }

    setFilteredPasswords(result);
  };

  // Real-time password strength analyzer
  const analyzeStrength = (val: string): 'weak' | 'medium' | 'strong' => {
    if (!val) return 'weak';
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  };

  // Generate strong passwords
  const generatePassword = () => {
    let chars = '';
    if (genUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (genNumbers) chars += '0123456789';
    if (genSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) {
      onNotify('Select at least one character set', 'error');
      return;
    }

    let generated = '';
    for (let i = 0; i < genLength; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      generated += chars[idx];
    }

    setPassword(generated);
    onNotify('Generated strong password suggested', 'success');
  };

  const savePassword = async () => {
    if (!service.trim() || !username.trim() || !password.trim()) {
      onNotify('All credential fields are required', 'error');
      return;
    }

    try {
      const newCred: Omit<VaultPassword, 'id'> = {
        service: service.trim(),
        username: username.trim(),
        password: password.trim(),
        category,
        favorite: false,
        strength: analyzeStrength(password),
        timestamp: Date.now()
      };

      await addToStore('passwords', newCred);
      onNotify('Credentials stored securely', 'success');
      
      // Reset inputs
      setService('');
      setUsername('');
      setPassword('');
      setCategory('Finance');
      setIsAdding(false);
      loadPasswords();
    } catch (err) {
      onNotify('Failed to save password', 'error');
    }
  };

  const deletePassword = async (id: number) => {
    if (!window.confirm('Delete this credentials record?')) return;
    try {
      await deleteFromStore('passwords', id);
      onNotify('Credentials deleted', 'success');
      loadPasswords();
    } catch (err) {
      onNotify('Failed to delete credentials', 'error');
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMap(prev => ({ ...prev, [key]: true }));
      onNotify('Copied to clipboard', 'success');
      setTimeout(() => {
        setCopiedMap(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      onNotify('Failed to copy', 'error');
    }
  };

  const toggleReveal = (id: number) => {
    setRevealMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFavorite = async (pw: VaultPassword) => {
    try {
      const updated = { ...pw, favorite: !pw.favorite };
      await updateInStore('passwords', updated);
      onNotify(updated.favorite ? 'Marked as favorite' : 'Removed from favorites', 'success');
      loadPasswords();
    } catch (err) {
      onNotify('Failed to update favorite', 'error');
    }
  };

  const strengthColor = (str: 'weak' | 'medium' | 'strong') => {
    if (str === 'weak') return 'bg-red-500 border-red-500/25 text-red-400';
    if (str === 'medium') return 'bg-yellow-500 border-yellow-500/25 text-yellow-400';
    return 'bg-green-500 border-green-500/25 text-green-400';
  };

  return (
    <div id="passwords-tab-root" className="w-full flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        {!isAdding ? (
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

            {/* List */}
            <div className="flex-1 px-4 py-3 overflow-y-auto pb-24 flex flex-col gap-3">
              {filteredPasswords.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-gray-500">
                  <FolderLock className="w-12 h-12 text-purple-950 mb-2 animate-pulse" />
                  <p className="text-sm">No security passwords stored here.</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="mt-4 text-xs font-semibold text-[#C77DFF] hover:underline"
                  >
                    Add Secure Credentials
                  </button>
                </div>
              ) : (
                filteredPasswords.map((pw) => (
                  <motion.div
                    key={pw.id}
                    layoutId={`pw-card-${pw.id}`}
                    className="p-4 rounded-2xl bg-gradient-to-br from-[#1A1A1A] to-[#121212] border border-purple-950/20 flex flex-col gap-3.5 hover:border-purple-800/40 shadow-md transition-all duration-300"
                  >
                    {/* Header Details */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1E113A] to-[#2E154F] border border-purple-900/25 flex items-center justify-center text-[#C77DFF]">
                          <Lock className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-100">{pw.service}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{pw.category}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Strength meter indicator */}
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${strengthColor(pw.strength)} bg-opacity-10`}>
                          {pw.strength}
                        </span>

                        <button
                          onClick={() => toggleFavorite(pw)}
                          className="p-2 text-gray-500 hover:text-yellow-400 rounded-full hover:bg-[#201530] transition-colors cursor-pointer"
                        >
                          <Star className={`w-3.5 h-3.5 ${pw.favorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                        </button>
                        
                        <button
                          onClick={() => deletePassword(pw.id!)}
                          className="p-2 text-gray-500 hover:text-red-400 rounded-full hover:bg-[#201530] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Password/Username fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#0C0C0C] p-3 rounded-xl border border-purple-950/10 text-xs">
                      {/* Username Row */}
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-gray-400 truncate">{pw.username}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(pw.username, `${pw.id}-user`)}
                          className="p-1 rounded bg-[#161616] text-gray-400 hover:text-white hover:bg-purple-950/30 cursor-pointer"
                        >
                          {copiedMap[`${pw.id}-user`] ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Password Row */}
                      <div className="flex justify-between items-center gap-2 border-t sm:border-t-0 sm:border-l border-purple-950/20 pt-2 sm:pt-0 sm:pl-3">
                        <div className="flex items-center gap-1.5 truncate">
                          <KeyRound className="w-3.5 h-3.5 text-gray-500" />
                          <span className="font-mono text-gray-300 select-none">
                            {revealMap[pw.id!] ? pw.password : '••••••••••••'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleReveal(pw.id!)}
                            className="p-1 rounded bg-[#161616] text-gray-400 hover:text-white hover:bg-purple-950/30 cursor-pointer"
                          >
                            {revealMap[pw.id!] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(pw.password, `${pw.id}-pw`)}
                            className="p-1 rounded bg-[#161616] text-gray-400 hover:text-white hover:bg-purple-950/30 cursor-pointer"
                          >
                            {copiedMap[`${pw.id}-pw`] ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Quick Action Trigger inside PasswordsTab */}
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
            className="flex-1 flex flex-col bg-[#0A0A0A] p-4 pb-20 overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-purple-950/30">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Credentials Vault</span>
              </button>
              
              <button
                onClick={savePassword}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] text-xs font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save credentials</span>
              </button>
            </div>

            <div className="flex flex-col mt-6 gap-4 max-w-md mx-auto w-full bg-[#141414] border border-purple-950/30 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-[#C77DFF] border-b border-purple-950/20 pb-2">
                <Lock className="w-4 h-4" />
                <span>ADD SECURE CREDENTIALS</span>
              </div>

              {/* Service Title */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, PayPal, Bank Account"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-sm rounded-xl px-3.5 py-2.5 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Storage Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-sm rounded-xl px-3.5 py-2.5 text-gray-200 outline-none focus:border-[#7B2FF7]"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Username / Email</label>
                <input
                  type="text"
                  placeholder="e.g. user@gmail.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-sm rounded-xl px-3.5 py-2.5 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              {/* Password and generator triggers */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Secure Password</label>
                  <button
                    type="button"
                    onClick={() => setIsGeneratorOpen(!isGeneratorOpen)}
                    className="text-[10px] font-bold text-[#C77DFF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#C77DFF] animate-pulse" />
                    <span>{isGeneratorOpen ? 'Hide generator' : 'Suggest password'}</span>
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter custom password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-purple-950/40 text-sm rounded-xl pl-3.5 pr-12 py-2.5 text-gray-200 outline-none focus:border-[#7B2FF7] font-mono"
                  />
                  
                  {password && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${strengthColor(analyzeStrength(password))} bg-opacity-10`}>
                        {analyzeStrength(password)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Embedded Generator Panels */}
              <AnimatePresence>
                {isGeneratorOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-[#0A0A0A] p-4 rounded-2xl border border-[#7B2FF7]/20 flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-center border-b border-purple-950/20 pb-2">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5 text-[#C77DFF]" />
                        <span>Generator Settings</span>
                      </span>
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="text-[11px] bg-[#1E113C] text-[#C77DFF] px-2.5 py-1 rounded-lg border border-[#7B2FF7]/35 flex items-center gap-1 font-semibold hover:bg-purple-900/10 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate</span>
                      </button>
                    </div>

                    {/* Length Slider */}
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between text-gray-400 font-mono text-[10px]">
                        <span>Character Length:</span>
                        <span className="font-bold text-white">{genLength}</span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="32"
                        value={genLength}
                        onChange={(e) => setGenLength(parseInt(e.target.value))}
                        className="w-full accent-[#7B2FF7]"
                      />
                    </div>

                    {/* Toggle rules */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[
                        { label: 'Uppercase (A-Z)', val: genUpper, set: setGenUpper },
                        { label: 'Lowercase (a-z)', val: genLower, set: setGenLower },
                        { label: 'Numbers (0-9)', val: genNumbers, set: setGenNumbers },
                        { label: 'Symbols (!@#)', val: genSymbols, set: setGenSymbols },
                      ].map((cfg, idx) => (
                        <label key={idx} className="flex items-center gap-1.5 text-gray-400 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cfg.val}
                            onChange={(e) => cfg.set(e.target.checked)}
                            className="accent-[#7B2FF7] h-3.5 w-3.5 rounded"
                          />
                          <span>{cfg.label}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
