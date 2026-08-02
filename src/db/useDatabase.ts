import { useState, useCallback } from 'react';
import type DirectInputStationProps from '@/components/signs/DirectInputStationProps';
import { DEFAULT_DATA } from '@/db/seed';
import {
  DIRECT_INPUT_JSON_MAX_LENGTH,
  sanitizeDirectInputData,
} from '@/lib/textInputSafety';

const SESSION_KEY = 'sign-config-v1';

function isValidData(data: unknown): data is DirectInputStationProps {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.primaryName === 'string' &&
    typeof d.baseColor === 'string' &&
    Array.isArray(d.left) &&
    Array.isArray(d.right)
  );
}

function loadFromSession(): { data: DirectInputStationProps; wasCorrupted: boolean } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { data: DEFAULT_DATA, wasCorrupted: false };
    if (raw.length > DIRECT_INPUT_JSON_MAX_LENGTH) {
      sessionStorage.removeItem(SESSION_KEY);
      return { data: DEFAULT_DATA, wasCorrupted: true };
    }
    const parsed = JSON.parse(raw) as unknown;
    if (isValidData(parsed)) {
      const sanitized = sanitizeDirectInputData(parsed);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
      return { data: sanitized, wasCorrupted: false };
    }
    // Parsed successfully but failed validation — clear corrupted data
    sessionStorage.removeItem(SESSION_KEY);
    return { data: DEFAULT_DATA, wasCorrupted: true };
  } catch {
    // JSON parse failed — clear corrupted data
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    return { data: DEFAULT_DATA, wasCorrupted: true };
  }
}

function saveToSession(data: DirectInputStationProps): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

interface UseDatabaseResult {
  data: DirectInputStationProps;
  update: (newData: DirectInputStationProps) => void;
  reset: () => void;
  isCorrupted: boolean;
}

export function useDatabase(): UseDatabaseResult {
  const [{ data, wasCorrupted }] = useState(() => loadFromSession());
  const [currentData, setCurrentData] = useState<DirectInputStationProps>(data);

  const update = useCallback((newData: DirectInputStationProps) => {
    const sanitized = sanitizeDirectInputData(newData);
    setCurrentData(sanitized);
    saveToSession(sanitized);
  }, []);

  const reset = useCallback(() => {
    clearSession();
    setCurrentData(DEFAULT_DATA);
    saveToSession(DEFAULT_DATA);
  }, []);

  return { data: currentData, update, reset, isCorrupted: wasCorrupted };
}
