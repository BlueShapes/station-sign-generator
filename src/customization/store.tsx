import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CustomDefinition, CustomDefinitionKind } from "./model";
import { registerCustomDefinitions } from "./registry";

const DB_NAME = "ssg-customization-store";
const DB_VERSION = 1;
const STORE_NAME = "definitions";

function openCustomizationDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDefinitions(): Promise<CustomDefinition[]> {
  const database = await openCustomizationDb();
  return new Promise<CustomDefinition[]>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => resolve(request.result as CustomDefinition[]);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

async function putDefinition(definition: CustomDefinition): Promise<void> {
  const database = await openCustomizationDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(definition);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => database.close());
}

async function removeDefinition(id: string): Promise<void> {
  const database = await openCustomizationDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => database.close());
}

async function registerEmbeddedFont(definition: CustomDefinition): Promise<void> {
  if (typeof document === "undefined") return;
  const fonts = [
    ...(definition.font ? [definition.font] : []),
    ...(definition.fonts ?? []),
  ].filter(
    (font, index, all) =>
      all.findIndex(({ family }) => family === font.family) === index,
  );
  await Promise.all(
    fonts.map(async (font) => {
      const face = new FontFace(font.family, font.data);
      await face.load();
      document.fonts.add(face);
    }),
  );
}

interface CustomizationContextValue {
  definitions: CustomDefinition[];
  loading: boolean;
  saveDefinition: (definition: CustomDefinition) => Promise<void>;
  deleteDefinition: (id: string) => Promise<void>;
  byKind: (kind: CustomDefinitionKind) => CustomDefinition[];
}

const CustomizationContext = createContext<CustomizationContextValue | null>(
  null,
);

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [definitions, setDefinitions] = useState<CustomDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readDefinitions()
      .then(async (loaded) => {
        setDefinitions(loaded);
        await Promise.allSettled(loaded.map(registerEmbeddedFont));
      })
      .catch(() => setDefinitions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => registerCustomDefinitions(definitions), [definitions]);

  const saveDefinition = useCallback(async (definition: CustomDefinition) => {
    const next = { ...definition, updatedAt: Date.now() } as CustomDefinition;
    await putDefinition(next);
    await registerEmbeddedFont(next).catch(() => undefined);
    setDefinitions((current) => [
      ...current.filter(({ id }) => id !== next.id),
      next,
    ]);
  }, []);

  const deleteDefinition = useCallback(async (id: string) => {
    await removeDefinition(id);
    setDefinitions((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<CustomizationContextValue>(
    () => ({
      definitions,
      loading,
      saveDefinition,
      deleteDefinition,
      byKind: (kind) => definitions.filter((item) => item.kind === kind),
    }),
    [definitions, loading, saveDefinition, deleteDefinition],
  );

  return (
    <CustomizationContext.Provider value={value}>
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomizations(): CustomizationContextValue {
  const value = useContext(CustomizationContext);
  if (!value) {
    throw new Error("useCustomizations must be used inside CustomizationProvider");
  }
  return value;
}
