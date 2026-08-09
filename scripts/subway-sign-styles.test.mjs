import { describe, expect, test } from "bun:test";
import { SIGN_STYLE_FIELDS } from "../src/components/signs/signStyles.ts";
import {
  getSubwayStationNameScaleX,
  spaceSubwayPrimaryName,
  SUBWAY_NAME_COMPRESSION_THRESHOLD,
} from "../src/components/signs/stationNameLayout.ts";
import {
  getMetroSmallBadgeTextAdjustments,
  METRO_MEDIUM_DIMENSIONS,
} from "../src/components/signs/subwaySignGeometry.ts";

describe("subway sign style fields", () => {
  test("small Tokyo Metro variants expose only their displayed subtext", () => {
    expect(SIGN_STYLE_FIELDS.metrolong.primaryNameFurigana).toBe("required");
    expect(SIGN_STYLE_FIELDS.metrolong.secondaryName).toBe("hidden");
    expect(SIGN_STYLE_FIELDS.metroforeign.primaryNameFurigana).toBe("hidden");
    expect(SIGN_STYLE_FIELDS.metroforeign.secondaryName).toBe("required");
  });

  test("medium and large variants use fixed reference proportions", () => {
    expect(SIGN_STYLE_FIELDS.metromedium.fixedRatio).toBeCloseTo(
      METRO_MEDIUM_DIMENSIONS.ratio,
    );
    expect(SIGN_STYLE_FIELDS.toeimedium.fixedRatio).toBe(2.6);
    expect(SIGN_STYLE_FIELDS.toeilarge.fixedRatio).toBe(1.8);
  });

  test("trims the Metro medium white area without changing its width or band height", () => {
    expect(METRO_MEDIUM_DIMENSIONS.width).toBe(510);
    expect(METRO_MEDIUM_DIMENSIONS.height).toBe(137);
    expect(METRO_MEDIUM_DIMENSIONS.bandTop).toBe(89);
    expect(METRO_MEDIUM_DIMENSIONS.bandHeight).toBe(48);
    expect(
      METRO_MEDIUM_DIMENSIONS.height - METRO_MEDIUM_DIMENSIONS.bandTop,
    ).toBe(METRO_MEDIUM_DIMENSIONS.bandHeight);
  });

  test("new vertical layouts accept one adjacent station per side", () => {
    for (const style of ["metromedium", "toeimedium", "toeilarge"]) {
      expect(SIGN_STYLE_FIELDS[style].maxAdjacentCount).toBe(1);
      expect(SIGN_STYLE_FIELDS[style].numberPrimary).toBe("required");
      expect(SIGN_STYLE_FIELDS[style].direction).toBe("required");
    }
  });

  test("condenses long names and any name that exceeds its adjusted layout width", () => {
    expect(SUBWAY_NAME_COMPRESSION_THRESHOLD).toBe(6);
    expect(getSubwayStationNameScaleX("六文字以内駅", 180, 200)).toBe(1);
    expect(getSubwayStationNameScaleX("六文字以内駅", 300, 200)).toBeCloseTo(
      2 / 3,
    );
    expect(getSubwayStationNameScaleX("高輪ゲートウェイ", 300, 200)).toBeCloseTo(
      2 / 3,
    );
  });

  test("uses full-width spacing for two-character center names and half-width spacing for three", () => {
    expect(spaceSubwayPrimaryName("西台")).toBe("西　台");
    expect(spaceSubwayPrimaryName("日比谷")).toBe("日 比 谷");
    expect(spaceSubwayPrimaryName("飯田橋駅")).toBe("飯田橋駅");
  });

  test("matches the small Metro badge typography ratios in the medium sign", () => {
    const main = getMetroSmallBadgeTextAdjustments(34, "main");
    const side = getMetroSmallBadgeTextAdjustments(29, "side");
    expect(main.prefixFontSizeDelta).toBeLessThan(main.valueFontSizeDelta);
    expect(main.valueFontSizeDelta).toBeCloseTo((8 * 34) / (38 * 1.3));
    expect(side.prefixFontSizeDelta).toBe(0);
    expect(side.valueFontSizeDelta).toBeCloseTo((3 * 29) / (22 * 1.3));
    expect(main.valueLetterSpacing).toBeCloseTo((2 * 34) / (38 * 1.3) - 1);
    expect(side.valueLetterSpacing).toBeCloseTo((2 * 29) / (22 * 1.3) - 1);
    expect(main.valueFontStyle).toBe("bold");
    expect(side.valueFontStyle).toBe("bold");
  });
});
