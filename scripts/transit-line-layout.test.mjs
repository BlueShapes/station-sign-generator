import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales";
import {
  TRANSIT_GROUP_GAP,
  TRANSIT_DIAGONAL_TEXT_GAP,
  TRANSIT_ICON_SIZE,
  TRANSIT_ITEM_GAP,
  TRANSIT_NAME_FONT,
  TRANSIT_SECONDARY_NAME_FONT,
  isTransitSecondaryNameExportTooSmall,
  layoutDiagonalTransitLines,
  layoutHorizontalStationDetails,
  layoutHorizontalTransitLines,
  layoutVerticalStationDetails,
  oppositeVerticalDirection,
  shouldRotateVerticalGlyph,
} from "../src/components/signs/transitLineLayout";
import {
  getLineIndicatorShape,
  getLineIndicatorVisualStyle,
  shouldShowLineIndicatorBadge,
} from "../src/components/signs/lineIndicatorStyle";
import {
  ceilCanvasDimensions,
  DEFAULT_TRACK_WIDTH,
  MAX_TRACK_WIDTH,
  MIN_TRACK_WIDTH,
  getFadeDotSpacing,
  getServiceTrackGap,
  getServiceTrackWidth,
  getSegmentedTrackEndCaps,
  getSegmentedTrackRuns,
  getConnectedMarkerExtraExtent,
  layoutConnectedMarkers,
  layoutExpandedLinearStations,
  normalizeTrackWidth,
  shouldExpandStationNumberGroups,
} from "../src/components/signs/lineMapGeometry";

