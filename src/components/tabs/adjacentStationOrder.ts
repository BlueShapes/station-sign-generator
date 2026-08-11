import { moveOrderedId } from "./orderedIds";

export function moveAdjacentStationId(
  values: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  return moveOrderedId(values, fromIndex, toIndex);
}
