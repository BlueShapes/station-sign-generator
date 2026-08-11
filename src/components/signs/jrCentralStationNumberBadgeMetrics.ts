export function getJrCentralStationNumberBadgeMetrics(size: number): {
  width: number;
  height: number;
  headerHeight: number;
  strokeWidth: number;
  prefixFontSize: number;
  prefixY: number;
  valueFontSize: number;
  valueY: number;
} {
  return {
    width: size,
    height: size,
    headerHeight: size * 0.4,
    strokeWidth: Math.max(0.8, size * 0.046),
    prefixFontSize: size * 0.35,
    prefixY: size * 0.04,
    valueFontSize: size * 0.63,
    valueY: size * 0.39,
  };
}
