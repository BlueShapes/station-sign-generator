import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CUSTOM_TEXT_PARTS,
  createCustomDefinition,
  duplicateCustomSignDefinition,
  getCustomDefinitionFontSpecs,
  normalizeTextPartLayout,
  resolveCustomSelection,
  updateCustomSignDefinition,
} from "../src/customization/model.ts";
import {
  getCustomLineIndicatorVisualStyle,
  getCustomStationNumberBadgeVisualStyle,
} from "../src/customization/registry.ts";
import {
  fitSingleLineFontSize,
  resolveCustomTextConfig,
  shouldAutoFitCustomText,
} from "../src/components/signs/customSignTextLayout.ts";

describe("custom style definitions", () => {
  test("previews every custom-style draft with the simple-input defaults", () => {
    const settings = readFileSync(
      "src/components/settings/CustomStyleSettings.tsx",
      "utf8",
    );
    const preview = readFileSync(
      "src/components/settings/CustomStylePreview.tsx",
      "utf8",
    );

    expect(settings).toContain("<CustomStylePreview");
    expect(settings).toContain("kind={kind}");
    expect(settings).toContain("templateId={templateId}");
    expect(settings).toContain("fontFamily={selectedFont?.family}");
    expect(settings).toContain("layout={layout}");
    expect(preview).toContain('import { DEFAULT_DATA } from "@/db/seed"');
    expect(preview).toContain("<SignComponent {...DEFAULT_DATA}");
    expect(preview).toContain("DEFAULT_DATA.numberPrimaryPrefix");
    expect(preview).toContain("DEFAULT_DATA.numberPrimaryValue");
  });

  test("keeps sign, station-number badge, and route badge definitions distinct", () => {
    const sign = createCustomDefinition("sign", "My sign", "jreast");
    const stationBadge = createCustomDefinition(
      "station-number-badge",
      "My station badge",
      "tokyometro",
    );
    const routeBadge = createCustomDefinition(
      "route-badge",
      "My route badge",
      "rounded-square",
    );

    expect(sign.kind).toBe("sign");
    expect(stationBadge.kind).toBe("station-number-badge");
    expect(routeBadge.kind).toBe("route-badge");
    expect(sign.id).not.toBe(stationBadge.id);
  });

  test("defines every non-number station-sign text role for advanced layout", () => {
    expect(CUSTOM_TEXT_PARTS).toEqual([
      "main-primary",
      "main-furigana",
      "main-secondary",
      "main-tertiary",
      "main-quaternary",
      "main-note",
      "main-area",
      "adjacent-primary",
      "adjacent-furigana",
      "adjacent-secondary",
    ]);
  });

  test("normalizes editable typography without losing zero offsets", () => {
    expect(
      normalizeTextPartLayout({
        fontFamily: "UploadedSans",
        fontSize: 0,
        letterSpacing: 0,
        yOffset: 0,
      }),
    ).toEqual({
      fontFamily: "UploadedSans",
      fontSize: undefined,
      letterSpacing: 0,
      yOffset: 0,
    });
  });

  test("resolves a custom sign to its base template and embedded font", () => {
    const definition = createCustomDefinition("sign", "My sign", "jrcentral", {
      font: {
        name: "Uploaded Sans",
        family: "UploadedSans",
        mimeType: "font/ttf",
        data: new Uint8Array([1, 2, 3]).buffer,
      },
    });

    expect(resolveCustomSelection(definition.id, [definition])).toMatchObject({
      templateId: "jrcentral",
      definition: {
        id: definition.id,
        font: { family: "UploadedSans" },
      },
    });
    expect(new Uint8Array(definition.font.data)).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  test("collects the default and per-part font families for canvas loading", () => {
    const definition = createCustomDefinition("sign", "Fonts", "jreast", {
      fontFamily: "UploadedSans",
      layout: {
        "main-primary": { fontFamily: "DisplayFace" },
        "main-secondary": { fontFamily: "UploadedSans" },
      },
    });

    expect(getCustomDefinitionFontSpecs(definition)).toEqual([
      "400 1em UploadedSans",
      "400 1em DisplayFace",
    ]);
  });

  test("can embed multiple uploaded fonts used by different text parts", () => {
    const first = {
      name: "First",
      family: "FirstFace",
      mimeType: "font/ttf",
      data: new Uint8Array([1]).buffer,
    };
    const second = {
      name: "Second",
      family: "SecondFace",
      mimeType: "font/otf",
      data: new Uint8Array([2]).buffer,
    };
    const definition = createCustomDefinition("sign", "Many fonts", "jreast", {
      fonts: [first, second],
    });

    expect(definition.fonts.map(({ family }) => family)).toEqual([
      "FirstFace",
      "SecondFace",
    ]);
  });

  test("duplicates a sign style with an independent id and font binary", () => {
    const original = createCustomDefinition("sign", "Original", "jrcentral", {
      fontFamily: "DotGothic16",
      font: {
        name: "DotGothic16",
        family: "DotGothic16",
        mimeType: "font/ttf",
        data: new Uint8Array([1, 2, 3]).buffer,
      },
      layout: {
        "adjacent-furigana": { letterSpacing: 1, yOffset: -2 },
      },
    });

    const copy = duplicateCustomSignDefinition(original, "Original copy");

    expect(copy).toMatchObject({
      name: "Original copy",
      kind: "sign",
      templateId: "jrcentral",
      fontFamily: "DotGothic16",
      layout: original.layout,
    });
    expect(copy.id).not.toBe(original.id);
    expect(copy.font.data).not.toBe(original.font.data);
    expect(new Uint8Array(copy.font.data)).toEqual(
      new Uint8Array(original.font.data),
    );
  });

  test("edits a sign style without changing its identity or creation time", () => {
    const original = createCustomDefinition("sign", "Original", "jreast");
    const edited = updateCustomSignDefinition(original, {
      name: "Edited",
      templateId: "jrcentral",
      fontFamily: "DotGothic16",
      layout: { "main-primary": { fontSize: 42 } },
    });

    expect(edited).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      name: "Edited",
      templateId: "jrcentral",
      fontFamily: "DotGothic16",
      layout: { "main-primary": { fontSize: 42 } },
    });
  });
});

