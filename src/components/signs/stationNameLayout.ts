export const SUBWAY_NAME_COMPRESSION_THRESHOLD = 6;

export function spaceSubwayPrimaryName(name: string): string {
  const characters = Array.from(name);
  if (characters.length === 2) return characters.join("　");
  if (characters.length === 3) return characters.join(" ");
  return name;
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
