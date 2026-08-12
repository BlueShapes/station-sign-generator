export interface StationTransferCandidate {
  id: string;
  name: string;
  stationNumber: string | null;
  routeOrder: number;
}

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function normalizeStationName(name: string): string {
  return name
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s・･\-‐‑‒–—―()（）\[\]［］]/g, "")
    .replace(/駅$/, "");
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) =>
    value.slice(index, index + 2),
  );
}

export function getStationNameSimilarity(
  referenceName: string,
  candidateName: string,
): number {
  const reference = normalizeStationName(referenceName);
  const candidate = normalizeStationName(candidateName);
  if (!reference || !candidate) return 0;
  if (reference === candidate) return 3;

  if (reference.includes(candidate) || candidate.includes(reference)) {
    return 2 + Math.min(reference.length, candidate.length) /
      Math.max(reference.length, candidate.length);
  }

  const referenceBigrams = bigrams(reference);
  const candidateBigrams = bigrams(candidate);
  const remaining = [...candidateBigrams];
  let overlap = 0;
  for (const part of referenceBigrams) {
    const matchIndex = remaining.indexOf(part);
    if (matchIndex === -1) continue;
    overlap += 1;
    remaining.splice(matchIndex, 1);
  }
  const dice =
    (2 * overlap) / (referenceBigrams.length + candidateBigrams.length);
  return dice >= 0.5 ? 1 + dice : 0;
}

export function sortStationTransferCandidates(
  referenceName: string,
  candidates: StationTransferCandidate[],
): StationTransferCandidate[] {
  return [...candidates].sort((first, second) => {
    const similarityDifference =
      getStationNameSimilarity(referenceName, second.name) -
      getStationNameSimilarity(referenceName, first.name);
    if (similarityDifference !== 0) return similarityDifference;

    if (first.stationNumber && second.stationNumber) {
      const numberDifference = naturalCollator.compare(
        first.stationNumber,
        second.stationNumber,
      );
      if (numberDifference !== 0) return numberDifference;
    } else if (first.stationNumber || second.stationNumber) {
      return first.stationNumber ? -1 : 1;
    }

    if (first.routeOrder !== second.routeOrder) {
      return first.routeOrder - second.routeOrder;
    }
    const nameDifference = naturalCollator.compare(first.name, second.name);
    return nameDifference || naturalCollator.compare(first.id, second.id);
  });
}
