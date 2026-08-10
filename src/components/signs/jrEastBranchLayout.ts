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

export function hasActiveJrEastBranches(
  branchMode: boolean,
  leftCount: number,
  rightCount: number,
): boolean {
  return branchMode && (leftCount > 1 || rightCount > 1);
}

export function getJrEastBranchPrimaryFontSize(
  branchCount: number,
  isTravelDirection: boolean,
): number {
  if (!isTravelDirection || branchCount >= 3) {
    return JR_EAST_BRANCH_LAYOUT.nonTravelFontSize;
  }
  if (branchCount === 2) {
    return JR_EAST_BRANCH_LAYOUT.twoBranchTravelFontSize;
  }
  return JR_EAST_BRANCH_LAYOUT.singleTravelFontSize;
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
  showArrowhead = true,
  edgeInset = 15,
}: BranchArrowOptions): number[] {
  const halfHeight = lineHeight / 2;
  const diagonalHalfHeight = diagonalLineHeight / 2;
  const junctionX = centerX + branchStartDistance;
  const elbowX =
    junctionX +
    (branchDiagonalDistance ?? getJrEastBranchDiagonalDistance(width));
  const bodyEndX = width - edgeInset - 20;
  const tipX = width - edgeInset;
  const rightPoints = showArrowhead
    ? [
      junctionX,
      centerY - diagonalHalfHeight,
      elbowX,
      targetY - halfHeight,
      bodyEndX,
      targetY - halfHeight,
      tipX,
      targetY,
      bodyEndX,
      targetY + halfHeight,
      elbowX,
      targetY + halfHeight,
      junctionX,
      centerY + diagonalHalfHeight,
    ]
    : [
      junctionX,
      centerY - diagonalHalfHeight,
      elbowX,
      targetY - halfHeight,
      width,
      targetY - halfHeight,
      width,
      targetY + halfHeight,
      elbowX,
      targetY + halfHeight,
      junctionX,
      centerY + diagonalHalfHeight,
    ];

  if (side === "right") return rightPoints;

  return rightPoints.map((coordinate, index) =>
    index % 2 === 0 ? width - coordinate : coordinate,
  );
}
