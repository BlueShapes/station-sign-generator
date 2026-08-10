export type BranchSide = "left" | "right";

/** Visual tuning values for the JR East branching layout. */
export const JR_EAST_BRANCH_LAYOUT = {
  singleTravelFontSize: 18,
  twoBranchTravelFontSize: 16,
  nonTravelFontSize: 15,
  twoBranchOffset: 20,
  threeBranchOffset: 38,
  mainLineHeight: 24,
  branchLineHeight: 18,
  branchDiagonalLineHeight: 23,
  threeBranchDiagonalLineHeight: 27,
  threeBranchCenterArrowOverlap: 2,
  threeBranchHeightIncrease: 20,
  centerSquareSize: 25,
  threeBranchCenterSquareSize: 19,
  branchStartRatio: 0.22,
  branchStartMinDistance: 55,
  branchDiagonalRatio: 0.04,
  branchDiagonalMinDistance: 26,
  centerBadgeYOffset: -6,
  centerTextYOffset: -6,
  furiganaFontSize: 15,
  travelTextOutwardShift: 15,
  travelSecondaryCenterAdjustment: 3,
  travelTextBadgeGap: 5,
  adjacentBadgeSize: 15,
  adjacentBadgeGap: 5,
} as const;

/**
 * Changes whenever a layout tuning value changes. Passing this through the
 * renderer makes Vite HMR regenerate the PNG-backed preview without a restart.
 */
export function getJrEastBranchLayoutRenderKey(): string {
  return Object.values(JR_EAST_BRANCH_LAYOUT).join(":");
}

export function getJrEastBranchOffsets(branchCount: number): number[] {
  if (branchCount <= 1) return [0];
  if (branchCount === 2) {
    return [
      -JR_EAST_BRANCH_LAYOUT.twoBranchOffset,
      JR_EAST_BRANCH_LAYOUT.twoBranchOffset,
    ];
  }
  return [
    -JR_EAST_BRANCH_LAYOUT.threeBranchOffset,
    0,
    JR_EAST_BRANCH_LAYOUT.threeBranchOffset,
  ];
}

export function getJrEastBranchRenderOrder(branchCount: number): number[] {
  if (branchCount >= 3) return [2, 0, 1];
  if (branchCount === 2) return [1, 0];
  return Array.from({ length: branchCount }, (_, index) => index);
}

export function hasActiveJrEastBranches(
  branchMode: boolean,
  leftCount: number,
  rightCount: number,
): boolean {
  return branchMode && (leftCount > 1 || rightCount > 1);
}

export function hasThreeJrEastBranches(
  branchMode: boolean,
  leftCount: number,
  rightCount: number,
): boolean {
  return branchMode && (leftCount >= 3 || rightCount >= 3);
}

export function getJrEastBranchCenterSquareSize(
  branchMode: boolean,
  leftCount: number,
  rightCount: number,
): number {
  return hasThreeJrEastBranches(branchMode, leftCount, rightCount)
    ? JR_EAST_BRANCH_LAYOUT.threeBranchCenterSquareSize
    : JR_EAST_BRANCH_LAYOUT.centerSquareSize;
}

export function getJrEastBranchCanvasHeight(
  baseHeight: number,
  branchMode: boolean,
  leftCount: number,
  rightCount: number,
): number {
  return baseHeight + (
    hasThreeJrEastBranches(branchMode, leftCount, rightCount)
      ? JR_EAST_BRANCH_LAYOUT.threeBranchHeightIncrease
      : 0
  );
}

export function getJrEastBranchDiagonalLineHeight(
  branchCount: number,
  isCenterBranch = false,
  hasThreeBranchLayout = branchCount >= 3,
): number {
  if (branchCount >= 3 && isCenterBranch) {
    return JR_EAST_BRANCH_LAYOUT.branchLineHeight;
  }
  if (branchCount === 2 && hasThreeBranchLayout) {
    return JR_EAST_BRANCH_LAYOUT.branchLineHeight;
  }
  return branchCount >= 3
    ? JR_EAST_BRANCH_LAYOUT.threeBranchDiagonalLineHeight
    : JR_EAST_BRANCH_LAYOUT.branchDiagonalLineHeight;
}

export function getJrEastBranchTrunkLineHeight(
  branchCount: number,
  hasThreeBranchLayout = branchCount >= 3,
): number {
  return branchCount >= 3 || hasThreeBranchLayout
    ? JR_EAST_BRANCH_LAYOUT.branchLineHeight
    : JR_EAST_BRANCH_LAYOUT.mainLineHeight;
}

export function getJrEastBranchPrimaryFontSize(
  branchCount: number,
  isTravelDirection: boolean,
  hasThreeBranchLayout = branchCount >= 3,
): number {
  if (!isTravelDirection || branchCount >= 3 || hasThreeBranchLayout) {
    return JR_EAST_BRANCH_LAYOUT.nonTravelFontSize;
  }
  if (branchCount === 2) {
    return JR_EAST_BRANCH_LAYOUT.twoBranchTravelFontSize;
  }
  return JR_EAST_BRANCH_LAYOUT.singleTravelFontSize;
}

