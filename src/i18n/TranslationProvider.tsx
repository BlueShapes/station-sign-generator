import React from 'react';
import { TranslationContext } from './useTranslation';

interface TranslationProviderProps {
  messages: Record<string, unknown>;
  locale: string;
  children: React.ReactNode;
}

export function TranslationProvider({ messages, locale, children }: TranslationProviderProps) {
  return (
    <TranslationContext.Provider value={{ messages, locale }}>
      {children}
    </TranslationContext.Provider>
  );
}
