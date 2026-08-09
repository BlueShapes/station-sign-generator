import { describe, expect, test } from "bun:test";
import { orderAdjacentStationIds } from "../src/components/tabs/adjacentStationOrder.ts";

describe("route-input adjacent station order", () => {
  test("can swap the outside and inside stations without changing the selection", () => {
    expect(orderAdjacentStationIds(["outer", "inner"], true)).toEqual([
      "inner",
      "outer",
    ]);
  });

  test("preserves selection order until the user reverses it", () => {
    expect(orderAdjacentStationIds(["outer", "inner"], false)).toEqual([
      "outer",
      "inner",
    ]);
    expect(orderAdjacentStationIds([], true)).toEqual([]);
    expect(orderAdjacentStationIds(["only"], true)).toEqual(["only"]);
  });
});
