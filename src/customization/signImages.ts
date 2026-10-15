/** Positions and sizes use the sign's logical canvas coordinates. */
export interface SignImagePlacement {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export const MAX_SIGN_IMAGES = 50;
export const DEFAULT_SIGN_IMAGE_SIZE = 40;

export function createSignImagePlacement(image: {
  id: string;
  width: number;
  height: number;
}): SignImagePlacement {
  const scale = DEFAULT_SIGN_IMAGE_SIZE / Math.max(image.width, image.height, 1);
  return {
    id: crypto.randomUUID(),
    imageId: image.id,
    x: 0,
    y: 0,
    width: Math.max(0.1, image.width * scale),
    height: Math.max(0.1, image.height * scale),
    rotation: 0,
    opacity: 1,
  };
}

/** Keep JSON imports bounded and preserve [] as an explicit override of a style. */
export function normalizeSignImages(value: unknown): SignImagePlacement[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set<string>();
  const finite = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  return value.slice(0, MAX_SIGN_IMAGES).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || typeof entry.imageId !== "string" || !entry.imageId.trim()) return [];
    const candidate = typeof entry.id === "string" && entry.id ? entry.id.slice(0, 100) : `image-${index}`;
    let id = candidate;
    let suffix = 0;
    while (ids.has(id)) id = `${candidate}-${index}-${++suffix}`;
    ids.add(id);
    return [{
      id,
      imageId: entry.imageId.slice(0, 100),
      x: finite(entry.x, 0, -10000, 10000),
      y: finite(entry.y, 0, -10000, 10000),
      width: finite(entry.width, DEFAULT_SIGN_IMAGE_SIZE, 0.1, 10000),
      height: finite(entry.height, DEFAULT_SIGN_IMAGE_SIZE, 0.1, 10000),
      rotation: finite(entry.rotation, 0, -360, 360),
      opacity: finite(entry.opacity, 1, 0, 1),
    }];
  });
}

export function routeSignImageKey(lineId: string, stationId: string, styleId: string): string {
  return JSON.stringify([lineId, stationId, styleId]);
}

export function normalizeRouteSignImages(value: unknown): Record<string, SignImagePlacement[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, raw]) => {
    const images = normalizeSignImages(raw);
    return images ? [[key, images]] : [];
  }));
}
