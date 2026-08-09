import { describe, expect, test } from "bun:test";
import {
  getJrEastLineArrowPoints,
  getJrWestArrowPoints,
  getMetroSmallArrowPoints,
  getSubwayMediumArrowPoints,
} from "../src/components/signs/arrowGeometry.ts";

const toVertices = (points) =>
  Array.from({ length: points.length / 2 }, (_, index) => [
    points[index * 2],
    points[index * 2 + 1],
  ]);

const variants = [
  {
    name: "Tokyo Metro small",
    width: 34,
    height: 34,
    getPoints: (direction) => getMetroSmallArrowPoints(34, direction),
  },
  {
    name: "subway medium/large",
    width: 40,
    height: 25,
    getPoints: (direction) =>
      getSubwayMediumArrowPoints(40, 25, direction),
  },
  {
    name: "JR West",
    width: 24,
    height: 24,
    getPoints: (direction) => getJrWestArrowPoints(24, direction),
  },
  {
    name: "JR East line end",
    width: 25,
    height: 24,
    getPoints: (direction) =>
      getJrEastLineArrowPoints(25, 24, direction),
  },
];

describe("station sign arrow geometry", () => {
  for (const variant of variants) {
    test(`${variant.name} is vertically symmetric`, () => {
      const vertices = toVertices(variant.getPoints("right"));

      for (const [x, y] of vertices) {
        const mirroredVertex = vertices.find(
          ([candidateX, candidateY]) =>
            Math.abs(candidateX - x) < 1e-9 &&
            Math.abs(candidateY - (variant.height - y)) < 1e-9,
        );
        expect(mirroredVertex).toBeDefined();
      }
    });

    test(`${variant.name} left and right arrows are horizontal mirrors`, () => {
      const rightPoints = variant.getPoints("right");
      const leftPoints = variant.getPoints("left");

      expect(leftPoints).toHaveLength(rightPoints.length);
      for (let index = 0; index < rightPoints.length; index += 2) {
        expect(rightPoints[index] + leftPoints[index]).toBeCloseTo(
          variant.width,
        );
        expect(rightPoints[index + 1]).toBeCloseTo(leftPoints[index + 1]);
      }
    });
  }

  test("keeps the latest subway arrow proportions", () => {
    const vertices = toVertices(getSubwayMediumArrowPoints(40, 25));
    expect(vertices[0]).toEqual([17.6, 0]);
    expect(vertices[1]).toEqual([25.2, 0]);
    expect(vertices[2]).toEqual([38, 12.5]);
    expect(vertices[7]).toEqual([5, 10]);
    expect(vertices[8]).toEqual([28.4, 10]);
    expect(vertices[6][1] - vertices[7][1]).toBeCloseTo(
      vertices[5][1] - vertices[8][1],
    );
  });
});
