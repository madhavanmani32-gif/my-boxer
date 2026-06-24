import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Search, Lock, FolderLock, Image as ImageIcon, FileText, 
  Globe, KeyRound, Settings as SettingsIcon, LogOut, Plus, X, 
  ArrowLeft, Star, Heart, HardDrive, LayoutDashboard, ChevronRight, CheckCircle, AlertCircle
} from 'lucide-react';

import { getSetting, setSetting, getAllFromStore, calculateStorageUsage, StorageDetails } from './lib/db';
import { VaultNote, VaultImage, VaultLink, VaultPassword } from './types';

// Modular Component imports
import LockScreen from './components/LockScreen';
import NotesTab from './components/NotesTab';
import ImagesTab from './components/ImagesTab';
import LinksTab from './components/LinksTab';
import PasswordsTab from './components/PasswordsTab';
import SettingsTab from './components/SettingsTab';

export default function App() {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'images' | 'notes' | 'links' | 'passwords' | 'settings'>('dashboard');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Quick Add popup State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  
  // Custom Toast Notifier State
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // App metrics
  const [tallies, setTallies] = useState({
    images: 0,
    notes: 0,
    links: 0,
    passwords: 0
  });
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [storageDetails, setStorageDetails] = useState<StorageDetails | null>(null);
  const [lastActive, setLastActive] = useState<number>(Date.now());
  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(300); // 5 mins in seconds

  // Handle global Toast notifications
  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Activity listeners for Auto-Lock timeout
  useEffect(() => {
    const handleActivity = () => {
      setLastActive(Date.now());
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  // Check activity timeout interval
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isLocked) return;

      const timeout = await getSetting<number>('autoLockTimeout', 300);
      setAutoLockTimeout(timeout);

      if (timeout > 0) {
        const secondsInactive = (Date.now() - lastActive) / 1000;
        if (secondsInactive > timeout) {
          await setSetting('isLocked', true);
          setIsLocked(true);
          triggerToast('Auto-locked due to inactivity', 'error');
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isLocked, lastActive]);

  // Tab blur locking listener
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && !isLocked) {
        const timeout = await getSetting<number>('autoLockTimeout', 300);
        // If they want immediately on blur, lock
        if (timeout === 30) {
          await setSetting('isLocked', true);
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLocked]);

  // Load app status, counts, and recent items
  useEffect(() => {
    async function checkLockStatus() {
      const pinSet = await getSetting<string | null>('pin', null);
      if (!pinSet) {
        setIsLocked(true); // Must create pin on first use
      } else {
        const dbLocked = await getSetting<boolean>('isLocked', true);
        setIsLocked(dbLocked);
      }
    }
    checkLockStatus();
  }, []);

  useEffect(() => {
    if (!isLocked) {
      loadDashboardMetrics();
    }
  }, [isLocked, activeTab]);

  const loadDashboardMetrics = async () => {
    try {
      const stats = await calculateStorageUsage();
      setStorageDetails(stats);
      setTallies({
        images: stats.itemCounts.images,
        notes: stats.itemCounts.notes,
        links: stats.itemCounts.links,
        passwords: stats.itemCounts.passwords
      });

      // Get recent entries
      const notes = await getAllFromStore<VaultNote>('notes');
      const links = await getAllFromStore<VaultLink>('links');
      const images = await getAllFromStore<VaultImage>('images');
      const passwords = await getAllFromStore<VaultPassword>('passwords');

      const items: any[] = [
        ...notes.map(n => ({ ...n, type: 'note', icon: FileText, label: n.title, section: 'notes' })),
        ...links.map(l => ({ ...l, type: 'link', icon: Globe, label: l.title, section: 'links' })),
        ...images.map(i => ({ ...i, type: 'image', icon: ImageIcon, label: i.title, section: 'images' })),
        ...passwords.map(p => ({ ...p, type: 'password', icon: KeyRound, label: p.service, section: 'passwords' }))
      ];

      // Sort by newest
      const sorted = items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
      setRecentItems(sorted);
    } catch (e) {
      // diagnostics fail quietly
    }
  };

  const handleManualLock = async () => {
    await setSetting('isLocked', true);
    setIsLocked(true);
    triggerToast('Locker locked securely', 'success');
  };

  const handleUnlock = () => {
    setIsLocked(false);
    triggerToast('Identity Verified. Welcome!', 'success');
  };

  const openQuickAdd = (section: 'images' | 'notes' | 'links' | 'passwords') => {
    setActiveTab(section);
    setIsQuickAddOpen(false);
  };

  return (
    <div id="boxer-main-viewport" className="min-h-screen elegant-dark-gradient text-white flex justify-center items-center p-0 md:p-4 font-sans select-none antialiased relative">
      {/* Visual background atmospheric radial glow from Design HTML */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(123,47,247,0.08)_0%,transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(157,78,221,0.06)_0%,transparent_50%)] pointer-events-none" />

      {/* Frame Wrapper: Mobile First Shell */}
      <div className="w-full max-w-md md:h-[840px] md:rounded-[32px] bg-brand-bg/95 border border-brand-border flex flex-col justify-between overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative min-h-screen md:min-h-[840px]">
        
        {/* Absolute Floating Toasts */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 16, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-4 left-4 right-4 z-50 p-3.5 rounded-2xl bg-brand-card/95 border border-brand-border shadow-2xl backdrop-blur-md flex items-center gap-2.5 max-w-sm mx-auto"
            >
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <span className="text-xs font-semibold text-gray-200">{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isLocked ? (
            /* Secure PIN-based screen */
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-[#0A0A0A]"
            >
              <LockScreen onUnlock={handleUnlock} isAutoLocked={autoLockTimeout > 0 && (Date.now() - lastActive) / 1000 > autoLockTimeout} />
            </motion.div>
          ) : (
            /* Unlocked Main app flow with high quality glassmorphism */
            <motion.div
              key="unlocked"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col overflow-hidden h-full"
            >
              {/* Dynamic Header */}
              <header className="p-4 bg-brand-bg/80 backdrop-blur-md border-b border-brand-border flex flex-col gap-3 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5" onClick={() => setActiveTab('dashboard')}>
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center glow-primary cursor-pointer">
                      <FolderLock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-sm font-black tracking-tight text-white cursor-pointer select-none">MY BOXER</h1>
                      <p className="text-[9px] font-mono text-brand-accent uppercase tracking-wider -mt-0.5">Secure Locker</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Secure Status Badge */}
                    <div className="text-[10px] font-medium text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20 flex items-center gap-1.5 select-none">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                      </span>
                      <span>Secure</span>
                    </div>

                    <button
                      onClick={handleManualLock}
                      className="p-2 rounded-xl bg-brand-glass hover:bg-white/5 border border-brand-border text-brand-muted hover:text-brand-accent transition-all cursor-pointer"
                      title="Lock App"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Unified Filter/Search Bar */}
                {activeTab !== 'settings' && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      type="text"
                      placeholder={`Search across ${activeTab === 'dashboard' ? 'vault' : activeTab}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-brand-glass border border-brand-border text-xs rounded-xl pl-9 pr-8 py-2 text-brand-text outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all placeholder-brand-muted/70"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </header>

              {/* Dynamic Scrollable Content Panel */}
              <main className="flex-1 overflow-hidden flex flex-col bg-brand-bg">
                <AnimatePresence mode="wait">
                  {activeTab === 'dashboard' && (
                    <motion.div
                      key="dashboard"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 pb-24"
                    >
                      {/* Premium Welcome Card */}
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-primary/10 via-[#120821] to-[#0A0A0A] border border-brand-border shadow-lg flex items-center justify-between relative overflow-hidden">
                        <div className="absolute -top-12 -left-12 w-24 h-24 bg-brand-primary/10 rounded-full blur-xl pointer-events-none" />
                        <div className="flex flex-col gap-1 max-w-[75%] relative z-10">
                          <h2 className="text-sm font-bold text-brand-text tracking-tight leading-snug">
                            Your Personal Vault is Secure & Offline
                          </h2>
                          <p className="text-[10px] text-brand-muted leading-relaxed mt-0.5">
                            All passwords, notes, and photos are encrypted in IndexedDB sandboxed storage.
                          </p>
                        </div>
                        <Shield className="w-14 h-14 text-brand-primary/20 absolute right-3 bottom-1.5" />
                      </div>

                      {/* Quick Access Grid */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[11px] font-bold text-brand-accent tracking-wider uppercase">Vault Sections</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { id: 'images', name: 'Photos', icon: ImageIcon, count: tallies.images, color: 'text-brand-accent', desc: 'Secure gallery' },
                            { id: 'notes', name: 'Notes', icon: FileText, count: tallies.notes, color: 'text-brand-primary', desc: 'Private journals' },
                            { id: 'links', name: 'Web Links', icon: Globe, count: tallies.links, color: 'text-brand-secondary', desc: 'Saved bookmarks' },
                            { id: 'passwords', name: 'Passwords', icon: KeyRound, count: tallies.passwords, color: 'text-emerald-400', desc: 'Secure passwords' }
                          ].map(card => (
                            <button
                              key={card.id}
                              onClick={() => { setActiveTab(card.id as any); setSearchTerm(''); }}
                              className="p-4 rounded-3xl bg-brand-card hover:bg-brand-card/80 border border-brand-border flex flex-col items-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden group hover:scale-[1.02]"
                            >
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(123,47,247,0.06)_0%,transparent_70%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-brand-border flex items-center justify-center mb-3 text-lg transition-transform duration-300 group-hover:scale-110">
                                <card.icon className={`w-5 h-5 ${card.color}`} />
                              </div>
                              <h4 className="text-xs font-bold text-brand-text">{card.name}</h4>
                              <p className="text-[10px] text-brand-muted mt-1">{card.count} {card.count === 1 ? 'item' : 'items'}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Recent Activities Section */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[11px] font-bold text-brand-accent tracking-wider uppercase">Recently Modified</h3>
                          <span 
                            onClick={() => { setActiveTab('notes'); setSearchTerm(''); }}
                            className="text-[11px] font-semibold text-brand-primary hover:text-brand-accent cursor-pointer transition-colors"
                          >
                            View All
                          </span>
                        </div>
                        {recentItems.length === 0 ? (
                          <div className="p-6 bg-brand-glass rounded-2xl border border-brand-border text-center text-xs text-brand-muted leading-normal">
                            No stored credentials or notes found yet.<br />
                            <span className="text-brand-primary hover:text-brand-accent font-semibold cursor-pointer" onClick={() => setIsQuickAddOpen(true)}>Add your first item</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {recentItems.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => { setActiveTab(item.section); setSearchTerm(''); }}
                                className="p-3 bg-brand-glass hover:bg-white/[0.06] border border-brand-border rounded-xl flex justify-between items-center gap-3 transition-all cursor-pointer group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-brand-border flex items-center justify-center text-brand-primary group-hover:text-brand-accent transition-colors">
                                    <item.icon className="w-4.5 h-4.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-brand-text truncate pr-2 group-hover:text-brand-accent transition-colors">{item.label}</h4>
                                    <p className="text-[9px] text-brand-muted font-mono uppercase mt-0.5">{item.type} • Recent</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[9px] font-mono text-brand-muted">
                                    {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 text-brand-muted/70 group-hover:text-brand-accent transition-colors" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Storage Usage Card */}
                      {storageDetails && (
                        <div className="p-4 rounded-2xl bg-brand-card border border-brand-border mt-1">
                          <div className="flex justify-between text-[11px] font-medium mb-2 text-brand-muted">
                            <span>Storage Usage</span>
                            <span>{storageDetails.formattedSize} / 50 MB</span>
                          </div>
                          <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand-primary rounded-full transition-all duration-500" 
                              style={{ width: `${Math.min(100, Math.max(3, (storageDetails.totalBytes / (50 * 1024 * 1024)) * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Render tabs */}
                  {activeTab === 'images' && <ImagesTab onNotify={triggerToast} searchTerm={searchTerm} />}
                  {activeTab === 'notes' && <NotesTab onNotify={triggerToast} searchTerm={searchTerm} />}
                  {activeTab === 'links' && <LinksTab onNotify={triggerToast} searchTerm={searchTerm} />}
                  {activeTab === 'passwords' && <PasswordsTab onNotify={triggerToast} searchTerm={searchTerm} />}
                  
                  {activeTab === 'settings' && (
                    <SettingsTab 
                      onNotify={triggerToast} 
                      onPinResetNeeded={() => setIsLocked(true)} 
                    />
                  )}
                </AnimatePresence>
              </main>

              {/* Floating Quick Action Overlay Menu */}
              <AnimatePresence>
                {isQuickAddOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-brand-bg/90 z-40 flex flex-col justify-end p-6"
                  >
                    {/* Tap to close backdrop */}
                    <div className="absolute inset-0" onClick={() => setIsQuickAddOpen(false)} />

                    {/* Staggered Add buttons */}
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 30, opacity: 0 }}
                      className="relative z-50 flex flex-col gap-3 bg-brand-card rounded-3xl p-5 border border-brand-border shadow-2xl max-w-sm mx-auto w-full mb-12"
                    >
                      <div className="flex justify-between items-center border-b border-brand-border pb-3">
                        <h4 className="text-xs font-bold text-brand-muted tracking-wider uppercase">Add Secure Entry</h4>
                        <button 
                          onClick={() => setIsQuickAddOpen(false)}
                          className="p-1 rounded-full bg-white/[0.04] border border-brand-border text-brand-muted hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          onClick={() => openQuickAdd('notes')}
                          className="p-3.5 rounded-2xl bg-brand-glass hover:bg-white/[0.04] border border-brand-border text-left flex flex-col gap-2 transition-all cursor-pointer group"
                        >
                          <FileText className="w-4 h-4 text-brand-accent group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-brand-text">New Note</span>
                        </button>
                        
                        <button
                          onClick={() => openQuickAdd('passwords')}
                          className="p-3.5 rounded-2xl bg-brand-glass hover:bg-white/[0.04] border border-brand-border text-left flex flex-col gap-2 transition-all cursor-pointer group"
                        >
                          <KeyRound className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-brand-text">Add Password</span>
                        </button>

                        <button
                          onClick={() => openQuickAdd('images')}
                          className="p-3.5 rounded-2xl bg-brand-glass hover:bg-white/[0.04] border border-brand-border text-left flex flex-col gap-2 transition-all cursor-pointer group"
                        >
                          <ImageIcon className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-brand-text">Import Photo</span>
                        </button>

                        <button
                          onClick={() => openQuickAdd('links')}
                          className="p-3.5 rounded-2xl bg-brand-glass hover:bg-white/[0.04] border border-brand-border text-left flex flex-col gap-2 transition-all cursor-pointer group"
                        >
                          <Globe className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-brand-text">Secure Link</span>
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Master Floating Add Button */}
              {activeTab === 'dashboard' && (
                <div className="fixed bottom-20 right-6 z-30">
                  <button
                    onClick={() => setIsQuickAddOpen(true)}
                    className="w-14 h-14 rounded-full bg-brand-primary flex items-center justify-center glow-fab hover:bg-brand-secondary active:scale-95 transition-all text-white cursor-pointer"
                  >
                    <Plus className="w-7 h-7" />
                  </button>
                </div>
              )}

              {/* Master Bottom Navigation Bar (curved Android bottom-nav style) */}
              <nav className="p-2.5 bg-[#0F0F0F] border-t border-brand-border flex justify-between items-center px-6 flex-shrink-0">
                {[
                  { id: 'dashboard', name: 'Home', icon: LayoutDashboard },
                  { id: 'images', name: 'Photos', icon: ImageIcon },
                  { id: 'notes', name: 'Notes', icon: FileText },
                  { id: 'links', name: 'Links', icon: Globe },
                  { id: 'passwords', name: 'Passwords', icon: KeyRound },
                  { id: 'settings', name: 'Settings', icon: SettingsIcon }
                ].map(navItem => (
                  <button
                    key={navItem.id}
                    onClick={() => { setActiveTab(navItem.id as any); setSearchTerm(''); }}
                    className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
                      activeTab === navItem.id 
                        ? 'text-brand-accent scale-105 font-bold' 
                        : 'text-brand-muted hover:text-brand-text'
                    }`}
                  >
                    <navItem.icon className="w-4 h-4" />
                    <span className="text-[9px] mt-1 tracking-tight select-none">{navItem.name}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
