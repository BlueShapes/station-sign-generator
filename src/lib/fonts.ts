const NOTO_SANS_JP_FONT_SPECS = [
  "400 1em NotoSansJP",
  "500 1em NotoSansJP",
  "600 1em NotoSansJP",
  "700 1em NotoSansJP",
  "800 1em NotoSansJP",
  "900 1em NotoSansJP",
] as const;

const CJK_FONT_SPECS = [
  ...NOTO_SANS_JP_FONT_SPECS,
  "400 1em NotoSansTC",
  "400 1em NotoSansKR",
  "400 1em OverusedGrotesk",
] as const;

const HIND_BADGE_FONT_SPECS = ["600 1em HindSemiBold"] as const;
const METRO_BADGE_FONT_SPECS = [
  "600 1em JostTrispaceHybrid",
  "700 1em JostTrispaceHybrid",
] as const;
const JOST_FONT_SPECS = ["500 1em Jost", "600 1em Jost"] as const;

/**
 * JR Central keeps the JNR-era Sumi Maru Gothic / JNR-L lettering on its
 * station signs. Those proprietary sign faces are not distributed as web
 * fonts, so the renderer uses OFL-licensed Zen Maru Gothic for station names
 * and Public Sans as a Helvetica-like substitute for the numbering badge.
 */
export const JR_CENTRAL_BADGE_FONT_SPECS = [
  "700 1em PublicSans",
] as const;

export const JR_CENTRAL_FONT_SPECS = [
  "700 1em ZenMaruGothic",
  "400 1em PublicSans",
  ...JR_CENTRAL_BADGE_FONT_SPECS,
  ...HIND_BADGE_FONT_SPECS,
  ...METRO_BADGE_FONT_SPECS,
] as const;

export const JR_CENTRAL_STATION_NAME_FONT_FAMILY = "ZenMaruGothic";
export const JR_CENTRAL_STATION_NUMBER_FONT_FAMILY = "PublicSans";

/** Fonts needed by the default JR East sign shown at startup. */
export const JR_EAST_FONT_SPECS = [
  ...CJK_FONT_SPECS,
  ...HIND_BADGE_FONT_SPECS,
  ...METRO_BADGE_FONT_SPECS,
  ...JR_CENTRAL_BADGE_FONT_SPECS,
] as const;

export const JR_WEST_FONT_SPECS = [...NOTO_SANS_JP_FONT_SPECS] as const;

export const METRO_LONG_FONT_SPECS = [
  ...NOTO_SANS_JP_FONT_SPECS,
  ...HIND_BADGE_FONT_SPECS,
  ...METRO_BADGE_FONT_SPECS,
  ...JR_CENTRAL_BADGE_FONT_SPECS,
  ...JOST_FONT_SPECS,
] as const;

/** A line map can contain both JR-style and Tokyo Metro-style transfer badges. */
export const LINE_MAP_FONT_SPECS = [
  ...NOTO_SANS_JP_FONT_SPECS,
  ...HIND_BADGE_FONT_SPECS,
  ...METRO_BADGE_FONT_SPECS,
] as const;

const JR_CENTRAL_LINE_MAP_FONT_SPECS = [
  ...LINE_MAP_FONT_SPECS,
  ...JR_CENTRAL_BADGE_FONT_SPECS,
] as const;

/**
 * Common font set used for optional background prefetching. Large
 * style-specific fonts such as Zen Maru Gothic remain strictly on demand.
 */
export const CANVAS_FONT_SPECS = [
  ...CJK_FONT_SPECS,
  ...HIND_BADGE_FONT_SPECS,
  ...METRO_BADGE_FONT_SPECS,
  ...JOST_FONT_SPECS,
] as const;

export type CanvasSignStyle =
  | "jreast"
  | "jreastbranch"
  | "jrcentral"
  | "jrwest"
  | "jrwestlarge"
  | "metrolong"
  | "metroforeign"
  | "metromedium"
  | "toeimedium"
  | "toeilarge";

export function getStationNumberFontSpecs(
  stationNumberStyle?: string,
): readonly string[] {
  if (stationNumberStyle === "jrcentral") {
    return JR_CENTRAL_BADGE_FONT_SPECS;
  }
  return stationNumberStyle === "tokyometro"
    ? METRO_BADGE_FONT_SPECS
    : HIND_BADGE_FONT_SPECS;
}

export function getLineMapFontSpecs(
  stationNumberStyles: readonly (string | undefined)[] = [],
): readonly string[] {
  return stationNumberStyles.includes("jrcentral")
    ? JR_CENTRAL_LINE_MAP_FONT_SPECS
    : LINE_MAP_FONT_SPECS;
}

export function getStationSignFontSpecs(
  style: CanvasSignStyle,
  _stationNumberStyle?: string,
): readonly string[] {
  if (style === "jrcentral") {
    return JR_CENTRAL_FONT_SPECS;
  }
  if (
    style === "metrolong" ||
    style === "metroforeign" ||
    style === "metromedium" ||
    style === "toeimedium" ||
    style === "toeilarge"
  ) {
    return METRO_LONG_FONT_SPECS;
  }
  if (style === "jrwest" || style === "jrwestlarge") {
    return JR_WEST_FONT_SPECS;
  }
  return JR_EAST_FONT_SPECS;
}

const loadedFontSpecs = new Set<string>();
const pendingFontLoads = new Map<string, Promise<void>>();

function loadFontSpec(spec: string): Promise<void> {
  if (loadedFontSpecs.has(spec)) return Promise.resolve();

  const pending = pendingFontLoads.get(spec);
  if (pending) return pending;

  const load = document.fonts
    .load(spec)
    .then(() => {
      loadedFontSpecs.add(spec);
    })
    .finally(() => {
      pendingFontLoads.delete(spec);
    });
  pendingFontLoads.set(spec, load);
  return load;
}

export function areCanvasFontsLoaded(specs: readonly string[]): boolean {
  if (typeof document === "undefined" || !("fonts" in document)) return true;
  return specs.every((spec) => loadedFontSpecs.has(spec));
}

async function waitForNextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function waitForCanvasFonts(
  specs: readonly string[] = CANVAS_FONT_SPECS,
): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  // Do not let one failed face make us stop waiting for the remaining faces.
  // A fail-fast Promise.all could otherwise expose a canvas while another
  // bundled font is still downloading.
  const results = await Promise.allSettled(specs.map(loadFontSpec));
  await document.fonts.ready;

  // Give canvas/Konva two paint cycles after FontFaceSet settles.
  await waitForNextFrame();
  await waitForNextFrame();

  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `Failed to load ${failures.length} canvas font(s)`,
    );
  }
}

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Prefetch optional fonts after the initial preview is usable. Slow or
 * data-saving connections keep the strictly on-demand behavior.
 */
export function prefetchCanvasFontsWhenIdle(): () => void {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return () => undefined;
  }

  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  if (
    connection?.saveData ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "3g"
  ) {
    return () => undefined;
  }

  const idleWindow = window as IdleWindow;
  const prefetch = () => {
    waitForCanvasFonts(CANVAS_FONT_SPECS).catch(() => undefined);
  };

  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(prefetch);
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(prefetch, 1500);
  return () => window.clearTimeout(handle);
}
