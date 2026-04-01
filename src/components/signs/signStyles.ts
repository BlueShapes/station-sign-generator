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
  centerSquareColors: FieldRequirement;
  ratio: FieldRequirement;
  /** Fixed aspect ratio (width/height). When defined, the ratio slider is hidden and this value is used for size calculations. */
  fixedRatio?: number;
  direction: FieldRequirement;
  /** Maximum number of local lines. undefined = unlimited. */
  localLinesMax?: number;
  /** Minimum number of local lines. */
  localLinesMin?: number;
}

export const SIGN_STYLE_FIELDS: Record<string, SignStyleFieldSpec> = {
  metrolong: {
    primaryName: "required",
    primaryNameFurigana: "optional",
    secondaryName: "optional",
    tertiaryName: "hidden",
    quaternaryName: "hidden",
    note: "hidden",
    numberPrimary: "required",
    numberSecondary: "hidden",
    threeLetterCode: "hidden",
    stationAreas: "hidden",
    left: {
      primaryName: "required",
      primaryNameFurigana: "optional",
      secondaryName: "optional",
      numberPrimary: "required",
      numberSecondary: "hidden",
    },
    right: {
      primaryName: "required",
      primaryNameFurigana: "optional",
      secondaryName: "optional",
      numberPrimary: "required",
      numberSecondary: "hidden",
    },
    maxAdjacentCount: 2,
    baseColor: "hidden",
    centerSquareColors: "hidden",
    ratio: "hidden",
    fixedRatio: 7.2,
    direction: "required",
    localLinesMax: 1,
    localLinesMin: 1,
  },
  jrwestlarge: {
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
    stationAreas: "optional",
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
    baseColor: "hidden",
    centerSquareColors: "hidden",
    ratio: "hidden",
    fixedRatio: 3.3,
    direction: "required",
    localLinesMax: 1,
    localLinesMin: 1,
  },
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
    stationAreas: "optional",
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
    baseColor: "hidden",
    centerSquareColors: "hidden",
    ratio: "hidden",
    fixedRatio: 3.3,
    direction: "required",
    localLinesMax: 1,
    localLinesMin: 1,
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
    centerSquareColors: "optional",
    ratio: "required",
    direction: "required",
  },
};

export type { SignStyleFieldSpec, AdjacentFieldSpec };
