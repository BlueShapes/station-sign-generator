export const SUBWAY_NAME_COMPRESSION_THRESHOLD = 6;

export function spaceTokyoMetroPrimaryName(name: string): string {
  const characters = Array.from(name);
  if (characters.length === 2) return characters.join("　");
  if (characters.length === 3) return characters.join(" ");
  return name;
}

export function spaceToeiPrimaryName(name: string): string {
  const characters = Array.from(name);
  if (characters.length === 2) return characters.join("　");
  return name;
}

export function spaceToeiSidePrimaryName(
  name: string,
  adjacentStationCount = 1,
): string {
  const characters = Array.from(name);
  if (adjacentStationCount === 1 && characters.length === 2) {
    return characters.join(" ");
  }
  return name;
}

export function joinSubwayAdjacentText(
  values: readonly (string | undefined)[],
): string {
  return values
    .slice(0, 2)
    .map((value) => value ?? "")
    .join("／");
}

/**
 * Badge data is stored outside-to-inside. Text is read left-to-right, so the
 * right-hand label needs the opposite order to remain aligned with its badges.
 */
export function orderSubwayAdjacentTextValues<T>(
  values: readonly T[],
  side: "left" | "right",
): T[] {
  const orderedValues = values.slice(0, 2);
  return side === "right" ? orderedValues.reverse() : orderedValues;
}

/**
 * Tokyo Metro and Toei names keep their native type size whenever they fit.
 * Names longer than the six-character reference, or shorter names made too
 * wide by layout/font adjustments, are condensed horizontally instead of
 * being clipped by the canvas text box.
 */
export function getSubwayStationNameScaleX(
  name: string,
  naturalWidth: number,
  maxWidth: number,
): number {
  if (naturalWidth <= 0 || maxWidth <= 0) {
    return 1;
  }

  const exceedsReferenceLength =
    Array.from(name).length > SUBWAY_NAME_COMPRESSION_THRESHOLD;
  const exceedsAvailableWidth = naturalWidth > maxWidth;
  if (!exceedsReferenceLength && !exceedsAvailableWidth) return 1;

  return Math.min(1, maxWidth / naturalWidth);
}

export function getSubwaySideTextFit({
  text,
  naturalWidth,
  maxWidth,
  originX,
  side,
}: {
  text: string;
  naturalWidth: number;
  maxWidth: number;
  originX: number;
  side: "left" | "right";
}): { x: number; width: number; scaleX: number } {
  const scaleX = getSubwayStationNameScaleX(text, naturalWidth, maxWidth);
  const renderedWidth = naturalWidth * scaleX;

  return {
    x: side === "left" ? originX : originX + maxWidth - renderedWidth,
    width: naturalWidth,
    scaleX,
  };
}
