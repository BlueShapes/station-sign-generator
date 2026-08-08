export const DEFAULT_TRACK_WIDTH = 6;
export const MIN_TRACK_WIDTH = 2;
export const MAX_TRACK_WIDTH = 30;

const DEFAULT_SERVICE_TRACK_WIDTH = 4;
const DEFAULT_SERVICE_TRACK_GAP = 16;

export function ceilCanvasDimensions(
  width: number,
  height: number,
): { w: number; h: number } {
  return { w: Math.ceil(width), h: Math.ceil(height) };
}

export function normalizeTrackWidth(width?: number): number {
  const value = Number.isFinite(width) ? width! : DEFAULT_TRACK_WIDTH;
  return Math.min(MAX_TRACK_WIDTH, Math.max(MIN_TRACK_WIDTH, value));
}

export function getServiceTrackWidth(trackWidth: number): number {
  return normalizeTrackWidth(trackWidth) *
    (DEFAULT_SERVICE_TRACK_WIDTH / DEFAULT_TRACK_WIDTH);
}

export function getServiceTrackGap(trackWidth: number): number {
  return Math.max(
    DEFAULT_SERVICE_TRACK_GAP,
    getServiceTrackWidth(trackWidth) + 4,
  );
}

export function getTrackEdgeRadius(
  markerRadius: number,
  trackWidth: number,
): number {
  return Math.max(markerRadius, normalizeTrackWidth(trackWidth) / 2);
}
