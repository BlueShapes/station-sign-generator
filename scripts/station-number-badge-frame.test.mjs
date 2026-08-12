import { describe, expect, test } from "bun:test";
import { getJrEastStationNumberBadgeFrameMetrics } from "../src/components/signs/stationNumberBadgeFrame.ts";

describe("JR East station-number badge frame", () => {
  test("preserves the historical 30-unit frame geometry", () => {
    const metrics = getJrEastStationNumberBadgeFrameMetrics(30);

    expect(metrics.outerPaddingX).toBe(3);
    expect(metrics.outerYOffset).toBe(-1);
    expect(metrics.outerHeight).toBe(45);
    expect(metrics.headerHeight).toBe(12);
    expect(metrics.innerYOffset).toBe(11);
    expect(metrics.strokeWidth).toBe(3);
    expect(metrics.connectedBadgeStep).toBe(36);
  });

  test("scales the complete frame proportionally", () => {
    const metrics = getJrEastStationNumberBadgeFrameMetrics(15);

    expect(metrics.outerPaddingX).toBe(1.5);
    expect(metrics.outerHeight).toBe(22.5);
    expect(metrics.strokeWidth).toBe(1.5);
    expect(metrics.connectedBadgeStep).toBe(18);
  });
});
