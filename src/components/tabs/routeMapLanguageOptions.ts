import type { StationNameField } from "@/components/signs/LineMapRenderer";
import { getRailwayLanguageLabel } from "@/lib/railwayLanguages";

const LANGUAGE_STATION_NAME_FIELDS: StationNameField[] = [
  "primary_name",
  "secondary_name",
  "tertiary_name",
  "quaternary_name",
];

export interface RouteMapLanguageOption {
  value: StationNameField;
  label: string;
}

export function getRouteMapLanguageOptions(
  languages: string[],
  languageSlotLabels: readonly string[],
  furiganaLabel: string,
): RouteMapLanguageOption[] {
  const languageOptions = languages.map((language, index) => ({
    value: LANGUAGE_STATION_NAME_FIELDS[index],
    label: `${languageSlotLabels[index]} (${getRailwayLanguageLabel(language)})`,
  }));

  return [
    languageOptions[0],
    { value: "primary_name_furigana", label: furiganaLabel },
    ...languageOptions.slice(1),
  ];
}
