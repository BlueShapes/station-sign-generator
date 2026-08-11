import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  applyParallelRouteLanes,
  getMultiLineLoopRadius,
  getParallelRouteIdsByStation,
  layoutCircularMultiLineMap,
  layoutMultiLineMap,
  orderParallelRouteIdsByVerticalPosition,
} from "../src/components/signs/multiLineMapLayout";
import { moveOrderedId } from "../src/components/tabs/orderedIds";

const mainStations = Array.from({ length: 25 }, (_, index) =>
  `station-m${String(index + 1).padStart(2, "0")}`
);

describe("multiple-line route map layout", () => {
  test("attaches the Marunouchi branch to shared M06 and grows it left", () => {
    const layout = layoutMultiLineMap(
      [
        {
          lineId: "line-marunouchi",
          parentLineId: null,
          stationIds: mainStations,
        },
        {
          lineId: "line-marunouchi-branch",
          parentLineId: "line-marunouchi",
          stationIds: ["station-m06", "station-mb05", "station-mb04", "station-mb03"],
        },
      ],
      "line-marunouchi",
      75,
    );

    const main = layout.paths[0];
    const branch = layout.paths[1];
    const junction = main.points.find((point) => point.stationId === "station-m06");

    expect(junction?.isJunction).toBe(true);
    expect(branch.points[0]).toMatchObject({
      stationId: "station-m06",
      x: junction?.x,
      y: junction?.y,
      isJunction: true,
    });
    expect(branch.points[1].x).toBeLessThan(branch.points[0].x);
    expect(branch.points[1].y).toBeGreaterThan(branch.points[0].y);
    expect(layout.width).toBeGreaterThan(1800);
  });

  test("keeps disconnected companion lines visible on their own row", () => {
    const layout = layoutMultiLineMap(
      [
        { lineId: "main", parentLineId: null, stationIds: ["a", "b"] },
        { lineId: "other", parentLineId: null, stationIds: ["c", "d"] },
      ],
      "main",
    );

    expect(layout.paths).toHaveLength(2);
    expect(layout.paths[1].points[0].y).toBeGreaterThan(
      layout.paths[0].points[0].y,
    );
  });

  test("moves a selected line without changing the selection", () => {
    expect(moveOrderedId(["main", "branch", "other"], 2, 0)).toEqual([
      "other",
      "main",
      "branch",
    ]);
    expect(moveOrderedId(["main", "branch"], 0, 1)).toEqual([
      "branch",
      "main",
    ]);
  });

  test("keeps the full main line when the branch is moved to the spine", () => {
    const layout = layoutMultiLineMap(
      [
        {
          lineId: "line-marunouchi-branch",
          parentLineId: "line-marunouchi",
          stationIds: ["station-m06", "station-mb05", "station-mb04", "station-mb03"],
        },
        {
          lineId: "line-marunouchi",
          parentLineId: null,
          stationIds: mainStations,
        },
      ],
      "line-marunouchi-branch",
      75,
    );

    expect(layout.paths.map((path) => path.lineId)).toEqual([
      "line-marunouchi-branch",
      "line-marunouchi",
    ]);
    expect(layout.paths[1].points).toHaveLength(25);
    expect(layout.paths[1].points[0].stationId).toBe("station-m01");
    expect(layout.paths[1].points.at(-1)?.stationId).toBe("station-m25");
  });

  test("reuses the single-line badges, transfer layout, and thick-track rules", () => {
    const renderer = readFileSync(
      "src/components/signs/MultiLineMapRenderer.tsx",
      "utf8",
    );

    expect(renderer).toContain("<LineIndicatorBadge");
    expect(renderer).toContain(
      "shouldShowLineIndicatorBadge(route.line.prefix)",
    );
    expect(renderer).not.toContain('route.companyStyle === "jreast"');
    expect(renderer).toContain("<StationNumberBadgeGroup");
    expect(renderer).toContain("<HorizontalTransitLines");
    expect(renderer).toContain("normalizeTrackWidth(trackWidth)");
    expect(renderer).toContain("getTrackEdgeRadius(");
    expect(renderer).not.toContain("XCHG_R");
    expect(renderer).toContain("const markerRadius = DOT_R");
    expect(renderer).not.toContain("function StationNumberBadge(");
    expect(renderer).not.toContain("function TransitIndicators(");
  });

  test("keeps two lanes through consecutive shared stations", () => {
    const routes = [
      { lineId: "first", parentLineId: null, stationIds: ["a", "b", "c", "d"] },
      { lineId: "second", parentLineId: null, stationIds: ["x", "b", "c", "y"] },
    ];
    const layout = applyParallelRouteLanes(
      layoutMultiLineMap(routes, "first", 75),
      routes,
      16,
    );
    const firstB = layout.paths[0].points.find((point) => point.stationId === "b");
    const secondB = layout.paths[1].points.find((point) => point.stationId === "b");
    const firstC = layout.paths[0].points.find((point) => point.stationId === "c");
    const secondC = layout.paths[1].points.find((point) => point.stationId === "c");

    expect(firstB?.x).toBe(secondB?.x);
    expect(firstC?.x).toBe(secondC?.x);
    expect(secondB.y - firstB.y).toBe(16);
    expect(secondC.y - firstC.y).toBe(16);
    expect(getParallelRouteIdsByStation(routes).get("b")).toEqual(["first", "second"]);
  });

  test("orders connected station badges to match the visible lane stack", () => {
    expect(
      orderParallelRouteIdsByVerticalPosition(
        ["line-yamanote", "line-keihin-tohoku"],
        [
          { lineId: "line-yamanote", y: 120 },
          { lineId: "line-keihin-tohoku", y: 104 },
        ],
      ),
    ).toEqual(["line-keihin-tohoku", "line-yamanote"]);
    expect(
      orderParallelRouteIdsByVerticalPosition(
        ["line-yamanote", "line-keihin-tohoku"],
        [
          { lineId: "line-yamanote", y: 104 },
          { lineId: "line-keihin-tohoku", y: 120 },
        ],
      ),
    ).toEqual(["line-yamanote", "line-keihin-tohoku"]);
  });

  test("lays a loop spine as a circle and extends both companion tails", () => {
    const yamanote = Array.from({ length: 30 }, (_, index) => `jy${index + 1}`);
    const shared = [...yamanote.slice(24), ...yamanote.slice(0, 9)];
    const keihin = ["south-1", "south-2", ...shared, "north-1", "north-2"];
    const layout = layoutCircularMultiLineMap(
      [
        { lineId: "jy", parentLineId: null, stationIds: yamanote, isLoop: true },
        { lineId: "jk", parentLineId: null, stationIds: keihin },
      ],
      "jy",
      75,
      16,
    );

    expect(layout.loopCenter).toBeDefined();
    expect(layout.paths[0].closed).toBe(true);
    expect(layout.paths[0].points).toHaveLength(30);
    expect(layout.paths[1].points).toHaveLength(19);
    const jyShared = layout.paths[0].points.find((point) => point.stationId === "jy25");
    const jkShared = layout.paths[1].points.find((point) => point.stationId === "jy25");
    expect(jyShared).not.toEqual(jkShared);
    expect(layout.width).toBeGreaterThan(760);
  });

  test("expands a loop so its chord spacing matches the station-spacing control", () => {
    const radius = getMultiLineLoopRadius(30, 75);
    const chord = 2 * radius * Math.sin(Math.PI / 30);
    expect(radius).toBeGreaterThan(350);
    expect(chord).toBeCloseTo(75, 5);
  });

  test("uses vertical connected groups so TLC badges keep independent heights", () => {
    const renderer = readFileSync(
      "src/components/signs/MultiLineMapRenderer.tsx",
      "utf8",
    );
    expect(renderer).toContain('stationRoutes.length > 1 ? "vertical" : "horizontal"');
    expect(renderer).toContain("layoutConnectedMarkers(");
    expect(renderer).toContain("stationNumberGroupDimensions(");
    expect(renderer).toContain("A three-letter code identifies the station");
    expect(renderer).toContain("sharedThreeLetterCode={");
    expect(renderer).toContain("threeLetterCode: null");
    const sharedBadgeRenderer = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );
    expect(sharedBadgeRenderer).toContain("JR East connected badges sit on one black plate");
    expect(sharedBadgeRenderer).toContain("const sharedDivider = _snStroke * badgeScale");
    expect(sharedBadgeRenderer).toContain("const sharedCodeYOffset = hasSharedThreeLetterCode");
    expect(sharedBadgeRenderer).toContain("y={y + sharedCodeYOffset + _snTrcY * badgeScale}");
    expect(sharedBadgeRenderer).toContain("dims.h + sharedDivider * 2");
    expect(sharedBadgeRenderer).toContain("sharedHeaderWidth + sharedDivider");
    expect(sharedBadgeRenderer).toContain("sharedDivider * 1.5");
    expect(sharedBadgeRenderer).toContain('fill="black"');
  });

  test("shares the single-line circular station-name spacing", () => {
    const renderer = readFileSync(
      "src/components/signs/MultiLineMapRenderer.tsx",
      "utf8",
    );
    expect(renderer).toContain("distance - markerExtent - C_TICK_LEN");
    expect(renderer).toContain("anchorX - C_LABEL_GAP");
    expect(renderer).not.toContain("CIRCULAR_STAGGER");
    expect(renderer).not.toContain("CIRCULAR_LABEL_GAP");
  });

  test("scales every multiple-line station name by 1.3", () => {
    const renderer = readFileSync(
      "src/components/signs/MultiLineMapRenderer.tsx",
      "utf8",
    );
    expect(renderer).toContain("MULTI_LINE_STATION_NAME_SCALE = 1.3");
    expect(renderer).toContain("fontSize={MULTI_LINE_JP_FONT}");
    expect(renderer).toContain("fontSize={MULTI_LINE_EN_FONT}");
    expect(renderer).not.toContain("fontSize={JP_FONT}");
    expect(renderer).not.toContain("fontSize={EN_FONT}");
  });
});
