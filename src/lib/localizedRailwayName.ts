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
