import { useState, useEffect, useCallback, useRef } from "react";
import type { StorageMode } from "./useFontStore";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImageEntry {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
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

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

const IDB_NAME = "ssg-image-store";
const IDB_VERSION = 1;
const STORE_NAME = "user-images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

function idbGetAll(db: IDBDatabase): Promise<StoredImageRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) =>
      resolve((e.target as IDBRequest<StoredImageRecord[]>).result);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbPut(db: IDBDatabase, record: StoredImageRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

// ── Utilities ────────────────────────────────────────────────────────────────

function getImageDimensions(
  data: ArrayBuffer,
  mimeType: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function recordToEntry(rec: StoredImageRecord): ImageEntry {
  const blob = new Blob([rec.data], { type: rec.mimeType });
  return {
    id: rec.id,
    name: rec.name,
    mimeType: rec.mimeType,
    size: rec.size,
    width: rec.width,
    height: rec.height,
    objectUrl: URL.createObjectURL(blob),
    addedAt: new Date(rec.addedAt),
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useImageStore(storageMode: StorageMode) {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const dbRef = useRef<IDBDatabase | null>(null);
  // Track object URLs for cleanup
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const trackUrl = (url: string) => {
    objectUrlsRef.current.add(url);
    return url;
  };
  const revokeUrl = (url: string) => {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  };

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Load persisted images from IndexedDB when in indexeddb mode
  useEffect(() => {
    if (storageMode !== "indexeddb") return;

    // Revoke existing object URLs before reloading
    setImages((prev) => {
      prev.forEach((img) => revokeUrl(img.objectUrl));
      return [];
    });

    openDB()
      .then(async (db) => {
        dbRef.current = db;
        const records = await idbGetAll(db);
        const entries = records.map((rec) => {
          const entry = recordToEntry(rec);
          trackUrl(entry.objectUrl);
          return entry;
        });
        setImages(entries);
      })
      .catch(console.error);
    // revokeUrl is stable (refs only), safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMode]);

  const uploadImage = useCallback(
    async (file: File, name: string) => {
      const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const data = await file.arrayBuffer();
      const dims = await getImageDimensions(data, file.type);

      const rec: StoredImageRecord = {
        id,
        name,
        mimeType: file.type,
        data,
        size: file.size,
        width: dims.width,
        height: dims.height,
        addedAt: Date.now(),
      };

      const entry = recordToEntry(rec);
      trackUrl(entry.objectUrl);
      setImages((prev) => [...prev, entry]);

      if (storageMode === "indexeddb") {
        if (!dbRef.current) dbRef.current = await openDB();
        await idbPut(dbRef.current, rec);
      }
    },
    [storageMode],
  );

  const deleteImage = useCallback(async (id: string) => {
    setImages((prev) => {
      const entry = prev.find((img) => img.id === id);
      if (entry) revokeUrl(entry.objectUrl);
      return prev.filter((img) => img.id !== id);
    });
    if (dbRef.current) await idbDelete(dbRef.current, id);
  }, []);

  const removeAllImages = useCallback(async () => {
    setImages((prev) => {
      prev.forEach((img) => revokeUrl(img.objectUrl));
      return [];
    });
    if (dbRef.current) await idbClear(dbRef.current);
  }, []);

  return { images, uploadImage, deleteImage, removeAllImages };
}
