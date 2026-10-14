import { describe, expect, test } from "bun:test";
import { DEFAULT_DATA } from "../src/db/seed";
import {
  normalizeSimpleInputTypography,
  resolveSimpleInputTextDefinition,
} from "../src/customization/simpleInputTypography";
import { createCustomDefinition, getCustomDefinitionFontSpecs } from "../src/customization/model";
import { resolveCustomTextConfig } from "../src/components/signs/customSignTextLayout";
import { sanitizeDirectInputData } from "../src/lib/textInputSafety";

describe("simple input typography", () => {
  test("preserves old input JSON and default geometry when no overrides exist", () => {
    expect(JSON.stringify(sanitizeDirectInputData(DEFAULT_DATA))).toBe(JSON.stringify(DEFAULT_DATA));
    expect(resolveSimpleInputTextDefinition("jreast", null, undefined)).toBeNull();
    expect(normalizeSimpleInputTypography({ fontFamily: " ", layout: { "main-primary": {} } }))
      .toBeUndefined();
  });

  test("tolerates malformed imports and ignores unknown parts and values", () => {
    for (const invalid of [undefined, null, 5, "NotoSans", [], { layout: [] }, { fontFamily: 5 }]) {
      expect(normalizeSimpleInputTypography(invalid)).toBeUndefined();
    }
    expect(normalizeSimpleInputTypography({
      fontFamily: 4,
      layout: {
        future: { fontFamily: "Bad", fontSize: 60 },
        "main-primary": { fontFamily: 5, fontSize: -1, yOffset: Infinity, letterSpacing: "2" },
        "main-secondary": null,
        "main-note": [],
      },
    })).toBeUndefined();
  });

  test("keeps valid font, size, negative offsets and explicit zero spacing", () => {
    expect(normalizeSimpleInputTypography({
      fontFamily: " NotoSans ",
      layout: {
        "main-primary": { fontFamily: " HindSemiBold ", fontSize: 42, letterSpacing: 0, yOffset: -3 },
        "adjacent-secondary": { fontSize: NaN, letterSpacing: -1, yOffset: 0 },
      },
    })).toEqual({
      fontFamily: "NotoSans",
      layout: {
        "main-primary": { fontFamily: "HindSemiBold", fontSize: 42, letterSpacing: 0, yOffset: -3 },
        "adjacent-secondary": { letterSpacing: -1, yOffset: 0 },
      },
    });
    expect(normalizeSimpleInputTypography({ fontFamily: "A".repeat(500) }).fontFamily).toHaveLength(100);
  });

  test("layers local overrides over saved styles without mutating them", () => {
    const base = createCustomDefinition("sign", "Saved", "jrwest", {
      fontFamily: "NotoSansJP",
      layout: {
        "main-primary": { fontFamily: "Jost", fontSize: 40, yOffset: 2, letterSpacing: 3 },
        "main-note": { fontSize: 12 },
      },
    });
    const original = structuredClone(base);
    const merged = resolveSimpleInputTextDefinition("jrwest", base, {
      fontFamily: "OverusedGrotesk",
      layout: { "main-primary": { yOffset: 0, letterSpacing: 0 } },
    });
    expect(base).toEqual(original);
    expect(merged.fontFamily).toBe("OverusedGrotesk");
    expect(merged.layout["main-primary"]).toEqual({ fontFamily: "Jost", fontSize: 40, yOffset: 0, letterSpacing: 0 });
    expect(merged.layout["main-note"]).toEqual({ fontSize: 12 });
    expect(resolveSimpleInputTextDefinition("jrwest", base, {})).toBe(base);
  });

  test("renders local values through the existing text resolver and font collector", () => {
    const definition = resolveSimpleInputTextDefinition("jreast", null, {
      fontFamily: "NotoSans",
      layout: { "main-primary": { fontFamily: "OverusedGrotesk", fontSize: 45, letterSpacing: 2, yOffset: -4 } },
    });
    expect(resolveCustomTextConfig({ y: 20, fontFamily: "NotoSansJP", fontSize: 30 }, definition, "main-primary"))
      .toEqual({ y: 16, fontFamily: "OverusedGrotesk", fontSize: 45, letterSpacing: 2 });
    expect(getCustomDefinitionFontSpecs(definition)).toEqual(["400 1em NotoSans", "400 1em OverusedGrotesk"]);
  });

  test("round-trips sanitized local settings through direct-input JSON", () => {
    const input = sanitizeDirectInputData({
      ...DEFAULT_DATA,
      typography: { fontFamily: "NotoSans", layout: { "main-secondary": { fontSize: 28, yOffset: -5 } } },
    });
    expect(sanitizeDirectInputData(JSON.parse(JSON.stringify(input))).typography).toEqual(input.typography);
    expect(sanitizeDirectInputData({ ...DEFAULT_DATA, typography: { layout: { "main-primary": { fontFamily: 42 } } } }).typography)
      .toBeUndefined();
  });
});
