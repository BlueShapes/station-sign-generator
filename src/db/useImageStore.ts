import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImageEntry {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  /** A data URL so this image remains usable after a reload. */
  objectUrl: string;
  addedAt: Date;
}

interface StoredImageRecord {
  id: string;
  name: string;
  mimeType: string;
  data: ArrayBuffer;
  size: number;
  width: number;
  height: number;
  addedAt: number;
}

interface CachedImageRecord {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
  width: number;
  height: number;
  addedAt: number;
}

interface ImageStoreState {
  images: ImageEntry[];
  loading: boolean;
  error: Error | null;
  uploadImage: (file: File, name: string) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  removeAllImages: () => Promise<void>;
}

// ── Persistence ─────────────────────────────────────────────────────────────

const CACHE_KEY = 'ssg-image-cache-v1';
const IDB_NAME = 'ssg-image-store';
const IDB_VERSION = 1;
const STORE_NAME = 'user-images';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open image cache'));
  });
}

function idbGetAll(db: IDBDatabase): Promise<StoredImageRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as StoredImageRecord[]);
    req.onerror = () => reject(req.error ?? new Error('Could not read saved images'));
  });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not delete saved image'));
  });
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not clear saved images'));
  });
}

function readCache(): CachedImageRecord[] {
  const serialized = localStorage.getItem(CACHE_KEY);
  if (!serialized) return [];

  const records = JSON.parse(serialized) as CachedImageRecord[];
  if (!Array.isArray(records) || records.some((record) => (
    typeof record?.id !== 'string'
    || typeof record.name !== 'string'
    || typeof record.dataUrl !== 'string'
    || typeof record.width !== 'number'
    || typeof record.height !== 'number'
  ))) {
    throw new Error('The saved image cache is invalid');
  }
  return records;
}

function writeCache(records: CachedImageRecord[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(records));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('There is not enough browser storage space to save this image.');
    }
    throw error instanceof Error ? error : new Error('Could not save the image to browser storage.');
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read the selected image.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('The selected file is not a valid image.'));
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error('The selected file could not be decoded as an image.'));
    img.src = dataUrl;
  });
}

function recordToEntry(record: CachedImageRecord): ImageEntry {
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    size: record.size,
    width: record.width,
    height: record.height,
    objectUrl: record.dataUrl,
    addedAt: new Date(record.addedAt),
  };
}

function legacyRecordToCache(record: StoredImageRecord, dataUrl: string): CachedImageRecord {
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    dataUrl,
    size: record.size,
    width: record.width,
    height: record.height,
    addedAt: record.addedAt,
  };
}

async function legacyRecordToDataUrl(record: StoredImageRecord): Promise<string> {
  const blob = new Blob([record.data], { type: record.mimeType });
  return fileToDataUrl(new File([blob], record.name, { type: record.mimeType }));
}

// ── Provider state ──────────────────────────────────────────────────────────

function useImageStoreState(): ImageStoreState {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRef = useRef<IDBDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    let db: IDBDatabase | null = null;

    const load = async () => {
      let cached: CachedImageRecord[] = [];
      try {
        cached = readCache();
        db = await openDB();
        if (cancelled) {
          db.close();
          return;
        }
        dbRef.current = db;
        const legacyRecords = await idbGetAll(db);
        if (cancelled) return;
        if (!legacyRecords.length) {
          if (!cancelled) setImages(cached.map(recordToEntry));
          return;
        }

        const cachedIds = new Set(cached.map((record) => record.id));
        const legacyCache = await Promise.all(legacyRecords
          .filter((record) => !cachedIds.has(record.id))
          .map(async (record) => legacyRecordToCache(
            record,
            await legacyRecordToDataUrl(record),
          )));
        if (cancelled) return;
        const merged = [...cached, ...legacyCache];

        // Only remove the old records after the full replacement is safely cached.
        writeCache(merged);
        await idbClear(db);
        cached = merged;
        if (!cancelled) setImages(cached.map(recordToEntry));
      } catch (cause) {
        const loadError = cause instanceof Error ? cause : new Error('Could not load saved images.');
        if (db && !cancelled) {
          try {
            // Keep old uploads visible if quota prevents migrating them. They stay in IDB
            // so a later visit can retry the migration without losing their bytes.
            const legacy = await idbGetAll(db);
            const existingIds = new Set(cached.map((record) => record.id));
            const fallback = await Promise.all(legacy
              .filter((record) => !existingIds.has(record.id))
              .map(async (record) => legacyRecordToCache(
                record,
                await legacyRecordToDataUrl(record),
              )));
            setImages([...cached, ...fallback].map(recordToEntry));
          } catch {
            setImages(cached.map(recordToEntry));
          }
        } else if (!cancelled) {
          setImages(cached.map(recordToEntry));
        }
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (dbRef.current === db) dbRef.current = null;
      db?.close();
    };
  }, []);

  const uploadImage = useCallback(async (file: File, name: string) => {
    const dataUrl = await fileToDataUrl(file);
    const dimensions = await getImageDimensions(dataUrl);
    const record: CachedImageRecord = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      addedAt: Date.now(),
    };

    // Persist first: a successful promise means the image is available after reload.
    const next = [...readCache(), record];
    writeCache(next);
    const cachedEntries = next.map(recordToEntry);
    const cachedIds = new Set(next.map((image) => image.id));
    setImages((current) => [
      ...cachedEntries,
      ...current.filter((image) => !cachedIds.has(image.id)),
    ]);
    setError(null);
  }, []);

  const deleteImage = useCallback(async (id: string) => {
    const previous = readCache();
    const next = previous.filter((image) => image.id !== id);
    writeCache(next);
    try {
      if (dbRef.current) await idbDelete(dbRef.current, id);
    } catch (cause) {
      writeCache(previous);
      throw cause;
    }
    setImages((current) => current.filter((image) => image.id !== id));
    setError(null);
  }, []);

  const removeAllImages = useCallback(async () => {
    const previous = readCache();
    writeCache([]);
    try {
      if (dbRef.current) await idbClear(dbRef.current);
    } catch (cause) {
      writeCache(previous);
      throw cause;
    }
    setImages([]);
    setError(null);
  }, []);

  return { images, loading, error, uploadImage, deleteImage, removeAllImages };
}

const ImageStoreContext = createContext<ImageStoreState | null>(null);

/** Keep uploaded images cached and available while switching between tabs. */
export function ImageStoreProvider({ children }: { children: ReactNode }) {
  const store = useImageStoreState();
  return createElement(ImageStoreContext.Provider, { value: store }, children);
}

export function useImageStore() {
  const store = useContext(ImageStoreContext);
  if (!store) throw new Error('useImageStore must be used inside ImageStoreProvider');
  return store;
}
