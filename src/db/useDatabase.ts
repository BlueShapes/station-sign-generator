import { useState, useEffect, useRef, useCallback } from 'react';
import type { Database } from 'sql.js';
import type DirectInputStationProps from '@/components/signs/DirectInputStationProps';
import { getDatabase, persistDatabase } from '@/db/init';
import { getSignConfig, saveSignConfig } from '@/db/repositories/stations';
import { seedDefaultData } from '@/db/seed';

interface UseDatabaseResult {
  data: DirectInputStationProps | null;
  loading: boolean;
  update: (newData: DirectInputStationProps) => void;
}

export function useDatabase(): UseDatabaseResult {
  const [data, setData] = useState<DirectInputStationProps | null>(null);
  const [loading, setLoading] = useState(true);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;

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

        if (!cancelled) {
          setData(config);
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
    if (dbRef.current) {
      saveSignConfig(dbRef.current, newData);
      persistDatabase(dbRef.current);
    }
  }, []);

  return { data, loading, update };
}
