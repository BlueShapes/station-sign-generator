export type HorizontalArrowDirection = "left" | "right";

type Point = readonly [x: number, y: number];

type SymmetricArrowOptions = {
  width: number;
  height: number;
  direction: HorizontalArrowDirection;
  outerTop: readonly Point[];
  innerTop?: readonly Point[];
  tipX: number;
};

/**
 * Build a horizontal arrow from its upper outline only.
 *
 * The lower outline is reflected across the horizontal center line, and a
 * left-facing arrow is reflected from the generated right-facing shape.
 */
function createSymmetricHorizontalArrowPoints({
  width,
  height,
  direction,
  outerTop,
  innerTop = [],
  tipX,
}: SymmetricArrowOptions): number[] {
  const mirrorVertically = ([x, y]: Point): Point => [x, height - y];
  const lowerOuter = [...outerTop].reverse().map(mirrorVertically);
  const lowerInner = [...innerTop].reverse().map(mirrorVertically);
  const rightArrow: Point[] = [
    ...outerTop,
    [tipX, height / 2],
    ...lowerOuter,
    ...lowerInner,
    ...innerTop,
  ];

  return rightArrow.flatMap(([x, y]) => [
    direction === "left" ? width - x : x,
    y,
  ]);
}

export function getMetroSmallArrowPoints(
  size: number,
  direction: HorizontalArrowDirection = "right",
): number[] {
  return createSymmetricHorizontalArrowPoints({
    width: size,
    height: size,
    direction,
    outerTop: [
      [6, 0],
      [18, 0],
    ],
    innerTop: [
      [-9, size / 2 - 4],
      [size - 12.5, size / 2 - 4],
    ],
    tipX: size,
  });
}

export function getSubwayMediumArrowPoints(
  width: number,
  height: number,
  direction: HorizontalArrowDirection = "right",
): number[] {
  return createSymmetricHorizontalArrowPoints({
    width,
    height,
    direction,
    outerTop: [
      [width * 0.44, 0],
      [width * 0.63, 0],
    ],
    innerTop: [
      [5, height * 0.4],
      [width * 0.71, height * 0.38],
    ],
    tipX: width * 0.95,
  });
}

export function getJrWestArrowPoints(
  size: number,
  direction: HorizontalArrowDirection = "right",
): number[] {
  return createSymmetricHorizontalArrowPoints({
    width: size,
    height: size,
    direction,
    outerTop: [
      [3, 0],
      [11, 0],
    ],
    innerTop: [
      [-11, size / 2 - 2.5],
      [size - 10.5, size / 2 - 2.5],
    ],
    tipX: size,
  });
}

export function getJrEastLineArrowPoints(
  width: number,
  height: number,
  direction: HorizontalArrowDirection,
): number[] {
  return createSymmetricHorizontalArrowPoints({
    width,
    height,
    direction,
    outerTop: [[0, 0]],
    tipX: width,
  });
}
