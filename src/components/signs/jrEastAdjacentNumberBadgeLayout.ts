export type JrEastAdjacentNumberBadgeSide = "left" | "right";
export type JrEastAdjacentNumberBadgeSlot = 0 | 1 | 2;

const BADGE_STEP = 20;
const LEFT_PRIMARY_X = 44;
const RIGHT_PRIMARY_INSET = 60;

/** Horizontal position of a compact badge in the standard JR East sign. */
export function getJrEastAdjacentNumberBadgeX(
  side: JrEastAdjacentNumberBadgeSide,
  width: number,
  slot: JrEastAdjacentNumberBadgeSlot,
): number {
  return side === "left"
    ? LEFT_PRIMARY_X - slot * BADGE_STEP
    : width - RIGHT_PRIMARY_INSET + slot * BADGE_STEP;
}