describe("custom badge registries", () => {
  test("resolves custom station-number badge template and font", () => {
    const definition = createCustomDefinition(
      "station-number-badge",
      "Metro custom",
      "tokyometro",
      { fontFamily: "UploadedSans" },
    );

    expect(
      getCustomStationNumberBadgeVisualStyle(definition.id, [definition]),
    ).toEqual({ templateId: "tokyometro", fontFamily: "UploadedSans" });
  });

  test("resolves custom route badge shape and font", () => {
    const definition = createCustomDefinition(
      "route-badge",
      "Round custom",
      "circle",
      { fontFamily: "UploadedSans" },
    );

    expect(getCustomLineIndicatorVisualStyle(definition.id, [definition])).toEqual({
      shape: "circle",
      fontFamily: "UploadedSans",
    });
  });
});

describe("custom sign text layout", () => {
  test("overrides font, size, spacing, and y without changing unrelated geometry", () => {
    expect(
      resolveCustomTextConfig(
        {
          fontFamily: "TemplateFace",
          fontSize: 32,
          letterSpacing: 1,
          y: 18,
        },
        {
          fontFamily: "DefaultCustomFace",
          layout: {
            "main-primary": {
              fontFamily: "PartFace",
              fontSize: 40,
              letterSpacing: 3,
              yOffset: -2,
            },
          },
        },
        "main-primary",
      ),
    ).toEqual({
      fontFamily: "PartFace",
      fontSize: 40,
      letterSpacing: 3,
      y: 16,
    });
  });

  test("shrinks a wider custom font to the existing single-line text box", () => {
    expect(
      fitSingleLineFontSize({
        fontSize: 24,
        naturalWidth: 144,
        maxWidth: 96,
      }),
    ).toBeCloseTo(16);
    expect(
      fitSingleLineFontSize({
        fontSize: 24,
        naturalWidth: 80,
        maxWidth: 96,
      }),
    ).toBe(24);
  });

  test("auto-fits font and letter-spacing changes but respects an explicit size", () => {
    const definition = createCustomDefinition("sign", "Wide", "jrwest", {
      fontFamily: "WideFace",
      layout: {
        "main-primary": { fontFamily: "WiderFace" },
        "main-secondary": { fontSize: 48 },
        "adjacent-primary": { letterSpacing: 4 },
      },
    });

    expect(shouldAutoFitCustomText(definition, "main-primary")).toBe(true);
    expect(shouldAutoFitCustomText(definition, "adjacent-primary")).toBe(true);
    expect(shouldAutoFitCustomText(definition, "main-secondary")).toBe(false);
    expect(shouldAutoFitCustomText(null, "main-primary")).toBe(false);
  });

  test("uses the common one-line fitter for every custom station-sign text", () => {
    const source = readFileSync(
      "src/components/signs/CustomSignText.tsx",
      "utf8",
    );

    expect(source).toContain('wrap={wrap ?? "none"}');
    expect(source).toContain("fitSingleLineFontSize");
  });
});
