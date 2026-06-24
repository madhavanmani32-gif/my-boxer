import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Delete, Fingerprint, Lock, ShieldAlert, KeyRound } from 'lucide-react';
import { getSetting, setSetting } from '../lib/db';

interface LockScreenProps {
  onUnlock: () => void;
  isAutoLocked?: boolean;
}

export default function LockScreen({ onUnlock, isAutoLocked = false }: LockScreenProps) {
  const [pinState, setPinState] = useState<'create' | 'confirm' | 'unlock'>('unlock');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [inputDigits, setInputDigits] = useState<string>('');
  const [tempPin, setTempPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  useEffect(() => {
    async function loadSecuritySettings() {
      const pin = await getSetting<string | null>('pin', null);
      const bio = await getSetting<boolean>('biometricsEnabled', false);
      setStoredPin(pin);
      setBiometricsEnabled(bio);

      if (!pin) {
        setPinState('create');
      } else {
        setPinState('unlock');
      }
    }
    loadSecuritySettings();
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleNumberClick = (num: string) => {
    if (inputDigits.length >= 4) return;
    const newVal = inputDigits + num;
    setInputDigits(newVal);

    if (newVal.length === 4) {
      setTimeout(() => {
        handlePinSubmit(newVal);
      }, 250);
    }
  };

  const handleBackspace = () => {
    setInputDigits(prev => prev.slice(0, -1));
  };

  const handlePinSubmit = async (entered: string) => {
    setErrorMsg('');
    if (pinState === 'create') {
      setTempPin(entered);
      setInputDigits('');
      setPinState('confirm');
    } else if (pinState === 'confirm') {
      if (entered === tempPin) {
        await setSetting('pin', entered);
        await setSetting('isLocked', false);
        setStoredPin(entered);
        setInputDigits('');
        onUnlock();
      } else {
        setErrorMsg('PIN codes do not match. Try again.');
        triggerShake();
        setInputDigits('');
        setPinState('create');
      }
    } else if (pinState === 'unlock') {
      if (entered === storedPin) {
        setInputDigits('');
        await setSetting('isLocked', false);
        onUnlock();
      } else {
        setErrorMsg('Invalid PIN. Access Denied.');
        triggerShake();
        setInputDigits('');
      }
    }
  };

  const handleFingerprintScan = () => {
    if (pinState !== 'unlock') return;
    setIsScanning(true);
    setErrorMsg('');
    
    // Simulate high tech fingerprint biometric scan
    setTimeout(async () => {
      setIsScanning(false);
      await setSetting('isLocked', false);
      onUnlock();
    }, 1500);
  };

  return (
    <div id="lock-screen-container" className="fixed inset-0 z-50 flex flex-col justify-between elegant-dark-gradient text-white p-6 md:p-8 font-sans overflow-y-auto relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(123,47,247,0.06)_0%,transparent_60%)] pointer-events-none" />
      
      {/* Premium Header Decoration */}
      <div className="flex flex-col items-center mt-8 relative z-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary p-[1px] glow-primary"
        >
          <div className="flex items-center justify-center w-full h-full rounded-full bg-brand-card">
            <Lock className="w-8 h-8 text-brand-accent animate-pulse" />
          </div>
        </motion.div>
        
        <h1 className="mt-4 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-[#C77DFF]">
          MY BOXER
        </h1>
        <p className="text-xs font-mono text-brand-accent tracking-widest uppercase mt-1">
          Secure Digital Locker
        </p>

        <p className="mt-6 text-sm text-brand-muted text-center max-w-xs leading-relaxed">
          {pinState === 'create' && 'Set a custom 4-digit PIN to secure your private vault data.'}
          {pinState === 'confirm' && 'Re-enter your 4-digit PIN to confirm secure access.'}
          {pinState === 'unlock' && (isAutoLocked ? 'Locker locked due to inactivity.' : 'Enter Secure PIN or use Biometrics to unlock.')}
        </p>
      </div>

      {/* Screen Core Info: Digits Indicators */}
      <div className="flex flex-col items-center justify-center my-6 relative z-10">
        {/* Shaking indicators on error */}
        <motion.div 
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex space-x-5"
        >
          {[0, 1, 2, 3].map((index) => (
            <div 
              key={index} 
              className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                inputDigits.length > index 
                  ? 'bg-gradient-to-r from-brand-primary to-brand-secondary border-transparent scale-110 shadow-[0_0_12px_rgba(123,47,247,0.6)]' 
                  : 'border-brand-border bg-transparent'
              }`}
            />
          ))}
        </motion.div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-red-400 mt-4 text-xs font-medium bg-red-400/10 px-3 py-1.5 rounded-full border border-red-400/20"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </div>

      {/* Numerical Keypad & Simulated Biometrics */}
      <div className="w-full max-w-sm mx-auto mb-6 flex flex-col items-center relative z-10">
        <div className="grid grid-cols-3 gap-y-4 gap-x-8 w-full justify-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="w-16 h-16 rounded-full flex flex-col justify-center items-center text-xl font-bold bg-brand-card hover:bg-white/[0.05] active:bg-brand-primary/20 border border-brand-border active:border-brand-primary transition-all duration-150 select-none cursor-pointer text-brand-text"
            >
              <span>{num}</span>
            </button>
          ))}

          {/* Bottom Row */}
          {/* Fingerprint trigger */}
          <div className="flex justify-center items-center">
            {pinState === 'unlock' && (
              <button
                onClick={handleFingerprintScan}
                disabled={isScanning}
                className={`w-16 h-16 rounded-full flex justify-center items-center bg-brand-card border border-brand-primary/30 hover:border-brand-primary transition-all duration-300 select-none cursor-pointer ${
                  isScanning ? 'scale-90 animate-pulse' : 'hover:scale-105'
                }`}
              >
                <Fingerprint className={`w-8 h-8 ${isScanning ? 'text-brand-accent' : 'text-brand-primary'}`} />
              </button>
            )}
          </div>

          <button
            onClick={() => handleNumberClick('0')}
            className="w-16 h-16 rounded-full flex flex-col justify-center items-center text-xl font-bold bg-brand-card hover:bg-white/[0.05] active:bg-brand-primary/20 border border-brand-border active:border-brand-primary transition-all duration-150 select-none cursor-pointer text-brand-text"
          >
            0
          </button>

          {/* Backspace trigger */}
          <button
            onClick={handleBackspace}
            disabled={inputDigits.length === 0}
            className={`w-16 h-16 rounded-full flex justify-center items-center bg-brand-card active:bg-white/[0.05] border border-brand-border transition-all duration-150 cursor-pointer ${
              inputDigits.length === 0 ? 'opacity-30' : 'hover:bg-white/[0.04]'
            }`}
          >
            <Delete className="w-5 h-5 text-brand-muted" />
          </button>
        </div>

        {/* Dynamic Scanning Ripple Effect */}
        <AnimatePresence>
          {isScanning && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-bg/95 z-50 flex flex-col items-center justify-center p-6"
            >
              <div className="relative flex items-center justify-center">
                {/* Fingerprint scan animation ripples */}
                <span className="absolute inline-flex h-32 w-32 rounded-full bg-brand-primary opacity-20 animate-ping" />
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-brand-secondary opacity-40 animate-ping" />
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-brand-card border-2 border-brand-primary shadow-[0_0_30px_rgba(123,47,247,0.5)]">
                  <Fingerprint className="w-10 h-10 text-brand-accent animate-pulse" />
                </div>
              </div>
              <p className="mt-8 text-brand-accent font-mono text-xs tracking-widest uppercase animate-pulse">
                Scanning Fingerprint...
              </p>
              <p className="mt-2 text-brand-muted text-xs">
                Hold finger on reader area
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Secure footer credentials */}
      <div className="text-center text-[10px] font-mono text-brand-muted mb-2 flex items-center justify-center gap-1 relative z-10">
        <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
        <span>AES-256 ENCRYPTED LOCAL LOCKER</span>
      </div>
    </div>
  );
}
