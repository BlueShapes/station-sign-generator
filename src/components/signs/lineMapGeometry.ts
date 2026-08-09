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

export interface LinearStationLayout {
  /** Station centers measured from the start of the content band. */
  positions: number[];
  /** Full content-band extent, including half of the endpoint expansions. */
  extent: number;
}

export interface ConnectedMarkerLayout {
  /** Nominal top/left positions for each marker. */
  positions: number[];
  /** Nominal extent from the first marker origin to the last marker end. */
  extent: number;
}

/**
 * Place marker shapes so their stroked outer edges touch but never overlap.
 * Each visualOutset is the amount a centered stroke extends beyond its nominal
 * marker bounds on the connection axis.
 */
export function layoutConnectedMarkers(
  markerExtents: number[],
  visualOutsets: number[],
): ConnectedMarkerLayout {
  if (markerExtents.length === 0) return { positions: [], extent: 0 };

  const extents = markerExtents.map((extent) => Math.max(0, extent));
  const outsets = markerExtents.map((_, index) =>
    Math.max(0, visualOutsets[index] ?? 0),
  );
  const positions = [0];
  for (let index = 1; index < extents.length; index += 1) {
    positions.push(
      positions[index - 1] +
        extents[index - 1] +
        outsets[index - 1] +
        outsets[index],
    );
  }

  return {
    positions,
    extent: positions[positions.length - 1] + extents[extents.length - 1],
  };
}

export function getConnectedMarkerExtraExtent(markerExtents: number[]): number {
  if (markerExtents.length < 2) return 0;
  const validExtents = markerExtents.map((extent) =>
    Number.isFinite(extent) ? Math.max(0, extent) : 0,
  );
  return Math.max(
    0,
    validExtents.reduce((sum, extent) => sum + extent, 0) -
      Math.max(...validExtents),
  );
}

/**
 * Expand adjacent station gaps around oversized markers while keeping each
 * marker centered in the space assigned to it.
 */
export function layoutExpandedLinearStations(
  stationSpacing: number,
  markerExtraExtents: number[],
): LinearStationLayout {
  if (markerExtraExtents.length === 0) return { positions: [], extent: 0 };

  const extras = markerExtraExtents.map((extent) =>
    Number.isFinite(extent) ? Math.max(0, extent) : 0,
  );
  const positions = [extras[0] / 2];
  for (let index = 1; index < extras.length; index += 1) {
    positions.push(
      positions[index - 1] +
        stationSpacing +
        extras[index - 1] / 2 +
        extras[index] / 2,
    );
  }

  return {
    positions,
    extent: positions[positions.length - 1] + extras[extras.length - 1] / 2,
  };
}
