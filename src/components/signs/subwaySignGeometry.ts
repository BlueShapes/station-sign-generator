export const METRO_MEDIUM_DIMENSIONS = {
  width: 510,
  height: 137,
  ratio: 510 / 137,
  bandTop: 89,
  bandHeight: 48,
} as const;

export const TOEI_BADGE_DIAMETERS = {
  medium: { main: 55, side: 35 },
  large: { main: 43, side: 29 },
} as const;

export const TOEI_JAPANESE_LETTER_SPACING = 1.5;

type ToeiMainLayoutOptions = {
  width: number;
  renderedMainNameWidth: number;
  secondaryNameWidth: number;
  badgeOuter: number;
  large: boolean;
};

export function getToeiMainLayout({
  width,
  renderedMainNameWidth,
  secondaryNameWidth,
  badgeOuter,
  large,
}: ToeiMainLayoutOptions) {
  const horizontalMargin = 12;
  const badgeGap = large ? 8 : 10;
  const maxSecondaryShift = large ? 10 : 8;
  const longSecondaryThreshold = width * 0.42;
  const secondaryShift = Math.min(
    maxSecondaryShift,
    Math.max(0, secondaryNameWidth - longSecondaryThreshold) * 0.12,
  );
  const textCenterX = width / 2 - secondaryShift;
  const mainNameLeft = textCenterX - renderedMainNameWidth / 2;
  const badgeCx = Math.max(
    horizontalMargin + badgeOuter / 2,
    mainNameLeft - badgeGap - badgeOuter / 2,
  );

  return {
    textCenterX,
    badgeCx,
    badgeGap,
    badgeCyOffset: large ? 45 : 44,
  };
}

export type SubwayBadgeKind = "main" | "side";

export function getSubwayBadgeTextAdjustments(
  diameter: number,
  kind: SubwayBadgeKind,
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
