export const DEFAULT_TRACK_WIDTH = 6;
export const MIN_TRACK_WIDTH = 2;
export const MAX_TRACK_WIDTH = 30;
export const DEFAULT_FADE_DOT_SPACING = 10;
export const CONNECTED_STATION_NAME_SCALE = 1.15;

const DEFAULT_SERVICE_TRACK_WIDTH = 4;
const DEFAULT_SERVICE_TRACK_GAP = 16;
const FADE_DOT_GAP = 4;

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

/** Keep fade dots visually separate even when they grow with a thick track. */
export function getFadeDotSpacing(trackWidth: number): number {
  const width = Number.isFinite(trackWidth)
    ? Math.max(0, trackWidth)
    : DEFAULT_TRACK_WIDTH;
  return Math.max(DEFAULT_FADE_DOT_SPACING, width + FADE_DOT_GAP);
}

export interface SegmentedTrackEndCap {
  x: number;
  y: number;
  color: string;
  radius: number;
}

export interface SegmentedTrackRun {
  points: Array<{ x: number; y: number }>;
  color: string;
}

/**
 * Merge adjacent segments with the same colour into one canvas stroke.
 * Drawing every edge separately can leave an anti-aliased hairline at the
 * shared endpoint, especially when a thick track extends past a badge.
 */
export function getSegmentedTrackRuns(
  stationPoints: Array<{ x: number; y: number }>,
  colors: string[],
): SegmentedTrackRun[] {
  if (
    colors.length === 0 ||
    colors.length !== stationPoints.length - 1
  ) {
    return [];
  }

  const runs: SegmentedTrackRun[] = [];
  let currentRun: SegmentedTrackRun = {
    points: [stationPoints[0], stationPoints[1]],
    color: colors[0],
  };

  for (let index = 1; index < colors.length; index += 1) {
    const color = colors[index];
    const isSameColor =
      color.trim().toLowerCase() === currentRun.color.trim().toLowerCase();
    if (isSameColor) {
      currentRun.points.push(stationPoints[index + 1]);
      continue;
    }

    runs.push(currentRun);
    currentRun = {
      points: [stationPoints[index], stationPoints[index + 1]],
      color,
    };
  }

  runs.push(currentRun);
  return runs;
}

/**
 * Add round caps only to the outside ends of a colour-segmented track.
 * Segment joins remain square so adjacent route colours meet cleanly.
 */
export function getSegmentedTrackEndCaps(
  stationPoints: Array<{ x: number; y: number }>,
  colors: string[],
  strokeWidth: number,
): SegmentedTrackEndCap[] {
  const firstPoint = stationPoints[0];
  const lastPoint = stationPoints[stationPoints.length - 1];
  if (
    !firstPoint ||
    !lastPoint ||
    colors.length === 0 ||
    colors.length !== stationPoints.length - 1
  ) {
    return [];
  }

  const radius = strokeWidth / 2;
  return [
    { ...firstPoint, color: colors[0], radius },
    { ...lastPoint, color: colors[colors.length - 1], radius },
  ];
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
 * Connected station-number groups need extra room when they sit on the route
 * itself, or when vertical station names place every badge on the same row.
 * Standard horizontal names alternate badges above and below the route, so
 * expanding those gaps would only make the map unnecessarily sparse.
 */
export function shouldExpandStationNumberGroups(
  mode: "none" | "badge" | "dot",
  orientation: "horizontal" | "vertical",
  nameStyle?: "normal" | "above" | "below",
): boolean {
  return (
    mode === "dot" ||
    (mode === "badge" &&
      orientation === "horizontal" &&
      (nameStyle === "above" || nameStyle === "below"))
  );
}

/** Slightly emphasize route-connection stations that carry multiple numbers. */
export function getConnectedStationNameScale(
  stationNumberCount: number,
  emphasize: boolean,
): number {
  return emphasize && stationNumberCount >= 2
    ? CONNECTED_STATION_NAME_SCALE
    : 1;
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
