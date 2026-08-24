import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import { getRouteSignFilename } from "../src/lib/localizedRailwayName.ts";

describe("route-input station-sign filenames", () => {
  test("includes the localized line, station, and direction", () => {
    expect(
      getRouteSignFilename({
        locale: "ja",
        languages: ["ja", "en", "ko", "zh-CN"],
        lineNames: ["山手線", "Yamanote Line", "야마노테선", "山手线"],
        stationNames: [
          "高輪ゲートウェイ",
          "Takanawa Gateway",
          "다카나와 게이트웨이",
          "高轮Gateway",
        ],
        directionLabel: "右向き",
      }),
    ).toBe("山手線_高輪ゲートウェイ_右向き");
  });

  test("uses the company language order for both railway names", () => {
    expect(
      getRouteSignFilename({
        locale: "en",
        languages: ["ja", "en", "zh-TW", "ko"],
        lineNames: ["山手線", "Yamanote Line", "山手線（繁體）", "야마노테선"],
        stationNames: ["東京", "Tokyo", "東京（繁體）", "도쿄"],
        directionLabel: "Right-facing",
      }),
    ).toBe("Yamanote Line_Tokyo_Right-facing");
  });

  test("defines filename direction labels in every locale", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const sign = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      ).route?.sign;
      expect(sign?.["filename-direction-left"]).toBeString();
      expect(sign?.["filename-direction-both"]).toBeString();
      expect(sign?.["filename-direction-right"]).toBeString();
    }
  });
});
