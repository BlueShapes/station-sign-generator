export const METRO_MEDIUM_DIMENSIONS = {
  width: 510,
  height: 137,
  ratio: 510 / 137,
  bandTop: 89,
  bandHeight: 48,
} as const;

/**
 * Medium/large subway arrow based on the Tokyo Metro small-sign silhouette.
 * Its arrowhead is inset slightly at the top and bottom so it is a little
 * slimmer than the small-sign version while retaining the same shaft shape.
 */
export function getSubwayMediumArrowPoints(
  width: number,
  height: number,
  direction: "left" | "right" = "right",
): number[] {
  type Point = readonly [x: number, y: number];
  const mirrorVertically = ([x, y]: Point): Point => [x, height - y];

  const outerTopLeft: Point = [width * 0.44, 0];
  const outerTopRight: Point = [width * 0.63, 0];
  const tip: Point = [width * 0.95, height * 0.5];
  const shaftTopLeft: Point = [5, height * 0.40];
  const shaftTopRight: Point = [width * 0.71, height * 0.38];

  const rightArrow = [
    outerTopLeft,
    outerTopRight,
    tip,
    mirrorVertically(outerTopRight),
    mirrorVertically(outerTopLeft),
    mirrorVertically(shaftTopRight),
    mirrorVertically(shaftTopLeft),
    shaftTopLeft,
    shaftTopRight,
  ];

  return rightArrow.flatMap(([x, y]) => [
    direction === "left" ? width - x : x,
    y,
  ]);
}

export type MetroSmallBadgeKind = "main" | "side";

export function getMetroSmallBadgeTextAdjustments(
  diameter: number,
  kind: MetroSmallBadgeKind,
) {
  const referenceDiameter = kind === "main" ? 38 * 1.3 : 22 * 1.3;
  const scale = diameter / referenceDiameter;
  return {
    prefixFontSizeDelta: kind === "main" ? 3 * scale : 0,
    valueFontSizeDelta: (kind === "main" ? 8 : 3) * scale,
    prefixYOffsetDelta: kind === "main" ? -2 * scale : 0,
    valueYOffsetDelta: kind === "side" ? 0.5 * scale : 0,
    valueXOffsetDelta: kind === "side" ? 0.6 * scale : 0,
    valueLetterSpacing: Math.max(0, 2 * scale - 1),
    valueFontStyle: "bold" as const,
  };
}