export function getJrEastBranchSecondaryFontSize(
  branchCount: number,
  hasThreeBranchLayout = branchCount >= 3,
): number {
  return branchCount > 1 || hasThreeBranchLayout ? 11 : 13;
}

export function getJrEastBranchStationNameX(
  side: BranchSide,
  nameKind: "primary" | "secondary",
  isTravelDirection: boolean,
): number {
  const baseInset = nameKind === "primary" || isTravelDirection
    ? 60
    : side === "left" ? 64 : 66;
  const inset = isTravelDirection
    ? baseInset - JR_EAST_BRANCH_LAYOUT.travelTextOutwardShift
    : baseInset;

  return side === "left" ? inset : -inset;
}

export function getJrEastBranchStationBadgeX(
  side: BranchSide,
  width: number,
  badgeKind: "primary" | "secondary",
  isTravelDirection: boolean,
): number {
  if (!isTravelDirection) {
    if (side === "left") return badgeKind === "primary" ? 44 : 24;
    return badgeKind === "primary" ? width - 60 : width - 40;
  }

  const textInset = Math.abs(
    getJrEastBranchStationNameX(side, "secondary", true),
  );
  const badgeStep =
    JR_EAST_BRANCH_LAYOUT.adjacentBadgeSize +
    JR_EAST_BRANCH_LAYOUT.adjacentBadgeGap;

  if (side === "left") {
    const primaryX =
      textInset -
      JR_EAST_BRANCH_LAYOUT.travelTextBadgeGap -
      JR_EAST_BRANCH_LAYOUT.adjacentBadgeSize;
    return badgeKind === "primary" ? primaryX : primaryX - badgeStep;
  }

  const primaryX =
    width - textInset + JR_EAST_BRANCH_LAYOUT.travelTextBadgeGap;
  return badgeKind === "primary" ? primaryX : primaryX + badgeStep;
}

export function getJrEastBranchSecondaryNameY(
  targetY: number,
  lineHeight: number,
  isTravelDirection: boolean,
): number {
  const topAlignedY = targetY + lineHeight / 2 + 2;
  return isTravelDirection
    ? topAlignedY + JR_EAST_BRANCH_LAYOUT.travelSecondaryCenterAdjustment
    : topAlignedY;
}

export function getJrEastBranchArrowColor(
  branchCompanyColor: string | undefined,
  currentCompanyColor: string,
): string {
  return branchCompanyColor || currentCompanyColor;
}

export function getJrEastBranchStartDistance(width: number): number {
  return Math.max(
    JR_EAST_BRANCH_LAYOUT.branchStartMinDistance,
    width * JR_EAST_BRANCH_LAYOUT.branchStartRatio,
  );
}

export function getJrEastBranchDiagonalDistance(width: number): number {
  return Math.max(
    JR_EAST_BRANCH_LAYOUT.branchDiagonalMinDistance,
    width * JR_EAST_BRANCH_LAYOUT.branchDiagonalRatio,
  );
}

type BranchArrowOptions = {
  side: BranchSide;
  width: number;
  centerX: number;
  centerY: number;
  targetY: number;
  lineHeight: number;
  diagonalLineHeight?: number;
  branchStartDistance?: number;
  branchDiagonalDistance?: number;
  junctionOverlap?: number;
  showArrowhead?: boolean;
  edgeInset?: number;
};

/**
 * Build a JR East branch arrow as an absolute Konva polygon.
 * The elbow keeps the outer section horizontal so station labels remain legible.
 */
export function getJrEastBranchArrowPoints({
  side,
  width,
  centerX,
  centerY,
  targetY,
  lineHeight,
  diagonalLineHeight = lineHeight,
  branchStartDistance = 10,
  branchDiagonalDistance,
  junctionOverlap = 0,
  showArrowhead = true,
  edgeInset = 15,
}: BranchArrowOptions): number[] {
  const halfHeight = lineHeight / 2;
  const diagonalHalfHeight = diagonalLineHeight / 2;
  const junctionX = centerX + branchStartDistance - junctionOverlap;
  const elbowX =
    junctionX +
    (branchDiagonalDistance ?? getJrEastBranchDiagonalDistance(width));
  const bodyEndX = width - edgeInset - 20;
  const tipX = width - edgeInset;
  const upperConnectorPoints = [
    junctionX,
    centerY - diagonalHalfHeight,
    elbowX,
    targetY - halfHeight,
  ];
  const lowerConnectorPoints = [
    elbowX,
    targetY + halfHeight,
    junctionX,
    centerY + diagonalHalfHeight,
  ];
  const rightPoints = showArrowhead
    ? [
      ...upperConnectorPoints,
      bodyEndX,
      targetY - halfHeight,
      tipX,
      targetY,
      bodyEndX,
      targetY + halfHeight,
      ...lowerConnectorPoints,
    ]
    : [
      ...upperConnectorPoints,
      width,
      targetY - halfHeight,
      width,
      targetY + halfHeight,
      ...lowerConnectorPoints,
    ];

  if (side === "right") return rightPoints;

  return rightPoints.map((coordinate, index) =>
    index % 2 === 0 ? width - coordinate : coordinate,
  );
}

