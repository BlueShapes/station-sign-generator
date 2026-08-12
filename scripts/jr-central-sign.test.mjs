import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getJrCentralStationNumberBadgeMetrics } from "../src/components/signs/jrCentralStationNumberBadgeMetrics.ts";
import {
  formatJrCentralJapaneseName,
  getJrCentralAdjacentLabels,
  getJrCentralHiraganaScaleX,
  getJrCentralMainReadingTransform,
  getJrCentralMainNameLayout,
  JR_CENTRAL_JAPANESE_SCALE_X,
  JR_CENTRAL_LONG_READING_SCALE_Y,
  JR_CENTRAL_LAYOUT,
  JR_CENTRAL_SIGN_HEIGHT,
  JR_CENTRAL_SIGN_RATIO,
  JR_CENTRAL_SIGN_WIDTH,
  resolveJrCentralColors,
} from "../src/components/signs/jrCentralSignLayout.ts";

describe("JR Central sign layout", () => {
  test("matches the aspect ratio and vertical hierarchy of the reference", () => {
    expect(JR_CENTRAL_SIGN_RATIO).toBeCloseTo(
      JR_CENTRAL_SIGN_WIDTH / JR_CENTRAL_SIGN_HEIGHT,
      8,
    );
    expect(JR_CENTRAL_SIGN_HEIGHT).toBeLessThan(140);
    expect(JR_CENTRAL_JAPANESE_SCALE_X).toBeCloseTo(1.2);
    expect(JR_CENTRAL_LAYOUT.badge.y).toBe(37);
    expect(JR_CENTRAL_LAYOUT.bandTextOffsetY).toBe(1.5);
    expect(JR_CENTRAL_LAYOUT.mainKanji).toEqual({
      y: 52,
      maxFontSize: 19,
      minFontSize: 11.5,
    });
    expect(JR_CENTRAL_LAYOUT.adjacent).toMatchObject({
      englishMaxFontSize: 10,
      englishMinFontSize: 7,
      englishFontStyle: "400",
    });
    expect(JR_CENTRAL_LAYOUT.note).toMatchObject({
      widthRatio: 0.42,
      y: 98,
      scaleX: 1.1,
    });
    expect(JR_CENTRAL_LAYOUT.bandY).toBeLessThan(
      JR_CENTRAL_LAYOUT.adjacent.japaneseY,
    );
    expect(
      JR_CENTRAL_LAYOUT.badge.y + JR_CENTRAL_LAYOUT.badge.height,
    ).toBeLessThanOrEqual(JR_CENTRAL_LAYOUT.bandY);
  });

  test("spaces two- and three-character Japanese station names", () => {
    expect(formatJrCentralJapaneseName("六合")).toBe("六　　合");
    expect(formatJrCentralJapaneseName("つる")).toBe("つ　　る");
    expect(formatJrCentralJapaneseName("なごや")).toBe("な ご や");
    expect(formatJrCentralJapaneseName("高輪ゲートウェイ")).toBe(
      "高輪ゲートウェイ",
    );
  });

  test("centers both main-name rows on the whole image", () => {
    const width = 576;
    const layout = getJrCentralMainNameLayout(width, true);
    expect(layout.x + layout.width / 2).toBe(width / 2);
    expect(layout.maxTextWidth).toBeLessThan(layout.width);
  });

  test("stretches hiragana only when the displayed name is six characters or fewer", () => {
    expect(getJrCentralHiraganaScaleX("あいうえおか")).toBe(1.2);
    expect(getJrCentralHiraganaScaleX("あいうえおかき")).toBe(1);
    expect(getJrCentralHiraganaScaleX("な ご や")).toBe(1.2);
  });

  test("vertically stretches main readings of six or more characters without changing their rendered height", () => {
    expect(getJrCentralMainReadingTransform("あいうえお")).toEqual({
      scaleX: 1.2,
      scaleY: 1,
      fontSizeMultiplier: 1,
    });

    const longReading = getJrCentralMainReadingTransform("あいうえおか");
    expect(longReading.scaleX).toBe(1);
    expect(longReading.scaleY).toBe(JR_CENTRAL_LONG_READING_SCALE_Y);
    expect(longReading.scaleY * longReading.fontSizeMultiplier).toBeCloseTo(1);

    const extraLongReading = getJrCentralMainReadingTransform(
      "あいうえおかきくけこ",
      1.75,
    );
    expect(extraLongReading.scaleY).toBe(1.75);
    expect(
      39 *
        extraLongReading.fontSizeMultiplier *
        extraLongReading.scaleY,
    ).toBeCloseTo(39);
  });

  test("uses the company color for the band and the numbered line color for the badge", () => {
    expect(
      resolveJrCentralColors({
        companyColor: "#f15a24",
        numberPrefix: "CA",
        lines: [
          { prefix: "CB", color: "#6f2c91" },
          { prefix: "CA", color: "#f77321" },
        ],
      }),
    ).toEqual({
      bandColor: "#f15a24",
      badgeColor: "#f77321",
    });
  });

  test("uses readings for adjacent stations with a kanji fallback", () => {
    expect(
      getJrCentralAdjacentLabels([
        {
          primaryName: "藤枝",
          primaryNameFurigana: "ふじえだ",
          secondaryName: "Fujieda",
        },
        {
          primaryName: "焼津",
          primaryNameFurigana: "",
          secondaryName: "Yaizu",
        },
      ]),
    ).toEqual({
      japanese: "ふじえだ・焼　　津",
      english: "Fujieda / Yaizu",
    });
  });

  test("shares square badge metrics between signs and route maps", () => {
    const metrics = getJrCentralStationNumberBadgeMetrics(35);
    expect(metrics).toMatchObject({
      width: 35,
      height: 35,
      headerHeight: 14,
    });
    expect(metrics.strokeWidth).toBeCloseTo(1.61, 8);
    expect(metrics.prefixFontSize).toBeCloseTo(12.25, 8);
    expect(metrics.prefixY).toBeCloseTo(1.4, 8);
    expect(metrics.valueFontSize).toBeCloseTo(22.05, 8);
    expect(metrics.valueY).toBeCloseTo(13.65, 8);
    expect(JR_CENTRAL_LAYOUT.stationArea.y).toBeLessThan(
      JR_CENTRAL_LAYOUT.badge.y,
    );
  });

  test("uses the shared badge renderer in both output surfaces", () => {
    const signSource = readFileSync(
      new URL("../src/components/signs/JrCentralSign.tsx", import.meta.url),
      "utf8",
    );
    const mapSource = readFileSync(
      new URL("../src/components/signs/LineMapRenderer.tsx", import.meta.url),
      "utf8",
    );
    expect(signSource).toContain("<StationNumberBadge");
    expect(mapSource).toContain("<JrCentralStationNumberBadge");
    expect(signSource).not.toContain("direction");
  });
});
