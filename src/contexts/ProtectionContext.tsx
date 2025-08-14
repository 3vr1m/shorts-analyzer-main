'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ProtectionContextType {
  isUnlocked: boolean;
  checkProtection: (input: string) => boolean;
  unlock: () => void;
  isClient: boolean;
}

const ProtectionContext = createContext<ProtectionContextType | undefined>(undefined);

const PROTECTION_KEY = "orospuevlatlarisarmisbizi";
const STORAGE_KEY = "daily_motivation_unlocked";

export function ProtectionProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Check if already unlocked in this session
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setIsUnlocked(true);
      }
    }
  }, []);

  const checkProtection = (input: string): boolean => {
    if (!isClient || typeof window === 'undefined') return false;
    
    const normalized = input.toLowerCase().trim();
    const isValid = normalized === PROTECTION_KEY.toLowerCase();
    
    if (isValid) {
      setIsUnlocked(true);
      sessionStorage.setItem(STORAGE_KEY, "true");
    }
    
    return isValid;
  };

  const unlock = () => {
    if (!isClient || typeof window === 'undefined') return;
    setIsUnlocked(true);
    sessionStorage.setItem(STORAGE_KEY, "true");
  };

  return (
    <ProtectionContext.Provider value={{ isUnlocked, checkProtection, unlock, isClient }}>
      {children}
    </ProtectionContext.Provider>
  );
}

export function useProtection() {
  // Safe fallback for SSR
  if (typeof window === 'undefined') {
    return {
      isUnlocked: false,
      checkProtection: () => false,
      unlock: () => {},
      isClient: false
    };
  }

  const context = useContext(ProtectionContext);
  if (context === undefined) {
    // Fallback for missing provider
    return {
      isUnlocked: false,
      checkProtection: () => false,
      unlock: () => {},
      isClient: false
    };
  }
  return context;
}

// Helper hook for button protection
export function useButtonProtection() {
  const { isUnlocked, isClient } = useProtection();
  
  const protectedClick = (originalHandler: () => void) => {
    return () => {
      if (!isClient || typeof window === 'undefined') return; // Don't do anything on server
      
      if (!isUnlocked) {
        // Subtle hint for API functions without being obvious
        const hints = [
          "🌟 Share your daily motivation to unlock AI features!",
          "💡 Set your daily inspiration above to analyze content!", 
          "✨ Tell us your purpose today to access AI tools!",
          "🎯 Add your motivation above to start analyzing!"
        ];
        const randomHint = hints[Math.floor(Math.random() * hints.length)];
        alert(randomHint);
        return;
      }
      originalHandler();
    };
  };

  return { 
    isUnlocked: isClient ? isUnlocked : false, 
    protectedClick,
    isClient 
  };
}