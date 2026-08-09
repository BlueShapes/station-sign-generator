export function orderAdjacentStationIds(
  values: readonly string[],
  reversed: boolean,
): string[] {
  const orderedValues = values.slice(0, 2);
  return reversed && orderedValues.length === 2
    ? orderedValues.reverse()
    : orderedValues;
}
