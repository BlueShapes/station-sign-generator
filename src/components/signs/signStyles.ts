/**
 * Describes which fields each sign style requires or supports.
 * Use this to decide which inputs to show/hide for a given style.
 */

type FieldRequirement = "required" | "optional" | "hidden";

type AdjacentFieldSpec = {
  primaryName: FieldRequirement;
  primaryNameFurigana: FieldRequirement;
  secondaryName: FieldRequirement;
  numberPrimary: FieldRequirement;
  numberSecondary: FieldRequirement;
};

interface SignStyleFieldSpec {
  // Current station
  primaryName: FieldRequirement;
  primaryNameFurigana: FieldRequirement;
  secondaryName: FieldRequirement; // English in default
  tertiaryName: FieldRequirement; // Korean in default
  quaternaryName: FieldRequirement; // Chinese in default
  note: FieldRequirement;
  numberPrimary: FieldRequirement;
  numberSecondary: FieldRequirement;
  threeLetterCode: FieldRequirement;
  stationAreas: FieldRequirement;
  // Adjacent stations
  left: AdjacentFieldSpec;
  right: AdjacentFieldSpec;
  /** Maximum number of adjacent stations per side. undefined = unlimited. */
  maxAdjacentCount?: number;
  // Sign config
  baseColor: FieldRequirement;
  ratio: FieldRequirement;
  direction: FieldRequirement;
}

export const SIGN_STYLE_FIELDS: Record<string, SignStyleFieldSpec> = {
  jrwest: {
    // Current station
    primaryName: "required",
    primaryNameFurigana: "required",
    secondaryName: "required",
    tertiaryName: "hidden",
    quaternaryName: "hidden",
    note: "hidden",
    numberPrimary: "hidden",
    numberSecondary: "hidden",
    threeLetterCode: "hidden",
    stationAreas: "hidden",
    // Adjacent stations
    left: {
      primaryName: "hidden",
      primaryNameFurigana: "required",
      secondaryName: "required",
      numberPrimary: "hidden",
      numberSecondary: "hidden",
    },
    right: {
      primaryName: "hidden",
      primaryNameFurigana: "required",
      secondaryName: "required",
      numberPrimary: "hidden",
      numberSecondary: "hidden",
    },
    maxAdjacentCount: 2,
    // Sign config
    baseColor: "required",
    ratio: "hidden",
    direction: "required",
  },
  jreast: {
    // Current station
    primaryName: "required",
    primaryNameFurigana: "optional",
    secondaryName: "required",
    tertiaryName: "optional",
    quaternaryName: "optional",
    note: "optional",
    numberPrimary: "optional",
    numberSecondary: "optional",
    threeLetterCode: "optional",
    stationAreas: "optional",
    // Adjacent stations
    left: {
      primaryName: "required",
      primaryNameFurigana: "hidden",
      secondaryName: "required",
      numberPrimary: "optional",
      numberSecondary: "optional",
    },
    right: {
      primaryName: "required",
      primaryNameFurigana: "hidden",
      secondaryName: "required",
      numberPrimary: "optional",
      numberSecondary: "optional",
    },
    // Sign config
    baseColor: "required",
    ratio: "required",
    direction: "required",
  },
};

export type { SignStyleFieldSpec, AdjacentFieldSpec };
