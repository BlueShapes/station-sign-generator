import { useState, useEffect, useRef, useCallback } from 'react';
import type { Database } from 'sql.js';
import type DirectInputStationProps from '@/components/signs/DirectInputStationProps';
import { getDatabase, persistDatabase } from '@/db/init';
import { getSignConfig, saveSignConfig } from '@/db/repositories/stations';
import { seedDefaultData, DEFAULT_DATA } from '@/db/seed';

const SESSION_KEY = 'sign-config-v1';

function loadFromSession(): DirectInputStationProps | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as DirectInputStationProps) : null;
  } catch {
    return null;
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
  data: DirectInputStationProps | null;
  loading: boolean;
  update: (newData: DirectInputStationProps) => void;
  reset: () => void;
}

export function useDatabase(): UseDatabaseResult {
  const [data, setData] = useState<DirectInputStationProps | null>(null);
  const [loading, setLoading] = useState(true);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Restore from sessionStorage immediately for instant display
    const cached = loadFromSession();
    if (cached && !cancelled) {
      setData(cached);
      setLoading(false);
    }

    getDatabase()
      .then((db) => {
        if (cancelled) return;
        dbRef.current = db;

        let config = getSignConfig(db);
        if (!config) {
          seedDefaultData(db);
          config = getSignConfig(db);
          persistDatabase(db);
        }

        if (!cancelled && config) {
          setData(config);
          saveToSession(config);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((newData: DirectInputStationProps) => {
    setData(newData);
    saveToSession(newData);
    if (dbRef.current) {
      saveSignConfig(dbRef.current, newData);
      persistDatabase(dbRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    clearSession();
    if (dbRef.current) {
      seedDefaultData(dbRef.current);
      persistDatabase(dbRef.current);
    }
    setData(DEFAULT_DATA);
    saveToSession(DEFAULT_DATA);
  }, []);

  return { data, loading, update, reset };
}
