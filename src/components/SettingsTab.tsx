import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, KeyRound, Fingerprint, ShieldAlert, Database, 
  Trash2, Download, Upload, Clock, RefreshCw, Check, AlertTriangle,
  Lock, ArrowLeft, Loader2, Info, ChevronRight, HardDrive 
} from 'lucide-react';
import { 
  getSetting, setSetting, calculateStorageUsage, StorageDetails, 
  exportVaultData, importVaultData 
} from '../lib/db';

interface SettingsTabProps {
  onNotify: (message: string, type: 'success' | 'error') => void;
  onPinResetNeeded: () => void;
}

export default function SettingsTab({ onNotify, onPinResetNeeded }: SettingsTabProps) {
  const [storage, setStorage] = useState<StorageDetails | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(300); // 5 mins default
  
  // PIN change states
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');

  // Import overlay state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
    updateStorageDiagnostics();
  }, []);

  const loadSettings = async () => {
    const bio = await getSetting<boolean>('biometricsEnabled', false);
    const timeout = await getSetting<number>('autoLockTimeout', 300);
    setBiometricsEnabled(bio);
    setAutoLockTimeout(timeout);
  };

  const updateStorageDiagnostics = async () => {
    try {
      const details = await calculateStorageUsage();
      setStorage(details);
    } catch (e) {
      onNotify('Failed to calculate storage usage', 'error');
    }
  };

  const handleBiometricsToggle = async (checked: boolean) => {
    try {
      await setSetting('biometricsEnabled', checked);
      setBiometricsEnabled(checked);
      onNotify(checked ? 'Fingerprint login simulated successfully' : 'Biometrics simulation disabled', 'success');
    } catch (e) {
      onNotify('Failed to update biometrics setting', 'error');
    }
  };

  const handleTimeoutChange = async (timeout: number) => {
    try {
      await setSetting('autoLockTimeout', timeout);
      setAutoLockTimeout(timeout);
      onNotify(`Auto-lock interval configured to ${timeout === 0 ? 'Never' : timeout + 's'}`, 'success');
    } catch (e) {
      onNotify('Failed to update auto-lock settings', 'error');
    }
  };

  const handlePinChange = async () => {
    if (newPinInput.length !== 4 || isNaN(Number(newPinInput))) {
      onNotify('New PIN must be a 4-digit number', 'error');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      onNotify('Confirmation PIN does not match', 'error');
      return;
    }

    try {
      const storedPin = await getSetting<string | null>('pin', null);
      if (storedPin && currentPinInput !== storedPin) {
        onNotify('Current PIN is incorrect', 'error');
        return;
      }

      await setSetting('pin', newPinInput);
      onNotify('Security PIN successfully updated', 'success');
      
      // Reset PIN inputs
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setIsChangingPin(false);
    } catch (e) {
      onNotify('Failed to change PIN', 'error');
    }
  };

  // Export handler
  const handleExport = async () => {
    try {
      const dataStr = await exportVaultData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `my_boxer_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      onNotify('Backup file downloaded successfully', 'success');
    } catch (e) {
      onNotify('Export failed', 'error');
    }
  };

  // Import handler
  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    onNotify('Reading backup file...', 'success');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await importVaultData(content);
        onNotify('Vault data successfully restored!', 'success');
        updateStorageDiagnostics();
        loadSettings();
      } catch (err: any) {
        onNotify(err.message || 'Import failed. Check file format.', 'error');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      onNotify('Failed to read file', 'error');
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  // Total clear
  const factoryEraseVault = async () => {
    const message = 'WARNING: This will permanently delete all notes, passwords, links, images, and your login PIN. This action cannot be undone.\n\nType "CONFIRM" to completely erase your secure vault.';
    const input = window.prompt(message);
    if (input === 'CONFIRM') {
      try {
        const req = indexedDB.deleteDatabase('MyBoxerDB');
        req.onsuccess = () => {
          onNotify('Vault deleted. Restarting security lock.', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        };
        req.onerror = () => {
          onNotify('Failed to delete database', 'error');
        };
      } catch (e) {
        onNotify('Clear failed', 'error');
      }
    } else if (input !== null) {
      onNotify('Verification failed. Erase cancelled.', 'error');
    }
  };

  // Storage utilization percentage
  const storagePercent = () => {
    if (!storage) return 0;
    // Let's assume a virtual local sandbox target limit of 50MB (IndexedDB is larger but it is good for a visual gauge)
    const limit = 50 * 1024 * 1024; 
    return Math.min(Math.round((storage.totalBytes / limit) * 100), 100);
  };

  return (
    <div id="settings-tab-root" className="w-full flex-1 flex flex-col p-4 pb-24 overflow-y-auto font-sans">
      <AnimatePresence mode="wait">
        {!isChangingPin ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-5 max-w-lg mx-auto w-full"
          >
            {/* Storage Usage Diagnostics Card */}
            <div className="bg-gradient-to-br from-[#1E1E1E] to-[#141414] rounded-2xl p-5 border border-purple-950/20 shadow-md">
              <div className="flex items-center gap-2 text-sm font-bold text-[#C77DFF] mb-4">
                <HardDrive className="w-4 h-4" />
                <span>OFFLINE STORAGE UTILIZATION</span>
              </div>

              {storage ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-bold tracking-tight text-white">{storage.formattedSize}</span>
                    <span className="text-xs text-gray-500 font-mono">OF 50 MB ALLOCATED</span>
                  </div>

                  {/* Percentage Glow Bar */}
                  <div className="w-full h-2.5 rounded-full bg-[#0A0A0A] overflow-hidden border border-purple-950/20 relative">
                    <div 
                      className="h-full bg-gradient-to-r from-[#7B2FF7] to-[#C77DFF] rounded-full shadow-[0_0_8px_#7B2FF7]" 
                      style={{ width: `${storagePercent()}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 mt-2 text-xs text-gray-400">
                    <div className="flex justify-between border-b border-purple-950/10 pb-1.5">
                      <span>Images ({storage.itemCounts.images})</span>
                      <span className="font-mono text-gray-300">
                        {storage.imagesBytes < 1024 ? '0 KB' : (storage.imagesBytes / 1024).toFixed(0) + ' KB'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-purple-950/10 pb-1.5">
                      <span>Notes ({storage.itemCounts.notes})</span>
                      <span className="font-mono text-gray-300">
                        {storage.notesBytes < 1024 ? '0 KB' : (storage.notesBytes / 1024).toFixed(0) + ' KB'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-purple-950/10 pb-1.5">
                      <span>Links ({storage.itemCounts.links})</span>
                      <span className="font-mono text-gray-300">
                        {storage.linksBytes < 1024 ? '0 KB' : (storage.linksBytes / 1024).toFixed(0) + ' KB'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-purple-950/10 pb-1.5">
                      <span>Passwords ({storage.itemCounts.passwords})</span>
                      <span className="font-mono text-gray-300">
                        {storage.passwordsBytes < 1024 ? '0 KB' : (storage.passwordsBytes / 1024).toFixed(0) + ' KB'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                </div>
              )}
            </div>

            {/* Security Configurations */}
            <div className="bg-[#151515] rounded-2xl p-4 border border-purple-950/15 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-wider uppercase">
                <Clock className="w-4 h-4 text-[#7B2FF7]" />
                <span>Security Settings</span>
              </div>

              {/* Simulated fingerprint check */}
              <div className="flex justify-between items-center py-1 border-b border-purple-950/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#20103A] text-[#C77DFF] rounded-xl border border-purple-900/10">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">Biometric Authentication</h4>
                    <p className="text-[10px] text-gray-500">Enable simulated biometric scanning login.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={biometricsEnabled}
                    onChange={(e) => handleBiometricsToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#252525] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7B2FF7]" />
                </label>
              </div>

              {/* Auto lock dropdown setting */}
              <div className="flex justify-between items-center py-1 border-b border-purple-950/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#20103A] text-[#C77DFF] rounded-xl border border-purple-900/10">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">Auto-Lock Timeout</h4>
                    <p className="text-[10px] text-gray-500">Lock the digital locker on inactivity.</p>
                  </div>
                </div>
                <select
                  value={autoLockTimeout}
                  onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
                  className="bg-[#0A0A0A] border border-purple-950/35 text-gray-300 text-xs rounded-xl px-2 py-1 outline-none focus:border-[#7B2FF7]"
                >
                  <option value={30}>30 Seconds</option>
                  <option value={60}>1 Minute</option>
                  <option value={300}>5 Minutes</option>
                  <option value={1800}>30 Minutes</option>
                  <option value={0}>Never Lock</option>
                </select>
              </div>

              {/* Change PIN button trigger */}
              <button
                onClick={() => setIsChangingPin(true)}
                className="flex justify-between items-center text-left py-1 hover:bg-purple-950/10 rounded-xl px-2 -mx-2 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#20103A] text-[#C77DFF] rounded-xl border border-purple-900/10">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">Update Secure PIN</h4>
                    <p className="text-[10px] text-gray-500">Change your 4-digit master access code.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Backups & Maintenance */}
            <div className="bg-[#151515] rounded-2xl p-4 border border-purple-950/15 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-wider uppercase">
                <Database className="w-4 h-4 text-[#7B2FF7]" />
                <span>Backup & Recovery</span>
              </div>

              {/* Backup triggers */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1D1D1D] hover:bg-purple-950/10 border border-purple-950/30 hover:border-[#7B2FF7]/40 text-xs font-bold text-gray-200 hover:text-white transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#C77DFF]" />
                  <span>Download Backup</span>
                </button>

                <button
                  onClick={triggerImport}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1D1D1D] hover:bg-purple-950/10 border border-purple-950/30 hover:border-[#7B2FF7]/40 text-xs font-bold text-gray-200 hover:text-white transition-all cursor-pointer"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 text-[#C77DFF] animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-[#C77DFF]" />
                  )}
                  <span>Upload Backup</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>

              {/* Factory Reset warning and trigger */}
              <div className="border-t border-purple-950/15 pt-4">
                <div className="p-3 bg-red-950/10 rounded-2xl border border-red-950/30 flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Wiping the locker deletes everything offline immediately. Ensure you download a backup file first.
                    </p>
                    <button
                      onClick={factoryEraseVault}
                      className="max-w-max text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 mt-1 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Erase All Data (Factory Reset)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Application info banner */}
            <div className="text-center text-[10px] font-mono text-gray-600 py-2 flex flex-col gap-1">
              <p>MY BOXER VAULT • VERSION 1.4 (STABLE)</p>
              <p>PROUDLY RUNNING ON SECURE SANDBOXED INDEXEDDB</p>
            </div>
          </motion.div>
        ) : (
          /* Secure PIN modification slide */
          <motion.div
            key="pin-change"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col bg-[#0A0A0A]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-purple-950/30">
              <button 
                onClick={() => setIsChangingPin(false)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Security Dashboard</span>
              </button>
              
              <button
                onClick={handlePinChange}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#7B2FF7] to-[#9D4EDD] text-xs font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Update PIN</span>
              </button>
            </div>

            <div className="flex flex-col mt-6 gap-4 max-w-sm mx-auto w-full bg-[#141414] border border-purple-950/30 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-[#C77DFF] border-b border-purple-950/20 pb-2">
                <KeyRound className="w-4 h-4 animate-pulse" />
                <span>UPDATE MASTER PIN</span>
              </div>

              {/* Current PIN */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Current Master PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-center tracking-[0.5em] font-bold text-lg rounded-xl py-2 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              {/* New PIN */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">New 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-center tracking-[0.5em] font-bold text-lg rounded-xl py-2 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              {/* Confirm New PIN */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Confirm New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#0A0A0A] border border-purple-950/40 text-center tracking-[0.5em] font-bold text-lg rounded-xl py-2 text-gray-200 outline-none focus:border-[#7B2FF7]"
                />
              </div>

              <div className="text-[10px] text-gray-500 leading-relaxed flex items-start gap-1.5 bg-purple-950/5 p-3 rounded-2xl border border-purple-950/15">
                <Info className="w-4 h-4 text-[#C77DFF] flex-shrink-0 mt-0.5" />
                <span>PIN updates take effect immediately. Write this down or keep it safe; it controls local encryption access keys.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
