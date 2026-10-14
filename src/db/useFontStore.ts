import { createContext, createElement, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { BUILTIN_FONTS, loadBuiltinFont } from '@/lib/fontCatalog';
import type { BuiltinFontDef } from '@/lib/fontCatalog';

export { BUILTIN_FONTS } from '@/lib/fontCatalog';
export type { BuiltinFontDef } from '@/lib/fontCatalog';

export type StorageMode = 'indexeddb' | 'memory';
export type FontStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UserFontEntry {
  id: string;
  name: string;
  family: string;
  size: number;
  addedAt: Date;
  /** Kept in memory so a custom style can embed an independent font copy. */
  data: ArrayBuffer;
  mimeType: string;
}


// ── IndexedDB helpers ────────────────────────────────────────────────────────

const IDB_NAME = 'ssg-font-store';
const IDB_VERSION = 1;
const STORE_NAME = 'user-fonts';
const STORAGE_MODE_KEY = 'ssg-font-storage-mode';

interface StoredFontRecord {
  id: string;
  name: string;
  family: string;
  data: ArrayBuffer;
  size: number;
  addedAt: number;
  mimeType?: string;
}

function normalizeFontFamily(family: string): string {
  return family.replace(/["']/g, '').trim().toLowerCase();
}

function getRegisteredFontStatus(font: BuiltinFontDef, fontSet: FontFaceSet): FontStatus {
  const faces = Array.from(fontSet).filter(
    (face) => normalizeFontFamily(face.family) === normalizeFontFamily(font.family),
  );

  if (faces.some((face) => face.status === 'loading')) return 'loading';
  if (faces.some((face) => face.status === 'loaded')) return 'loaded';
  if (faces.length > 0 && faces.every((face) => face.status === 'error')) return 'error';
  return 'idle';
}

function getInitialBuiltinStatus(): Record<string, FontStatus> {
  if (typeof document === 'undefined') {
    return Object.fromEntries(BUILTIN_FONTS.map((font) => [font.id, 'idle' as FontStatus]));
  }

  return Object.fromEntries(
    BUILTIN_FONTS.map((font) => [font.id, getRegisteredFontStatus(font, document.fonts)]),
  );
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

function idbGetAll(db: IDBDatabase): Promise<StoredFontRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => resolve((e.target as IDBRequest<StoredFontRecord[]>).result);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbPut(db: IDBDatabase, record: StoredFontRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useFontStoreState() {
  const [storageMode, setStorageModeState] = useState<StorageMode>(() => {
    try {
      return (localStorage.getItem(STORAGE_MODE_KEY) as StorageMode) ?? 'indexeddb';
    } catch {
      return 'indexeddb';
    }
  });

  const [builtinStatus, setBuiltinStatus] = useState<Record<string, FontStatus>>(getInitialBuiltinStatus);

  const [userFonts, setUserFonts] = useState<UserFontEntry[]>([]);
  const [userFontStatus, setUserFontStatus] = useState<Record<string, FontStatus>>({});
  const [userFontsLoading, setUserFontsLoading] = useState(storageMode === 'indexeddb');
  const dbRef = useRef<IDBDatabase | null>(null);
  const builtinLoadPromisesRef = useRef(new Map<string, Promise<void>>());

  const handleBuiltinFontEvent = useCallback((event: Event) => {
    const faces = (event as Event & { fontfaces?: FontFace[] }).fontfaces;
    if (!faces?.length) return;
    const affectedFamilies = new Set(faces.map((face) => normalizeFontFamily(face.family)));

    setBuiltinStatus((previous) => {
      let next = previous;
      for (const font of BUILTIN_FONTS) {
        if (builtinLoadPromisesRef.current.has(font.id)) continue;
        if (!affectedFamilies.has(normalizeFontFamily(font.family))) continue;

        // Read every registered face for this family. A replacement face may
        // have loaded successfully while an older CSS face remains in error.
        const status = getRegisteredFontStatus(font, document.fonts);
        // Failed optional faces are removed so a retry can create a fresh face.
        // Their delayed events must not clear the error before the user retries.
        if (status === 'idle' && previous[font.id] === 'error') continue;
        if (status !== previous[font.id]) {
          if (next === previous) next = { ...previous };
          next[font.id] = status;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.fonts.addEventListener('loadingdone', handleBuiltinFontEvent);
    document.fonts.addEventListener('loadingerror', handleBuiltinFontEvent);
    return () => {
      document.fonts.removeEventListener('loadingdone', handleBuiltinFontEvent);
      document.fonts.removeEventListener('loadingerror', handleBuiltinFontEvent);
    };
  }, [handleBuiltinFontEvent]);

  const registerFontFace = useCallback(async (family: string, data: ArrayBuffer) => {
    const face = new FontFace(family, data);
    await face.load();
    document.fonts.add(face);
  }, []);

  // Load persisted user fonts from IndexedDB when in indexeddb mode
  useEffect(() => {
    if (storageMode !== 'indexeddb') {
      setUserFontsLoading(false);
      return;
    }

    let cancelled = false;
    let connection: IDBDatabase | null = null;
    setUserFontsLoading(true);

    openDB()
      .then(async (db) => {
        if (cancelled) {
          db.close();
          return;
        }
        connection = db;
        dbRef.current = db;
        const records = await idbGetAll(db);
        if (cancelled) return;

        const entries: UserFontEntry[] = records.map((r) => ({
          id: r.id,
          name: r.name,
          family: r.family,
          size: r.size,
          addedAt: new Date(r.addedAt),
          data: r.data,
          mimeType: r.mimeType ?? 'font/ttf',
        }));

        setUserFonts(entries);
        setUserFontStatus(Object.fromEntries(entries.map((e) => [e.id, 'loading' as FontStatus])));

        await Promise.allSettled(records.map(async (rec) => {
          try {
            await registerFontFace(rec.family, rec.data);
            if (!cancelled) setUserFontStatus((p) => ({ ...p, [rec.id]: 'loaded' }));
          } catch {
            if (!cancelled) setUserFontStatus((p) => ({ ...p, [rec.id]: 'error' }));
          }
        }));
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setUserFontsLoading(false);
      });

    return () => {
      cancelled = true;
      connection?.close();
      if (dbRef.current === connection) dbRef.current = null;
    };
  }, [storageMode, registerFontFace]);

  const setStorageMode = useCallback((mode: StorageMode) => {
    try { localStorage.setItem(STORAGE_MODE_KEY, mode); } catch { /* ignore */ }
    if (mode === 'indexeddb') {
      // Reset; the effect will reload from IDB
      setUserFonts([]);
      setUserFontStatus({});
    }
    setStorageModeState(mode);
  }, []);

  const preloadBuiltinFont = useCallback((id: string): Promise<void> => {
    const font = BUILTIN_FONTS.find((f) => f.id === id);
    if (!font || typeof document === 'undefined') return Promise.resolve();

    const existingLoad = builtinLoadPromisesRef.current.get(id);
    if (existingLoad) return existingLoad;

    if (!font.sourceUrl && getRegisteredFontStatus(font, document.fonts) === 'loaded') {
      setBuiltinStatus((previous) => ({ ...previous, [id]: 'loaded' }));
      return Promise.resolve();
    }

    setBuiltinStatus((p) => ({ ...p, [id]: 'loading' }));
    const load = loadBuiltinFont(font, document.fonts)
      .then(() => setBuiltinStatus((p) => ({ ...p, [id]: 'loaded' })))
      .catch(() => setBuiltinStatus((p) => ({ ...p, [id]: 'error' })))
      .finally(() => builtinLoadPromisesRef.current.delete(id));
    builtinLoadPromisesRef.current.set(id, load);
    return load;
  }, []);

  const uploadFont = useCallback(async (file: File, name: string, family: string) => {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const data = await file.arrayBuffer();
    const entry: UserFontEntry = {
      id,
      name,
      family,
      size: file.size,
      addedAt: new Date(),
      data,
      mimeType: file.type || 'font/ttf',
    };

    setUserFonts((p) => [...p, entry]);
    setUserFontStatus((p) => ({ ...p, [id]: 'loading' }));

    try {
      await registerFontFace(family, data);
      setUserFontStatus((p) => ({ ...p, [id]: 'loaded' }));

      if (storageMode === 'indexeddb') {
        if (!dbRef.current) dbRef.current = await openDB();
        await idbPut(dbRef.current, {
          id,
          name,
          family,
          data,
          size: file.size,
          addedAt: Date.now(),
          mimeType: file.type || 'font/ttf',
        });
      }
    } catch {
      setUserFontStatus((p) => ({ ...p, [id]: 'error' }));
    }
  }, [storageMode, registerFontFace]);

  const deleteUserFont = useCallback(async (id: string) => {
    const entry = userFonts.find((f) => f.id === id);
    if (!entry) return;

    const toRemove: FontFace[] = [];
    document.fonts.forEach((face) => {
      if (face.family === `"${entry.family}"` || face.family === entry.family) toRemove.push(face);
    });
    toRemove.forEach((face) => document.fonts.delete(face));

    setUserFonts((p) => p.filter((f) => f.id !== id));
    setUserFontStatus((p) => { const n = { ...p }; delete n[id]; return n; });

    if (dbRef.current) await idbDelete(dbRef.current, id);
  }, [userFonts]);

  const removeAllUserFonts = useCallback(async () => {
    if (dbRef.current) await idbClear(dbRef.current);

    userFonts.forEach((entry) => {
      const toRemove: FontFace[] = [];
      document.fonts.forEach((face) => {
        if (face.family === `"${entry.family}"` || face.family === entry.family) toRemove.push(face);
      });
      toRemove.forEach((face) => document.fonts.delete(face));
    });

    setUserFonts([]);
    setUserFontStatus({});
  }, [userFonts]);

  return {
    storageMode,
    setStorageMode,
    builtinFonts: BUILTIN_FONTS,
    builtinStatus,
    userFonts,
    userFontStatus,
    userFontsLoading,
    preloadBuiltinFont,
    uploadFont,
    deleteUserFont,
    removeAllUserFonts,
  };
}

const FontStoreContext = createContext<ReturnType<typeof useFontStoreState> | null>(null);

/** Keep uploaded/session-only fonts available while switching input/settings tabs. */
export function FontStoreProvider({ children }: { children: ReactNode }) {
  const store = useFontStoreState();
  return createElement(FontStoreContext.Provider, { value: store }, children);
}

export function useFontStore() {
  const store = useContext(FontStoreContext);
  if (!store) throw new Error('useFontStore must be used inside FontStoreProvider');
  return store;
}
