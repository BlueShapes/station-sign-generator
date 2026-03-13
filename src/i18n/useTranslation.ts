import { createContext, useContext } from 'react';

type Messages = Record<string, unknown>;

interface TranslationContextValue {
  messages: Messages;
  locale: string;
}

export const TranslationContext = createContext<TranslationContextValue>({
  messages: {},
  locale: 'en',
});

function getNestedValue(obj: unknown, path: string): string {
  if (!path) return '';
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

function interpolate(str: string, params: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

export function useTranslations(namespace?: string) {
  const { messages } = useContext(TranslationContext);
  return (key: string, params?: Record<string, string>): string => {
    const fullKey = namespace && namespace !== '' ? `${namespace}.${key}` : key;
    const value = getNestedValue(messages, fullKey);
    if (params && typeof value === 'string') {
      return interpolate(value, params);
    }
    return value;
  };
}
