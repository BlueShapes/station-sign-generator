import { describe, expect, test } from "bun:test";
import {
  getStationNumberBadgeThreeLetterCode,
  resolveSubwayStationNumberAppearance,
} from "../src/components/signs/subwayStationNumberAppearance.ts";
import { registerCustomDefinitions } from "../src/customization/registry.ts";

describe("station-number appearance", () => {
  const localLines = [
    {
      id: "line-selected",
      prefix: "M",
      color: "#dd3839",
      stationNumberStyle: "tokyometro",
    },
    {
      id: "line-adjacent",
      prefix: "JC",
      color: "#f15a22",
      stationNumberStyle: "jreast",
    },
  ];

  test("matches color and shape to the number prefix in simple input", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "JC",
        localLines,
        fallbackColor: "#dd3839",
      }),
    ).toEqual({
      color: "#f15a22",
      style: "jreast",
      requestedStyle: "jreast",
    });
  });

  test("uses resolved source-line metadata from route input", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "A",
        color: "#e85298",
        style: "jrcentral",
        localLines,
        fallbackColor: "#dd3839",
      }),
    ).toEqual({
      color: "#e85298",
      style: "jrcentral",
      requestedStyle: "jrcentral",
    });
  });

  test("keeps the subway badge defaults when no metadata exists", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "G",
        fallbackColor: "#f39700",
      }),
    ).toEqual({
      color: "#f39700",
      style: "tokyometro",
      requestedStyle: "tokyometro",
    });
  });

  test("uses a style-specific fallback for non-subway signs", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "CA",
        fallbackColor: "#f77321",
        fallbackStyle: "jrcentral",
      }),
    ).toEqual({
      color: "#f77321",
      style: "jrcentral",
      requestedStyle: "jrcentral",
    });
  });

  test("preserves a simple-input custom badge selection for rendering", () => {
    const definition = {
      id: "custom-station-badge",
      kind: "station-number-badge",
      name: "Custom station badge",
      templateId: "jreast",
      fontFamily: "CustomBadgeFont",
      layout: {},
      createdAt: 1,
      updatedAt: 1,
    };
    registerCustomDefinitions([definition]);

    try {
      expect(
        resolveSubwayStationNumberAppearance({
          prefix: "C",
          localLines: [
            {
              id: "custom-line",
              prefix: "C",
              color: "#123456",
              stationNumberStyle: definition.id,
            },
          ],
          fallbackColor: "#000000",
        }),
      ).toEqual({
        color: "#123456",
        style: "jreast",
        requestedStyle: definition.id,
        fontFamily: "CustomBadgeFont",
      });
    } finally {
      registerCustomDefinitions([]);
    }
  });

  test("decorates three-letter codes only on JR East badges", () => {
    expect(getStationNumberBadgeThreeLetterCode("jreast", "TYO")).toBe("TYO");
    expect(getStationNumberBadgeThreeLetterCode(undefined, "TYO")).toBe("TYO");
    expect(getStationNumberBadgeThreeLetterCode("tokyometro", "TYO"))
      .toBeUndefined();
    expect(getStationNumberBadgeThreeLetterCode("jrcentral", "TYO"))
      .toBeUndefined();
  });
});
