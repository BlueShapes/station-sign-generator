import type { LocalLine } from "./DirectInputStationProps";
import { getCustomStationNumberBadgeVisualStyle } from "@/customization/registry";

export type SubwayStationNumberAppearance = {
  color: string;
  /** Selected built-in style or custom definition ID used by badge renderers. */
  requestedStyle: string;
  /** Resolved built-in geometry used for style-specific layout decisions. */
  style: string;
  fontFamily?: string;
};

export function getStationNumberBadgeThreeLetterCode(
  style: string | undefined,
  threeLetterCode: string | undefined,
): string | undefined {
  const resolvedStyle = getCustomStationNumberBadgeVisualStyle(style)?.templateId ?? style;
  return !resolvedStyle || resolvedStyle === "jreast" ? threeLetterCode : undefined;
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
  const requestedStyle = style ?? matchingLine?.stationNumberStyle ?? fallbackStyle;
  const customStyle = getCustomStationNumberBadgeVisualStyle(requestedStyle);
  return {
    color: color ?? matchingLine?.color ?? fallbackColor,
    requestedStyle,
    style: customStyle?.templateId ?? requestedStyle,
    fontFamily: customStyle?.fontFamily,
  };
}
