/**
 * Describes which fields each sign style requires or supports.
 * Use this to decide which inputs to show/hide for a given style.
 */

type FieldRequirement = "required" | "optional" | "hidden";

interface SignStyleFieldSpec {
  // Current station
  primaryName: FieldRequirement;
  primaryNameFurigana: FieldRequirement;
  secondaryName: FieldRequirement;   // English in default
  tertiaryName: FieldRequirement;    // Korean in default
  quaternaryName: FieldRequirement;  // Chinese in default
  note: FieldRequirement;
  numberPrimary: FieldRequirement;
  numberSecondary: FieldRequirement;
  threeLetterCode: FieldRequirement;
  stationAreas: FieldRequirement;
  // Adjacent stations
  leftPrimaryName: FieldRequirement;
  leftPrimaryNameFurigana: FieldRequirement;
  leftSecondaryName: FieldRequirement;
  leftNumberPrimary: FieldRequirement;
  leftNumberSecondary: FieldRequirement;
  rightPrimaryName: FieldRequirement;
  rightPrimaryNameFurigana: FieldRequirement;
  rightSecondaryName: FieldRequirement;
  rightNumberPrimary: FieldRequirement;
  rightNumberSecondary: FieldRequirement;
  // Sign config
  baseColor: FieldRequirement;
  lineColor: FieldRequirement;
  ratio: FieldRequirement;
  direction: FieldRequirement;
}

export const SIGN_STYLE_FIELDS: Record<string, SignStyleFieldSpec> = {
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
    leftPrimaryName: "required",
    leftPrimaryNameFurigana: "hidden",
    leftSecondaryName: "required",
    leftNumberPrimary: "optional",
    leftNumberSecondary: "optional",
    rightPrimaryName: "required",
    rightPrimaryNameFurigana: "hidden",
    rightSecondaryName: "required",
    rightNumberPrimary: "optional",
    rightNumberSecondary: "optional",
    // Sign config
    baseColor: "required",
    lineColor: "required",
    ratio: "required",
    direction: "required",
  },
};

export type { SignStyleFieldSpec };
