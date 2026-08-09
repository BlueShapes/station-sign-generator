export const METRO_MEDIUM_DIMENSIONS = {
  width: 510,
  height: 137,
  ratio: 510 / 137,
  bandTop: 89,
  bandHeight: 48,
} as const;

export const TOEI_BADGE_DIAMETERS = {
  medium: { main: 55, side: 34 },
  large: { main: 52, side: 31 },
} as const;

export const TOEI_JAPANESE_LETTER_SPACING = 1.5;
export const TOEI_BADGE_NUMBER_STROKE_WIDTH = 0.6;
export const TOEI_LARGE_MAIN_TOP_GAP_EM = 0.5;

export const TOEI_SHARED_LAYOUT = {
  bandHeight: 17,
  mainNameSize: 48,
  mainFuriganaSize: 20,
  mainSecondarySize: 23,
  sideBlockWidth: 150,
  horizontalMargin: 10,
  sideNameSize: 22,
  sideSecondarySize: 13,
  arrowWidth: 51,
  arrowHeight: 37,
  badgeArrowDistance: 19,
  mainFuriganaYOffset: 50,
  mainSecondaryYOffset: 72,
} as const;

export function getToeiVerticalLayout(height: number, large: boolean) {
  if (!large) {
    return {
      mainTop: 22,
      arrowY: 98,
      sideNameY: 137,
      sideSecondaryY: 161,
    };
  }

  const bottomTextGap = 3;
  const sideSecondaryY =
    height -
    TOEI_SHARED_LAYOUT.bandHeight -
    TOEI_SHARED_LAYOUT.sideSecondarySize -
    bottomTextGap;
  const sideNameY = sideSecondaryY - 24;
  const arrowY =
    sideNameY - TOEI_SHARED_LAYOUT.arrowHeight - 3;

  return {
    mainTop:
      TOEI_SHARED_LAYOUT.bandHeight +
      TOEI_SHARED_LAYOUT.mainNameSize * TOEI_LARGE_MAIN_TOP_GAP_EM,
    arrowY,
    sideNameY,
    sideSecondaryY,
  };
}

type ToeiMainLayoutOptions = {
  width: number;
  renderedMainNameWidth: number;
  secondaryNameWidth: number;
  badgeOuter: number;
};

export function getToeiMainLayout({
  width,
  renderedMainNameWidth,
  secondaryNameWidth,
  badgeOuter,
}: ToeiMainLayoutOptions) {
  const horizontalMargin = 12;
  const badgeGap = 7;
  const maxSecondaryShift = 8;
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
    badgeCyOffset: 44,
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
