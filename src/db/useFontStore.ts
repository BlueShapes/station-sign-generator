import { useState, useEffect, useCallback, useRef } from 'react';

export type StorageMode = 'indexeddb' | 'memory';
export type FontStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface BuiltinFontDef {
  id: string;
  name: string;
  family: string;
  spec: string;
  sizeApprox: number;
}

export interface UserFontEntry {
  id: string;
  name: string;
  family: string;
  size: number;
  addedAt: Date;
}

export const BUILTIN_FONTS: BuiltinFontDef[] = [
  { id: 'noto-sans-jp', name: 'Noto Sans JP', family: 'NotoSansJP', spec: '900 1em NotoSansJP', sizeApprox: 9_600_000 },
  { id: 'noto-sans-tc', name: 'Noto Sans TC', family: 'NotoSansTC', spec: '1em NotoSansTC', sizeApprox: 11_900_000 },
  { id: 'noto-sans-kr', name: 'Noto Sans KR', family: 'NotoSansKR', spec: '1em NotoSansKR', sizeApprox: 10_400_000 },
  { id: 'overused-grotesk', name: 'Overused Grotesk', family: 'OverusedGrotesk', spec: '1em OverusedGrotesk', sizeApprox: 217_000 },
  { id: 'hind-semibold', name: 'Hind SemiBold', family: 'HindSemiBold', spec: '600 1em HindSemiBold', sizeApprox: 274_000 },
];

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

export function useFontStore() {
  const [storageMode, setStorageModeState] = useState<StorageMode>(() => {
    try {
      return (localStorage.getItem(STORAGE_MODE_KEY) as StorageMode) ?? 'indexeddb';
    } catch {
      return 'indexeddb';
    }
  });

  const [builtinStatus, setBuiltinStatus] = useState<Record<string, FontStatus>>(() => {
    if (typeof document === 'undefined') {
      return Object.fromEntries(BUILTIN_FONTS.map((f) => [f.id, 'idle' as FontStatus]));
    }
    return Object.fromEntries(
      BUILTIN_FONTS.map((f) => [f.id, document.fonts.check(f.spec) ? ('loaded' as FontStatus) : ('idle' as FontStatus)])
    );
  });

  const [userFonts, setUserFonts] = useState<UserFontEntry[]>([]);
  const [userFontStatus, setUserFontStatus] = useState<Record<string, FontStatus>>({});
  const dbRef = useRef<IDBDatabase | null>(null);

  const registerFontFace = useCallback(async (family: string, data: ArrayBuffer) => {
    const face = new FontFace(family, data);
    await face.load();
    document.fonts.add(face);
  }, []);

  // Load persisted user fonts from IndexedDB when in indexeddb mode
  useEffect(() => {
    if (storageMode !== 'indexeddb') return;

    openDB()
      .then(async (db) => {
        dbRef.current = db;
        const records = await idbGetAll(db);

        const entries: UserFontEntry[] = records.map((r) => ({
          id: r.id,
          name: r.name,
          family: r.family,
          size: r.size,
          addedAt: new Date(r.addedAt),
        }));

        setUserFonts(entries);
        setUserFontStatus(Object.fromEntries(entries.map((e) => [e.id, 'loading' as FontStatus])));

        for (const rec of records) {
          registerFontFace(rec.family, rec.data)
            .then(() => setUserFontStatus((p) => ({ ...p, [rec.id]: 'loaded' })))
            .catch(() => setUserFontStatus((p) => ({ ...p, [rec.id]: 'error' })));
        }
      })
      .catch(console.error);
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

  const preloadBuiltinFont = useCallback(async (id: string) => {
    const font = BUILTIN_FONTS.find((f) => f.id === id);
    if (!font) return;

    setBuiltinStatus((p) => ({ ...p, [id]: 'loading' }));
    try {
      await document.fonts.load(font.spec);
      setBuiltinStatus((p) => ({ ...p, [id]: 'loaded' }));
    } catch {
      setBuiltinStatus((p) => ({ ...p, [id]: 'error' }));
    }
  }, []);

  const uploadFont = useCallback(async (file: File, name: string, family: string) => {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const data = await file.arrayBuffer();
    const entry: UserFontEntry = { id, name, family, size: file.size, addedAt: new Date() };

    setUserFonts((p) => [...p, entry]);
    setUserFontStatus((p) => ({ ...p, [id]: 'loading' }));

    try {
      await registerFontFace(family, data);
      setUserFontStatus((p) => ({ ...p, [id]: 'loaded' }));

      if (storageMode === 'indexeddb') {
        if (!dbRef.current) dbRef.current = await openDB();
        await idbPut(dbRef.current, { id, name, family, data, size: file.size, addedAt: Date.now() });
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
    preloadBuiltinFont,
    uploadFont,
    deleteUserFont,
    removeAllUserFonts,
  };
}
