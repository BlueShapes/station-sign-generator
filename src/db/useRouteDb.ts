import { useState, useEffect, useRef, useCallback } from "react";
import type { Database } from "sql.js";
import { getDatabase, persistDatabase } from "@/db/init";

interface UseRouteDbResult {
  db: Database | null;
  loading: boolean;
  persist: () => void;
  replaceDb: (newDb: Database) => void;
}

export function useRouteDb(): UseRouteDbResult {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDatabase()
      .then((database) => {
        if (cancelled) return;
        dbRef.current = database;
        setDb(database);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to initialize route database:", err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(() => {
    if (dbRef.current) {
      persistDatabase(dbRef.current);
    }
  }, []);

  const replaceDb = useCallback((newDb: Database) => {
    dbRef.current = newDb;
    setDb(newDb);
  }, []);

  return { db, loading, persist, replaceDb };
}
