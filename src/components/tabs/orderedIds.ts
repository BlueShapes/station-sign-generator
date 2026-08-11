export function moveOrderedId(
  values: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const orderedValues = [...values];
  if (
    fromIndex < 0 ||
    fromIndex >= orderedValues.length ||
    toIndex < 0 ||
    toIndex >= orderedValues.length ||
    fromIndex === toIndex
  ) {
    return orderedValues;
  }

  const [movedValue] = orderedValues.splice(fromIndex, 1);
  orderedValues.splice(toIndex, 0, movedValue);
  return orderedValues;
}

