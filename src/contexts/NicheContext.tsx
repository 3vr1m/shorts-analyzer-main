"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NicheContextType {
  selectedNiche: string;
  setSelectedNiche: (niche: string) => void;
  getSimplifiedNiche: () => string;
}

const NicheContext = createContext<NicheContextType | undefined>(undefined);

export function NicheProvider({ children }: { children: ReactNode }) {
  const [selectedNiche, setSelectedNicheState] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    const savedNiche = localStorage.getItem('shorts-analyzer-niche');
    if (savedNiche) {
      setSelectedNicheState(savedNiche);
    }
  }, []);

  // Save to localStorage whenever niche changes
  const setSelectedNiche = (niche: string) => {
    setSelectedNicheState(niche);
    if (niche) {
      localStorage.setItem('shorts-analyzer-niche', niche);
    } else {
      localStorage.removeItem('shorts-analyzer-niche');
    }
  };

  // Simplify niche to one word if too long (for trending section)
  const getSimplifiedNiche = (): string => {
    if (!selectedNiche) return '';
    
    // If it's already short (1-2 words), return as is
    const words = selectedNiche.trim().split(/\s+/);
    if (words.length <= 2) return selectedNiche;
    
    // Try to find the most important word
    const importantWords = words.filter(word => 
      word.length > 3 && 
      !['and', 'the', 'for', 'with', 'tips', 'hacks', 'ideas'].includes(word.toLowerCase())
    );
    
    if (importantWords.length > 0) {
      return importantWords[0];
    }
    
    // Fallback to first word
    return words[0];
  };

  return (
    <NicheContext.Provider value={{
      selectedNiche,
      setSelectedNiche,
      getSimplifiedNiche
    }}>
      {children}
    </NicheContext.Provider>
  );
}

export function useNiche() {
  const context = useContext(NicheContext);
  if (context === undefined) {
    throw new Error('useNiche must be used within a NicheProvider');
  }
  return context;
}
