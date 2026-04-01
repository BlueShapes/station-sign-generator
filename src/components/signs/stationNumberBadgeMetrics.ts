export const TOKYO_METRO_STATION_NUMBER_REF = {
  innerSize: 30,
  strokeWidth: 3.689655172413793,
  prefixFontSize: 11,
  valueFontSize: 11,
  prefixYOffset: 5.5,
  valueYOffset: 14.5,
  prefixFontWeight: "600",
  valueFontWeight: "700",
} as const;

export function getTokyoMetroStationNumberMetrics(
  innerSize: number,
) {
  const scale = innerSize / TOKYO_METRO_STATION_NUMBER_REF.innerSize;
  return {
    strokeWidth: TOKYO_METRO_STATION_NUMBER_REF.strokeWidth * scale,
    prefixFontSize: TOKYO_METRO_STATION_NUMBER_REF.prefixFontSize * scale,
    valueFontSize: TOKYO_METRO_STATION_NUMBER_REF.valueFontSize * scale,
    prefixYOffset: TOKYO_METRO_STATION_NUMBER_REF.prefixYOffset * scale,
    valueYOffset: TOKYO_METRO_STATION_NUMBER_REF.valueYOffset * scale,
    prefixFontWeight: TOKYO_METRO_STATION_NUMBER_REF.prefixFontWeight,
    valueFontWeight: TOKYO_METRO_STATION_NUMBER_REF.valueFontWeight,
  };
}
