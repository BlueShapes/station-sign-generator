import { describe, expect, test } from "bun:test";
import { SIGN_STYLE_FIELDS } from "../src/components/signs/signStyles.ts";
import {
  getSubwayStationNameScaleX,
  spaceToeiPrimaryName,
  spaceTokyoMetroPrimaryName,
  SUBWAY_NAME_COMPRESSION_THRESHOLD,
} from "../src/components/signs/stationNameLayout.ts";
import {
  getSubwayBadgeTextAdjustments,
  getToeiMainLayout,
  METRO_MEDIUM_DIMENSIONS,
  TOEI_BADGE_DIAMETERS,
  TOEI_JAPANESE_LETTER_SPACING,
  TOEI_MEDIUM_BADGE_NUMBER_STROKE_WIDTH,
} from "../src/components/signs/subwaySignGeometry.ts";
import { TOKYO_METRO_BADGE_NUMBER_STROKE_WIDTH } from "../src/components/signs/stationNumberBadgeMetrics.ts";

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

  test("keeps the operator-specific center-name spacing rules", () => {
    expect(spaceTokyoMetroPrimaryName("西台")).toBe("西　台");
    expect(spaceTokyoMetroPrimaryName("日比谷")).toBe("日 比 谷");
    expect(spaceTokyoMetroPrimaryName("飯田橋駅")).toBe("飯田橋駅");

    expect(spaceToeiPrimaryName("西台")).toBe("西　台");
    expect(spaceToeiPrimaryName("日比谷")).toBe("日比谷");
    expect(spaceToeiPrimaryName("飯田橋駅")).toBe("飯田橋駅");
  });

  test("matches the small Metro badge typography ratios in the medium sign", () => {
    const main = getSubwayBadgeTextAdjustments(34, "main");
    const side = getSubwayBadgeTextAdjustments(29, "side");
    expect(main.prefixFontSizeDelta).toBeLessThan(main.valueFontSizeDelta);
    expect(main.valueFontSizeDelta).toBeCloseTo((8 * 34) / (38 * 1.3));
    expect(side.prefixFontSizeDelta).toBe(0);
    expect(side.valueFontSizeDelta).toBeCloseTo((3 * 29) / (22 * 1.3));
    expect(main.valueLetterSpacing).toBeCloseTo((2 * 34) / (38 * 1.3) - 1);
    expect(side.valueLetterSpacing).toBeCloseTo((2 * 29) / (22 * 1.3) - 1);
    expect(main.valueFontStyle).toBe("bold");
    expect(side.valueFontStyle).toBe("bold");
  });

  test("centers Toei names independently and places the badge left and lower", () => {
    const centered = getToeiMainLayout({
      width: 494,
      renderedMainNameWidth: 180,
      secondaryNameWidth: 160,
      badgeOuter: 46,
      large: false,
    });
    expect(centered.textCenterX).toBe(247);
    expect(centered.badgeGap).toBe(10);
    expect(centered.badgeCx + 23 + centered.badgeGap).toBe(157);
    expect(centered.badgeCyOffset).toBeGreaterThan(42 / 2);

    const longSecondary = getToeiMainLayout({
      width: 494,
      renderedMainNameWidth: 180,
      secondaryNameWidth: 300,
      badgeOuter: 46,
      large: false,
    });
    expect(longSecondary.textCenterX).toBeLessThan(247);
    expect(longSecondary.textCenterX).toBeGreaterThanOrEqual(247 - 8);

    const large = getToeiMainLayout({
      width: 494,
      renderedMainNameWidth: 180,
      secondaryNameWidth: 160,
      badgeOuter: 46,
      large: true,
    });
    expect(large.badgeGap).toBe(8);
  });

  test("uses larger station-number badges only in the Toei medium sign", () => {
    expect(TOEI_BADGE_DIAMETERS.medium.main).toBe(55);
    expect(TOEI_BADGE_DIAMETERS.medium.side).toBe(35);
    expect(TOEI_BADGE_DIAMETERS.medium.main).toBeGreaterThan(
      TOEI_BADGE_DIAMETERS.large.main,
    );
    expect(TOEI_BADGE_DIAMETERS.medium.side).toBeGreaterThan(
      TOEI_BADGE_DIAMETERS.large.side,
    );
  });

  test("adds subtle letter spacing to Toei Japanese names and readings", () => {
    expect(TOEI_JAPANESE_LETTER_SPACING).toBeGreaterThanOrEqual(1);
    expect(TOEI_JAPANESE_LETTER_SPACING).toBeLessThanOrEqual(2);
  });

  test("adds a subtle number-only weight boost to Toei medium badges", () => {
    expect(TOEI_MEDIUM_BADGE_NUMBER_STROKE_WIDTH).toBeGreaterThan(0);
    expect(TOEI_MEDIUM_BADGE_NUMBER_STROKE_WIDTH).toBeLessThanOrEqual(1);
  });

  test("adds a subtle number-only weight boost to all Tokyo Metro badges", () => {
    expect(TOKYO_METRO_BADGE_NUMBER_STROKE_WIDTH).toBeGreaterThan(0);
    expect(TOKYO_METRO_BADGE_NUMBER_STROKE_WIDTH).toBeLessThanOrEqual(1);
  });
});