type ThreeBranchDiagonalOptions = {
  side: BranchSide;
  width: number;
  centerX: number;
  centerY: number;
  targetY: number;
  trunkLineHeight: number;
  branchLineHeight: number;
  diagonalLineHeight: number;
  branchStartDistance: number;
  branchDiagonalDistance: number;
};

/**
 * Build a uniform-width three-branch diagonal clipped by the horizontal
 * trunk and branch edges. Both diagonal sides remain single straight lines.
 */
export function getJrEastThreeBranchDiagonalGeometry({
  side,
  width,
  centerX,
  centerY,
  targetY,
  trunkLineHeight,
  branchLineHeight,
  diagonalLineHeight,
  branchStartDistance,
  branchDiagonalDistance,
}: ThreeBranchDiagonalOptions): {
  points: number[];
  horizontalStartX: number;
} {
  if (targetY > centerY) {
    const upperGeometry = getJrEastThreeBranchDiagonalGeometry({
      side,
      width,
      centerX,
      centerY,
      targetY: centerY - (targetY - centerY),
      trunkLineHeight,
      branchLineHeight,
      diagonalLineHeight,
      branchStartDistance,
      branchDiagonalDistance,
    });

    return {
      points: upperGeometry.points.map((coordinate, index) =>
        index % 2 === 0 ? coordinate : centerY * 2 - coordinate,
      ),
      horizontalStartX: upperGeometry.horizontalStartX,
    };
  }

  const junctionX = centerX + branchStartDistance;
  const elbowX = junctionX + branchDiagonalDistance;
  const deltaY = targetY - centerY;
  const slope = deltaY / branchDiagonalDistance;
  const direction = Math.sign(deltaY);
  const diagonalHalfHeight = diagonalLineHeight / 2;
  const trunkBoundaryY = centerY + direction * trunkLineHeight / 2;
  const branchBoundaryY = targetY - direction * branchLineHeight / 2;
  const xAtBoundary = (boundaryY: number, verticalOffset: number) =>
    junctionX + (boundaryY - centerY - verticalOffset) / slope;
  const firstRootX = xAtBoundary(trunkBoundaryY, -diagonalHalfHeight);
  const secondRootX = xAtBoundary(trunkBoundaryY, diagonalHalfHeight);
  const firstBranchX = xAtBoundary(branchBoundaryY, -diagonalHalfHeight);
  const secondBranchX = xAtBoundary(branchBoundaryY, diagonalHalfHeight);
  const rightPoints = [
    firstRootX + 2,
    trunkBoundaryY,
    firstBranchX + 22,
    branchBoundaryY - 18,
    secondBranchX + 26,
    branchBoundaryY - 18,
    secondRootX + 6,
    trunkBoundaryY,
  ];
  const points = side === "right"
    ? rightPoints
    : rightPoints.map((coordinate, index) =>
      index % 2 === 0 ? width - coordinate : coordinate,
    );

  return {
    points,
    horizontalStartX: Math.min(firstBranchX, secondBranchX),
  };
}

type HorizontalBranchArrowOptions = {
  side: BranchSide;
  width: number;
  startX: number;
  targetY: number;
  lineHeight: number;
  showArrowhead: boolean;
  edgeInset?: number;
};

export function getJrEastHorizontalBranchArrowPoints({
  side,
  width,
  startX,
  targetY,
  lineHeight,
  showArrowhead,
  edgeInset = 15,
}: HorizontalBranchArrowOptions): number[] {
  const halfHeight = lineHeight / 2;
  const bodyEndX = width - edgeInset - 20;
  const tipX = width - edgeInset;
  const rightPoints = showArrowhead
    ? [
      startX + 25,
      targetY - halfHeight,
      bodyEndX,
      targetY - halfHeight,
      tipX,
      targetY,
      bodyEndX,
      targetY + halfHeight,
      startX + 25,
      targetY + halfHeight,
    ]
    : [
      startX,
      targetY - halfHeight,
      width,
      targetY - halfHeight,
      width,
      targetY + halfHeight,
      startX,
      targetY + halfHeight,
    ];

  if (side === "right") return rightPoints;
  return rightPoints.map((coordinate, index) =>
    index % 2 === 0 ? width - coordinate : coordinate,
  );
}
