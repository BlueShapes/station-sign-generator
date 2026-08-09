import { describe, expect, test } from "bun:test";
import { getLocalizedRailwayName } from "../src/lib/localizedRailwayName.ts";

describe("localized railway image filenames", () => {
  test("uses the name matching the current UI locale", () => {
    expect(
      getLocalizedRailwayName(
        "en",
        ["ja", "en", "ko", "zh-CN"],
        ["東京", "Tokyo", "도쿄", "东京"],
        "station",
      ),
    ).toBe("Tokyo");
  });

  test("respects a railway company's custom language order", () => {
    expect(
      getLocalizedRailwayName(
        "zh-TW",
        ["en", "ja", "zh-TW", "ko"],
        ["Yamanote Line", "山手線", "山手線（繁體）", "야마노테선"],
        "line",
      ),
    ).toBe("山手線（繁體）");
  });

  test("falls back to the first populated name when the locale is unavailable", () => {
    expect(
      getLocalizedRailwayName(
        "de",
        ["ja", "en", "ko", "zh-CN"],
        ["東京", "Tokyo", "도쿄", "东京"],
        "station",
      ),
    ).toBe("東京");
  });

  test("falls back when the matching language slot is empty", () => {
    expect(
      getLocalizedRailwayName(
        "en",
        ["ja", "en", "ko", "zh-CN"],
        ["東京", "", null, undefined],
        "station",
      ),
    ).toBe("東京");
  });
});
