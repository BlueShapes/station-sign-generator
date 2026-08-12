export interface ConnectedStationNumber {
  style?: string;
  threeLetterCode?: string | null;
}

export function isJrEastStationNumber(
  number: ConnectedStationNumber,
  fallbackStyle = "jreast",
): boolean {
  return (number.style ?? fallbackStyle) === "jreast";
}

export function resolveConnectedStationNumbers<
  T extends ConnectedStationNumber,
>(
  numbers: T[],
  stationThreeLetterCode: string | null | undefined,
  connected: boolean,
): { numbers: T[]; sharedThreeLetterCode: string | null } {
  if (!connected) {
    return { numbers, sharedThreeLetterCode: null };
  }

  const code =
    stationThreeLetterCode?.trim() ||
    numbers.find((number) => isJrEastStationNumber(number))
      ?.threeLetterCode?.trim() ||
    null;
  const jrEastNumbers = numbers.filter((number) =>
    isJrEastStationNumber(number),
  );
  const sharesCode =
    !!code &&
    numbers.length > 1 &&
    jrEastNumbers.length === numbers.length;

  return {
    numbers: numbers.map((number) => ({
      ...number,
      threeLetterCode: sharesCode
        ? null
        : isJrEastStationNumber(number)
          ? code
          : null,
    })),
    sharedThreeLetterCode: sharesCode ? code : null,
  };
}
