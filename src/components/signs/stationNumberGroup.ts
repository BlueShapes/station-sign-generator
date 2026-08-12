export interface ConnectedStationNumber {
  style?: string;
  threeLetterCode?: string | null;
}

export interface ConnectedStationNumberRun<
  T extends ConnectedStationNumber,
> {
  numbers: T[];
  sharedThreeLetterCode: string | null;
}

export function isJrEastStationNumber(
  number: ConnectedStationNumber,
  fallbackStyle = "jreast",
): boolean {
  return (number.style ?? fallbackStyle) === "jreast";
}

/**
 * Split a badge row into maximal JR East and non-JR-East runs.
 * Consecutive JR East badges share one station-level three-letter-code frame;
 * a single JR East badge retains its own frame.
 */
export function resolveConnectedStationNumberRuns<
  T extends ConnectedStationNumber,
>(
  numbers: T[],
  stationThreeLetterCode: string | null | undefined,
): Array<ConnectedStationNumberRun<T>> {
  const code =
    stationThreeLetterCode?.trim() ||
    numbers.find((number) => isJrEastStationNumber(number))
      ?.threeLetterCode?.trim() ||
    null;
  const runs: T[][] = [];

  numbers.forEach((number) => {
    const previousRun = runs.at(-1);
    const continuesJrEastRun =
      previousRun &&
      isJrEastStationNumber(number) &&
      isJrEastStationNumber(previousRun[0]);

    if (continuesJrEastRun) {
      previousRun.push(number);
    } else {
      runs.push([number]);
    }
  });

  return runs.map((run) => {
    const isJrEastRun = isJrEastStationNumber(run[0]);
    const sharedThreeLetterCode =
      code && isJrEastRun && run.length > 1 ? code : null;

    return {
      numbers: run.map((number) => ({
        ...number,
        threeLetterCode:
          isJrEastRun && !sharedThreeLetterCode ? code : null,
      })),
      sharedThreeLetterCode,
    };
  });
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