describe("transit line layout", () => {
  test("rounds canvas dimensions up so fractional pixels become padding", () => {
    expect(ceilCanvasDimensions(1750, 325.64563306743423)).toEqual({
      w: 1750,
      h: 326,
    });
  });

  test("keeps transfer icons visually subordinate to station-number badges", () => {
    expect(TRANSIT_ICON_SIZE).toBe(9);
    expect(TRANSIT_SECONDARY_NAME_FONT).toBeLessThan(5);
  });

  test("warns when the exported secondary transfer name would be unreadable", () => {
    expect(isTransitSecondaryNameExportTooSmall(2)).toBe(true);
    expect(isTransitSecondaryNameExportTooSmall(4)).toBe(false);
  });

  test("supports a route band wide enough to contain exchange markers", () => {
    expect(normalizeTrackWidth()).toBe(DEFAULT_TRACK_WIDTH);
    expect(normalizeTrackWidth(0)).toBe(MIN_TRACK_WIDTH);
    expect(normalizeTrackWidth(999)).toBe(MAX_TRACK_WIDTH);
    expect(MAX_TRACK_WIDTH / 2).toBeGreaterThan(10 + 1.5);
    expect(getServiceTrackWidth(MAX_TRACK_WIDTH)).toBe(20);
    expect(getServiceTrackGap(MAX_TRACK_WIDTH)).toBeGreaterThan(20);
  });

  test("keeps whitespace between fade dots when the route is thick", () => {
    expect(getFadeDotSpacing(DEFAULT_TRACK_WIDTH)).toBe(10);
    expect(getFadeDotSpacing(MAX_TRACK_WIDTH)).toBe(34);
    expect(getFadeDotSpacing(MAX_TRACK_WIDTH) - MAX_TRACK_WIDTH).toBe(4);
    expect(getFadeDotSpacing(20)).toBe(24);
  });

  test("rounds both ends of horizontal and vertical segmented tracks", () => {
    expect(
      getSegmentedTrackEndCaps(
        [
          { x: 10, y: 20 },
          { x: 50, y: 20 },
          { x: 90, y: 20 },
        ],
        ["#ff0000", "#0000ff"],
        30,
      ),
    ).toEqual([
      { x: 10, y: 20, color: "#ff0000", radius: 15 },
      { x: 90, y: 20, color: "#0000ff", radius: 15 },
    ]);
    expect(
      getSegmentedTrackEndCaps(
        [
          { x: 20, y: 10 },
          { x: 20, y: 90 },
        ],
        ["#00aa00"],
        12,
      ),
    ).toEqual([
      { x: 20, y: 10, color: "#00aa00", radius: 6 },
      { x: 20, y: 90, color: "#00aa00", radius: 6 },
    ]);
  });

  test("merges consecutive same-colour track edges to avoid canvas seams", () => {
    const points = [
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 70, y: 20 },
      { x: 100, y: 20 },
    ];

    expect(
      getSegmentedTrackRuns(points, ["#55aaff", "#55AAFF", "#ff0000"]),
    ).toEqual([
      {
        color: "#55aaff",
        points: [points[0], points[1], points[2]],
      },
      {
        color: "#ff0000",
        points: [points[2], points[3]],
      },
    ]);
  });

  test("expands only the gaps beside an oversized connected marker", () => {
    expect(getConnectedMarkerExtraExtent([])).toBe(0);
    expect(getConnectedMarkerExtraExtent([23])).toBe(0);
    expect(getConnectedMarkerExtraExtent([23, 23])).toBe(23);
    expect(layoutExpandedLinearStations(75, [0, 0, 0])).toEqual({
      positions: [0, 75, 150],
      extent: 150,
    });
    expect(layoutExpandedLinearStations(75, [0, 23, 0])).toEqual({
      positions: [0, 86.5, 173],
      extent: 173,
    });
    expect(layoutExpandedLinearStations(30, [0, 23, 0])).toEqual({
      positions: [0, 41.5, 83],
      extent: 83,
    });
  });

  test("expands badge groups only when neighbouring badges share their row", () => {
    expect(shouldExpandStationNumberGroups("dot", "horizontal", "normal"))
      .toBe(true);
    expect(shouldExpandStationNumberGroups("dot", "vertical", "normal"))
      .toBe(true);
    expect(shouldExpandStationNumberGroups("badge", "horizontal", "above"))
      .toBe(true);
    expect(shouldExpandStationNumberGroups("badge", "horizontal", "below"))
      .toBe(true);
    expect(shouldExpandStationNumberGroups("badge", "horizontal", "normal"))
      .toBe(false);
    expect(shouldExpandStationNumberGroups("badge", "vertical", "normal"))
      .toBe(false);
    expect(shouldExpandStationNumberGroups("none", "horizontal", "above"))
      .toBe(false);
  });

  test("joins stroked markers without overlapping their outer edges", () => {
    const layout = layoutConnectedMarkers([23, 23], [1, 1.5]);
    expect(layout).toEqual({ positions: [0, 25.5], extent: 48.5 });
    const firstOuterEdge = layout.positions[0] + 23 + 1;
    const secondOuterEdge = layout.positions[1] - 1.5;
    expect(firstOuterEdge).toBe(secondOuterEdge);
  });

  test("uses company-specific badge shapes with a safe fallback", () => {
    expect(getLineIndicatorShape("tokyometro")).toBe("circle");
    expect(getLineIndicatorShape("jreast")).toBe("rounded-square");
    expect(getLineIndicatorShape("future-company-style")).toBe(
      "rounded-square",
    );
    expect(getLineIndicatorVisualStyle("tokyometro").strokeScale).toBe(1.5);
  });

  test("shows a line-title badge for every company style when a prefix exists", () => {
    expect(shouldShowLineIndicatorBadge("JY")).toBe(true);
    expect(shouldShowLineIndicatorBadge("M")).toBe(true);
    expect(shouldShowLineIndicatorBadge("  A  ")).toBe(true);
    expect(shouldShowLineIndicatorBadge("   ")).toBe(false);
    expect(shouldShowLineIndicatorBadge(null)).toBe(false);
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

  test("places horizontal transfer lines outside the station-name block", () => {
    const above = layoutHorizontalStationDetails(
      "above",
      100,
      8,
      9,
      6,
      20,
    );
    const below = layoutHorizontalStationDetails(
      "below",
      100,
      6,
      9,
      6,
      20,
    );

    expect(above).toEqual({
      primaryNameY: 75,
      secondaryNameY: 86,
      transitY: 51,
    });
    expect(above.transitY + 20).toBeLessThan(above.primaryNameY);
    expect(below).toEqual({
      primaryNameY: 114,
      secondaryNameY: 106,
      transitY: 127,
    });
    expect(below.transitY).toBeGreaterThan(below.primaryNameY + 9);
  });

  test("places vertical transfer lines outside the station-name block", () => {
    const right = layoutVerticalStationDetails(
      "right",
      60,
      20,
      50,
      true,
    );
    const left = layoutVerticalStationDetails("left", 140, 20, 50, true);

    expect(right).toEqual({
      badgeX: 60,
      nameX: 84,
      transitAnchorX: 140,
    });
    expect(left).toEqual({
      badgeX: 120,
      nameX: 66,
      transitAnchorX: 60,
    });
    expect(right.transitAnchorX).toBeGreaterThan(right.nameX);
    expect(left.transitAnchorX).toBeLessThan(left.nameX);

    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );
    expect(source.match(/layoutVerticalStationDetails\(/g)?.length).toBe(3);
  });

  test("stacks vertical-writing transfers on one station axis", () => {
    const above = layoutDiagonalTransitLines([10, 20, 30, 40], "above");
    const below = layoutDiagonalTransitLines([10, 20, 30, 40], "below");
    const itemStep = Math.max(
      TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP,
      Math.ceil(
        (TRANSIT_NAME_FONT + TRANSIT_DIAGONAL_TEXT_GAP) * Math.SQRT2,
      ),
    );

    expect(above.items.map((item) => item.x)).toEqual([0, 0, 0, 0]);
    expect(below.items.map((item) => item.x)).toEqual([0, 0, 0, 0]);
    expect(above.items.map((item) => item.y)).toEqual([
      -TRANSIT_ICON_SIZE,
      -TRANSIT_ICON_SIZE - itemStep,
      -TRANSIT_ICON_SIZE - 2 * itemStep,
      -TRANSIT_ICON_SIZE - 3 * itemStep,
    ]);
    expect(below.items.map((item) => item.y)).toEqual([
      0,
      itemStep,
      2 * itemStep,
      3 * itemStep,
    ]);
    expect(above.width).toBeGreaterThan(TRANSIT_ICON_SIZE);
    expect(above.height).toBeGreaterThan(4 * TRANSIT_ICON_SIZE);
  });

  test("adds diagonal clearance between bilingual transfer names", () => {
    const bilingualNameHeight = 9;
    const layout = layoutDiagonalTransitLines(
      [40, 50, 60],
      "below",
      [bilingualNameHeight, bilingualNameHeight, bilingualNameHeight],
    );
    const itemStep = layout.items[1].y - layout.items[0].y;
    const expectedItemStep = Math.ceil(
      (bilingualNameHeight + TRANSIT_DIAGONAL_TEXT_GAP) * Math.SQRT2,
    );

    expect(itemStep).toBe(expectedItemStep);
    expect(layout.items.map((item) => item.y)).toEqual([
      0,
      expectedItemStep,
      2 * expectedItemStep,
    ]);
    expect(itemStep * Math.SQRT1_2).toBeGreaterThanOrEqual(
      bilingualNameHeight + TRANSIT_DIAGONAL_TEXT_GAP,
    );
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
    expect(source).toContain(
      "const [mapShowTransitNames, setMapShowTransitNames] = useState(true);",
    );
    expect(source).toContain(
      "const [mapStationSpacing, setMapStationSpacing] = useState(75);",
    );
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
    expect(source).toContain("line.secondary_name?.trim()");
    expect(source).toContain("y={itemY + TRANSIT_ICON_SIZE}");
  });

  test("shows a localized warning on low-resolution map downloads", () => {
    const source = readFileSync(
      "src/components/tabs/RouteInputTab.tsx",
      "utf8",
    );

    expect(source).toContain("mapDownloadTextTooSmall");
    expect(source).toContain("mapDownloadWarningText");
    expect(source).toContain("disabled={!mapDownloadWarningText}");
    expect(source).toContain("fullWidth");
    expect(source).toContain('{t("input.save")}');
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      );
      expect(messages.route?.linemap?.["download-text-warning"]).toBeTruthy();
    }
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

  test("keeps station-number appearances distinct with multiple services", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );
    const horizontal = source.slice(
      source.indexOf("Multi-service horizontal layout"),
      source.indexOf("Multi-service vertical layout"),
    );
    const vertical = source.slice(
      source.indexOf("Multi-service vertical layout"),
    );

    for (const layout of [horizontal, vertical]) {
      expect(layout).toContain(
        "const stationNumberGroup = getStationNumbers(station.id);",
      );
      expect(layout).toContain("<StationNumberBadgeGroup");
      expect(layout).toContain("numbers={stationNumberGroup}");
      expect(layout).toContain("fallbackColor={stationColor}");
    }
    expect(horizontal).toContain('orientation="horizontal"');
    expect(vertical).toContain('orientation="vertical"');
  });
});
