import { describe, expect, test } from "bun:test";
import { getJrEastAdjacentNumberBadgeX } from "../src/components/signs/jrEastAdjacentNumberBadgeLayout.ts";

describe("standard JR East adjacent station-number badges", () => {
  test("places three badges outward from each adjacent station name", () => {
    const width = 490;

    expect(
      [0, 1, 2].map((slot) =>
        getJrEastAdjacentNumberBadgeX("left", width, slot),
      ),
    ).toEqual([44, 24, 4]);
    expect(
      [0, 1, 2].map((slot) =>
        getJrEastAdjacentNumberBadgeX("right", width, slot),
      ),
    ).toEqual([width - 60, width - 40, width - 20]);
  });
});
