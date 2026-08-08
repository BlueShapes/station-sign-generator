import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales";
import {
  TRANSIT_GROUP_GAP,
  TRANSIT_ICON_SIZE,
  TRANSIT_ITEM_GAP,
  layoutDiagonalTransitLines,
  layoutHorizontalTransitLines,
  oppositeVerticalDirection,
  shouldRotateVerticalGlyph,
} from "../src/components/signs/transitLineLayout";
import {
  getLineIndicatorShape,
  getLineIndicatorVisualStyle,
} from "../src/components/signs/lineIndicatorStyle";
import {
  DEFAULT_TRACK_WIDTH,
  MAX_TRACK_WIDTH,
  MIN_TRACK_WIDTH,
  getServiceTrackGap,
  getServiceTrackWidth,
  normalizeTrackWidth,
} from "../src/components/signs/lineMapGeometry";

describe("transit line layout", () => {
  test("keeps transfer icons visually subordinate to station-number badges", () => {
    expect(TRANSIT_ICON_SIZE).toBe(9);
  });

  test("supports a route band wide enough to contain exchange markers", () => {
    expect(normalizeTrackWidth()).toBe(DEFAULT_TRACK_WIDTH);
    expect(normalizeTrackWidth(0)).toBe(MIN_TRACK_WIDTH);
    expect(normalizeTrackWidth(999)).toBe(MAX_TRACK_WIDTH);
    expect(MAX_TRACK_WIDTH / 2).toBeGreaterThan(10 + 1.5);
    expect(getServiceTrackWidth(MAX_TRACK_WIDTH)).toBe(20);
    expect(getServiceTrackGap(MAX_TRACK_WIDTH)).toBeGreaterThan(20);
  });

  test("uses company-specific badge shapes with a safe fallback", () => {
    expect(getLineIndicatorShape("tokyometro")).toBe("circle");
    expect(getLineIndicatorShape("jreast")).toBe("rounded-square");
    expect(getLineIndicatorShape("future-company-style")).toBe(
      "rounded-square",
    );
    expect(getLineIndicatorVisualStyle("tokyometro").strokeScale).toBe(1.5);
  });

  test("rotates Japanese and ASCII parentheses in vertical text", () => {
    for (const character of ["（", "）", "(", ")"]) {
      expect(shouldRotateVerticalGlyph(character)).toBe(true);
    }
    expect(shouldRotateVerticalGlyph("丸")).toBe(false);
  });

  test("uses at most three rows before growing right", () => {
    const layout = layoutHorizontalTransitLines([20, 30, 40, 10], "right");

    expect(layout.items.slice(0, 3).map((item) => item.y)).toEqual([
      0,
      TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP,
      2 * (TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP),
    ]);
    expect(layout.items[3].x).toBeGreaterThan(layout.items[0].x);
    expect(layout.items[3].y).toBe(0);
  });

  test("mirrors column growth for left-side station names", () => {
    const layout = layoutHorizontalTransitLines([20, 30, 40, 10], "left");

    expect(layout.items[0].x).toBeLessThan(0);
    expect(layout.items[3].x).toBeLessThan(
      layout.items[0].x - TRANSIT_GROUP_GAP,
    );
  });

  test("stacks vertical-writing transfers on one station axis", () => {
    const above = layoutDiagonalTransitLines([10, 20, 30, 40], "above");
    const below = layoutDiagonalTransitLines([10, 20, 30, 40], "below");

    expect(above.items.map((item) => item.x)).toEqual([0, 0, 0, 0]);
    expect(below.items.map((item) => item.x)).toEqual([0, 0, 0, 0]);
    expect(above.items.map((item) => item.y)).toEqual([
      -TRANSIT_ICON_SIZE,
      -2 * TRANSIT_ICON_SIZE - TRANSIT_ITEM_GAP,
      -3 * TRANSIT_ICON_SIZE - 2 * TRANSIT_ITEM_GAP,
      -4 * TRANSIT_ICON_SIZE - 3 * TRANSIT_ITEM_GAP,
    ]);
    expect(below.items.map((item) => item.y)).toEqual([
      0,
      TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP,
      2 * (TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP),
      3 * (TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP),
    ]);
    expect(above.width).toBeGreaterThan(TRANSIT_ICON_SIZE);
    expect(above.height).toBeGreaterThan(4 * TRANSIT_ICON_SIZE);
  });

  test("places vertical-writing transfers opposite the station names", () => {
    expect(oppositeVerticalDirection("above")).toBe("below");
    expect(oppositeVerticalDirection("below")).toBe("above");
    expect(layoutDiagonalTransitLines([], "above")).toEqual({
      items: [],
      width: 0,
      height: 0,
    });
  });

  test("starts with no selected transfer lines", () => {
    const source = readFileSync("src/components/tabs/RouteInputTab.tsx", "utf8");

    expect(source).toContain(
      "const [mapTransitFilter, setMapTransitFilter] = useState<string[]>([]);",
    );
    expect(source).toContain("setMapTransitFilter([]);");
  });

  test("defines the transfer-name and line-width options in every locale", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      );
      expect(messages.route?.linemap?.["transit-show-names"]).toBeTruthy();
      expect(messages.route?.linemap?.["line-width"]).toBeTruthy();
    }
  });

  test("uses an unrounded empty square when a line has no abbreviation", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    expect(source).toContain("if (line.prefix.trim())");
    expect(source).toContain("size={TRANSIT_ICON_SIZE}");
    expect(source).toContain("cornerRadius={0}");
    expect(source).not.toContain("fill={tl.line_color}");
  });

  test("keeps multi-character line prefixes on one line", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    expect(source).toContain('wrap="none"');
    expect(source).toContain("prefixText.width() > availableTextWidth");
  });

  test("renders vertical-writing transfer names diagonally", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    expect(source).toContain("<DiagonalTransitLines");
    expect(source).toContain("? -TRANSIT_DIAGONAL_ANGLE");
    expect(source).toContain(": TRANSIT_DIAGONAL_ANGLE");
  });

  test("centers vertical transfer icons on the station axis", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    expect(source).toContain(
      "const transitAnchorX = x - TRANSIT_ICON_SIZE / 2;",
    );
    expect(source.match(/x - TRANSIT_ICON_SIZE \/ 2/g)?.length).toBe(2);
  });
});
