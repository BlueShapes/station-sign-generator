import { useEffect, useState } from "react";
import {
  normalizeRouteSignImages, normalizeSignImages, type SignImagePlacement,
} from "./signImages";

export function useRouteSignImages(key: string) {
  const storageKey = "ssg-route-sign-images-v1";
  const read = () => normalizeRouteSignImages(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
  const [state, setState] = useState<{ overrides: Record<string, SignImagePlacement[]>; error: boolean }>(() => {
    try { return { overrides: read(), error: false }; }
    catch { return { overrides: {}, error: true }; }
  });
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      try { setState({ overrides: read(), error: false }); }
      catch { setState((previous) => ({ ...previous, error: true })); }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return {
    images: state.overrides[key],
    error: state.error,
    setImages: (images: SignImagePlacement[] | undefined) => {
      try {
        const next = { ...read() };
        if (images === undefined) delete next[key];
        else next[key] = normalizeSignImages(images) ?? [];
        localStorage.setItem(storageKey, JSON.stringify(next));
        setState({ overrides: next, error: false });
      } catch {
        setState((previous) => ({ ...previous, error: true }));
      }
    },
  };
}
