/**
 * Resolve the name stored in the language slot matching the current UI locale.
 * If that slot is unavailable or empty, preserve the existing primary-name
 * behaviour by falling back to the first populated name.
 */
export function getLocalizedRailwayName(
  locale: string,
  languages: readonly string[],
  names: readonly (string | null | undefined)[],
  fallback: string,
): string {
  const localizedIndex = languages.findIndex((language) => language === locale);
  const localizedName =
    localizedIndex >= 0 ? names[localizedIndex]?.trim() : undefined;

  if (localizedName) return localizedName;

  return names.find((name) => name?.trim())?.trim() ?? fallback;
}

interface RouteSignFilenameOptions {
  locale: string;
  languages: readonly string[];
  lineNames: readonly (string | null | undefined)[];
  stationNames: readonly (string | null | undefined)[];
  directionLabel: string;
}

/** Build a route-input station-sign filename in the active railway language. */
export function getRouteSignFilename({
  locale,
  languages,
  lineNames,
  stationNames,
  directionLabel,
}: RouteSignFilenameOptions): string {
  const lineName = getLocalizedRailwayName(
    locale,
    languages,
    lineNames,
    "line",
  );
  const stationName = getLocalizedRailwayName(
    locale,
    languages,
    stationNames,
    "station",
  );
  return `${lineName}_${stationName}_${directionLabel}`;
}
