interface StationOptionNumber {
  prefix: string;
  value: string;
}

export function formatStationOptionLabel(
  stationName: string,
  stationNumber: StationOptionNumber | null,
): string {
  if (!stationNumber) return stationName;

  const code = `${stationNumber.prefix}${stationNumber.value}`.trim();
  return code ? `[${code}] ${stationName}` : stationName;
}
