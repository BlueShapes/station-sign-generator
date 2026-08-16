type StationNumberFieldRequirement = "required" | "optional" | "hidden";

type StationNumberFieldSpec = {
  numberPrimary: StationNumberFieldRequirement;
  numberSecondary: StationNumberFieldRequirement;
  numberTertiary?: StationNumberFieldRequirement;
};

export type RouteStationNumberCandidate = {
  lineId: string;
};

const STATION_NUMBER_FIELDS = [
  "numberPrimary",
  "numberSecondary",
  "numberTertiary",
] as const;

export function getStationNumberSelectionLimit(
  fields: StationNumberFieldSpec,
): number {
  return STATION_NUMBER_FIELDS.filter(
    (field) => fields[field] === "required" || fields[field] === "optional",
  ).length;
}

export function getDefaultStationNumberLineIds<
  Candidate extends RouteStationNumberCandidate,
>(
  selectedLineId: string,
  candidates: readonly Candidate[],
  limit: number,
  fillAvailableSlots = false,
): string[] {
  const orderedCandidates = [
    ...candidates.filter(({ lineId }) => lineId === selectedLineId),
    ...candidates.filter(({ lineId }) => lineId !== selectedLineId),
  ];
  const defaults = fillAvailableSlots
    ? orderedCandidates.slice(0, limit)
    : orderedCandidates.slice(0, Math.min(limit, 1));
  return defaults.map(({ lineId }) => lineId);
}

export function resolveSelectedStationNumbers<
  Candidate extends RouteStationNumberCandidate,
>(
  selectedLineIds: readonly string[],
  candidates: readonly Candidate[],
  limit: number,
): Candidate[] {
  const candidatesByLineId = new Map(
    candidates.map((candidate) => [candidate.lineId, candidate]),
  );
  const seen = new Set<string>();

  return selectedLineIds
    .filter((lineId) => {
      if (seen.has(lineId) || !candidatesByLineId.has(lineId)) return false;
      seen.add(lineId);
      return true;
    })
    .slice(0, limit)
    .map((lineId) => candidatesByLineId.get(lineId)!);
}
