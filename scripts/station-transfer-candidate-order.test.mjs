import { describe, expect, test } from "bun:test";
import {
  getStationNameSimilarity,
  sortStationTransferCandidates,
} from "../src/components/tabs/stationTransferCandidateOrder.ts";

const candidate = (id, name, stationNumber, routeOrder) => ({
  id,
  name,
  stationNumber,
  routeOrder,
});

describe("station transfer candidate order", () => {
  test("prioritizes a station name contained in the current station name", () => {
    const sorted = sortStationTransferCandidates("京成上野", [
      candidate("ks01", "京成上野", "01", 0),
      candidate("ks02", "日暮里", "02", 1),
      candidate("g16", "稲荷町", "16", 15),
      candidate("g17", "上野", "17", 16),
    ]);

    expect(sorted.map(({ id }) => id)).toEqual([
      "ks01",
      "g17",
      "ks02",
      "g16",
    ]);
  });

  test("applies containment in either direction", () => {
    expect(getStationNameSimilarity("上野", "京成上野")).toBeGreaterThan(0);
    expect(getStationNameSimilarity("京成上野", "上野")).toBeGreaterThan(0);
  });

  test("orders unrelated stations by their natural station number", () => {
    const sorted = sortStationTransferCandidates("上野", [
      candidate("third", "青砥", "KS09", 8),
      candidate("first", "押上", "KS45", 44),
      candidate("second", "高砂", "KS10", 9),
    ]);

    expect(sorted.map(({ id }) => id)).toEqual(["third", "second", "first"]);
  });

  test("falls back to route order when station numbers are unavailable", () => {
    const sorted = sortStationTransferCandidates("上野", [
      candidate("second", "乙駅", null, 2),
      candidate("first", "甲駅", null, 1),
    ]);

    expect(sorted.map(({ id }) => id)).toEqual(["first", "second"]);
  });
});
