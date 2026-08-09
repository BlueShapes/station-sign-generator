export const METRO_MEDIUM_DIMENSIONS = {
  width: 510,
  height: 137,
  ratio: 510 / 137,
  bandTop: 89,
  bandHeight: 48,
} as const;

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
