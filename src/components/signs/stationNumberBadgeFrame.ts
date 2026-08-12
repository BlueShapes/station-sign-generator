export type JrEastStationNumberBadgeFrameMetrics = {
  scale: number;
  outerPaddingX: number;
  outerYOffset: number;
  outerHeight: number;
  headerHeight: number;
  innerYOffset: number;
  strokeWidth: number;
  outerCornerRadius: number;
  innerCornerRadius: number;
  innerBottomCornerRadius: number;
  connectedBadgeStep: number;
  codeFontSize: number;
  codeYOffset: number;
};

/**
 * JR East station-sign frame geometry, based on a 30×30 inner number badge.
 * Route maps and other rendering contexts should keep separate metrics unless
 * they intentionally use this exact reference geometry.
 */
export function getJrEastStationNumberBadgeFrameMetrics(
  size: number,
): JrEastStationNumberBadgeFrameMetrics {
  const scale = size / 30;
  return {
    scale,
    outerPaddingX: 3 * scale,
    // Direct-input signs historically anchor an unframed badge at y=18 and
    // the framed badge at y=17. Keep that one-unit optical lift explicit.
    outerYOffset: -1 * scale,
    outerHeight: 45 * scale,
    headerHeight: 12 * scale,
    innerYOffset: 11 * scale,
    strokeWidth: 3 * scale,
    outerCornerRadius: 4 * scale,
    innerCornerRadius: 2 * scale,
    innerBottomCornerRadius: 1 * scale,
    connectedBadgeStep: 36 * scale,
    codeFontSize: 12.2 * scale,
    codeYOffset: 0,
  };
}
