import type { LocalLine } from "./DirectInputStationProps";

export type SubwayStationNumberAppearance = {
  color: string;
  style: string;
};

export function getStationNumberBadgeThreeLetterCode(
  style: string | undefined,
  threeLetterCode: string | undefined,
): string | undefined {
  return !style || style === "jreast" ? threeLetterCode : undefined;
}

/**
 * Resolve a badge from the line that owns the displayed station number.
 *
 * Route input supplies explicit values because an inherited number's source
 * line is not necessarily present in the selected station's line list. Simple
 * input falls back to matching the selected prefix against its local lines.
 */
export function resolveSubwayStationNumberAppearance({
  prefix,
  color,
  style,
  localLines,
  fallbackColor,
  fallbackStyle = "tokyometro",
}: {
  prefix?: string;
  color?: string;
  style?: string;
  localLines?: LocalLine[];
  fallbackColor: string;
  fallbackStyle?: string;
}): SubwayStationNumberAppearance {
  const matchingLine = localLines?.find((line) => line.prefix === prefix);
  return {
    color: color ?? matchingLine?.color ?? fallbackColor,
    style:
      style ?? matchingLine?.stationNumberStyle ?? fallbackStyle,
  };
}
