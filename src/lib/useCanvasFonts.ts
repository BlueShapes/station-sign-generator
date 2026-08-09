import { useEffect, useState } from "react";
import { areCanvasFontsLoaded, waitForCanvasFonts } from "./fonts";

const LOADER_DELAY_MS = 180;

type FontLoadState = {
  requestKey: string;
  ready: boolean;
  showLoader: boolean;
};

export function useCanvasFonts(
  specs: readonly string[],
  enabled = true,
): { ready: boolean; showLoader: boolean } {
  const specsKey = specs.join("|");
  const requestKey = `${enabled ? "enabled" : "disabled"}:${specsKey}`;
  const [state, setState] = useState<FontLoadState>(() => ({
    requestKey,
    ready: !enabled || areCanvasFontsLoaded(specs),
    showLoader: false,
  }));

  const alreadyLoaded = areCanvasFontsLoaded(specs);
  const ready =
    !enabled ||
    alreadyLoaded ||
    (state.requestKey === requestKey && state.ready);
  const showLoader =
    enabled &&
    !ready &&
    state.requestKey === requestKey &&
    state.showLoader;

  useEffect(() => {
    let cancelled = false;

    if (!enabled || areCanvasFontsLoaded(specs)) {
      setState({ requestKey, ready: true, showLoader: false });
      return () => {
        cancelled = true;
      };
    }

    setState({ requestKey, ready: false, showLoader: false });
    const loaderTimer = window.setTimeout(() => {
      if (!cancelled) {
        setState({ requestKey, ready: false, showLoader: true });
      }
    }, LOADER_DELAY_MS);

    waitForCanvasFonts(specs).then(
      () => {
        if (!cancelled) {
          setState({ requestKey, ready: true, showLoader: false });
        }
      },
      () => {
        // A failed bundled font cannot become usable during this request.
        // Release the UI after every other font has settled rather than
        // leaving the preview and download controls locked forever.
        if (!cancelled) {
          setState({ requestKey, ready: true, showLoader: false });
        }
      },
    );

    return () => {
      cancelled = true;
      window.clearTimeout(loaderTimer);
    };
  }, [enabled, requestKey, specs]);

  return { ready, showLoader };
}
