import { describe, expect, test } from "bun:test";
import {
  getJrEastBranchArrowColor,
  getJrEastBranchArrowPoints,
  getJrEastBranchDiagonalDistance,
  getJrEastBranchLayoutRenderKey,
  getJrEastBranchOffsets,
  getJrEastBranchPrimaryFontSize,
  getJrEastBranchSecondaryNameY,
  getJrEastBranchStartDistance,
  getJrEastBranchStationBadgeX,
  getJrEastBranchStationNameX,
  hasActiveJrEastBranches,
  JR_EAST_BRANCH_LAYOUT,
} from "../src/components/signs/jrEastBranchLayout.ts";

describe("JR East branch sign layout", () => {
  test("places one, two, and three branches symmetrically", () => {
    expect(getJrEastBranchOffsets(1)).toEqual([0]);
    expect(getJrEastBranchOffsets(2)).toEqual([-20, 20]);
    expect(getJrEastBranchOffsets(3)).toEqual([-38, 0, 38]);
  });

  test("only enables center content adjustments for an actual branch", () => {
    expect(hasActiveJrEastBranches(true, 2, 1)).toBe(true);
    expect(hasActiveJrEastBranches(true, 1, 3)).toBe(true);
    expect(hasActiveJrEastBranches(true, 1, 1)).toBe(false);
    expect(hasActiveJrEastBranches(false, 2, 2)).toBe(false);
  });

  test("keeps the main badge fixed above the lowered center text", () => {
    expect(Number.isFinite(JR_EAST_BRANCH_LAYOUT.centerBadgeYOffset)).toBe(true);
    expect(Number.isFinite(JR_EAST_BRANCH_LAYOUT.centerTextYOffset)).toBe(true);
  });

  test("moves travel branch names outward and aligns their outer edges", () => {
    expect(getJrEastBranchStationNameX("left", "primary", true)).toBe(45);
    expect(getJrEastBranchStationNameX("left", "secondary", true)).toBe(45);
    expect(getJrEastBranchStationNameX("right", "primary", true)).toBe(-45);
    expect(getJrEastBranchStationNameX("right", "secondary", true)).toBe(-45);
    expect(getJrEastBranchStationNameX("left", "primary", false)).toBe(60);
  });

  test("places travel badges outside the foreign name with fixed gaps", () => {
    const width = 490;

    expect(getJrEastBranchStationBadgeX("left", width, "primary", true)).toBe(
      25,
    );
    expect(
      getJrEastBranchStationBadgeX("left", width, "secondary", true),
    ).toBe(5);
    expect(getJrEastBranchStationBadgeX("right", width, "primary", true)).toBe(
      width - 40,
    );
    expect(
      getJrEastBranchStationBadgeX("right", width, "secondary", true),
    ).toBe(width - 20);
  });

  test("vertically centers the first foreign name with a travel badge", () => {
    const targetY = 68;
    const lineHeight = JR_EAST_BRANCH_LAYOUT.branchLineHeight;
    const badgeY = targetY + lineHeight / 2 + 3;
    const secondaryY = getJrEastBranchSecondaryNameY(
      targetY,
      lineHeight,
      true,
    );

    expect(secondaryY + 11 / 2).toBe(badgeY + 15 / 2);
    expect(getJrEastBranchSecondaryNameY(targetY, lineHeight, false)).toBe(
      targetY + lineHeight / 2 + 2,
    );
  });

  test("shrinks two travel branches and matches non-travel text at three", () => {
    const nonTravelSize = getJrEastBranchPrimaryFontSize(1, false);

    expect(getJrEastBranchPrimaryFontSize(1, true)).toBe(18);
    expect(getJrEastBranchPrimaryFontSize(2, true)).toBe(16);
    expect(getJrEastBranchPrimaryFontSize(3, true)).toBe(nonTravelSize);
  });

  test("uses company colors for arrows and falls back to the current company", () => {
    expect(getJrEastBranchArrowColor("#ed7500", "#237500")).toBe("#ed7500");
    expect(getJrEastBranchArrowColor(undefined, "#237500")).toBe("#237500");
  });

  test("keeps a full-width trunk before the thinner branches spread", () => {
    const expectedStart = (width) =>
      Math.max(
        JR_EAST_BRANCH_LAYOUT.branchStartMinDistance,
        width * JR_EAST_BRANCH_LAYOUT.branchStartRatio,
      );
    const expectedDiagonal = (width) =>
      Math.max(
        JR_EAST_BRANCH_LAYOUT.branchDiagonalMinDistance,
        width * JR_EAST_BRANCH_LAYOUT.branchDiagonalRatio,
      );

    expect(getJrEastBranchStartDistance(490)).toBeCloseTo(expectedStart(490));
    expect(getJrEastBranchDiagonalDistance(490)).toBeCloseTo(
      expectedDiagonal(490),
    );
    expect(getJrEastBranchStartDistance(300)).toBeCloseTo(expectedStart(300));
    expect(getJrEastBranchDiagonalDistance(300)).toBeCloseTo(
      expectedDiagonal(300),
    );
  });

  test("exposes every tuning value through the hot-reload render key", () => {
    const renderKey = getJrEastBranchLayoutRenderKey();

    expect(renderKey).toContain("18:16:15");
    expect(renderKey.split(":")).toHaveLength(
      Object.keys(JR_EAST_BRANCH_LAYOUT).length,
    );
  });

  test("left and right branch arrows are horizontal mirrors", () => {
    const options = {
      width: 760,
      centerX: 380,
      centerY: 100,
      targetY: 48,
      lineHeight: 22,
    };
    const right = getJrEastBranchArrowPoints({ ...options, side: "right" });
    const left = getJrEastBranchArrowPoints({ ...options, side: "left" });

    expect(left).toHaveLength(right.length);
    for (let index = 0; index < right.length; index += 2) {
      expect(left[index] + right[index]).toBeCloseTo(options.width);
      expect(left[index + 1]).toBeCloseTo(right[index + 1]);
    }
  });

  test("extends non-travel lines flat to the sign edge", () => {
    const width = 760;
    const points = getJrEastBranchArrowPoints({
      side: "right",
      width,
      centerX: width / 2,
      centerY: 88,
      targetY: 68,
      lineHeight: 16,
      showArrowhead: false,
    });
    const vertices = Array.from(
      { length: points.length / 2 },
      (_, index) => [points[index * 2], points[index * 2 + 1]],
    );

    expect(vertices.filter(([x]) => x === width)).toHaveLength(2);
    expect(vertices).not.toContainEqual([width, 68]);
  });

  test("makes the diagonal thicker than the horizontal branch", () => {
    const centerX = 380;
    const centerY = 88;
    const branchStartDistance = 80;
    const points = getJrEastBranchArrowPoints({
      side: "right",
      width: 760,
      centerX,
      centerY,
      targetY: 68,
      lineHeight: 16,
      diagonalLineHeight: 20,
      branchStartDistance,
    });

    expect(points[1]).toBe(centerY - 10);
    expect(points.at(-1)).toBe(centerY + 10);
    expect(points[3]).toBe(68 - 8);
  });
});
