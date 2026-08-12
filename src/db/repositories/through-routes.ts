import type { Database } from "sql.js";
import type {
  ThroughRoute,
  ThroughRouteSegment,
} from "@/db/types";

export type ThroughRouteValidationError =
  | "empty"
  | "station-not-on-line"
  | "invalid-direction"
  | "disconnected";

export interface ThroughRouteValidationIssue {
  error: ThroughRouteValidationError;
  segmentIndex: number;
  previousSegmentIndex?: number;
}

export function getAllThroughRoutes(db: Database): ThroughRoute[] {
  const stmt = db.prepare(
    `SELECT id, name, sort_order
     FROM through_routes
     ORDER BY sort_order ASC, name ASC`,
  );
  const routes: ThroughRoute[] = [];
  while (stmt.step()) {
    routes.push(stmt.getAsObject() as unknown as ThroughRoute);
  }
  stmt.free();
  return routes;
}

export function getThroughRouteSegments(
  db: Database,
  throughRouteId: string,
): ThroughRouteSegment[] {
  const stmt = db.prepare(
    `SELECT id, through_route_id, line_id, entry_station_id,
            exit_station_id, direction, sort_order
     FROM through_route_segments
     WHERE through_route_id = ?
     ORDER BY sort_order ASC`,
  );
  stmt.bind([throughRouteId]);
  const segments: ThroughRouteSegment[] = [];
  while (stmt.step()) {
    segments.push(stmt.getAsObject() as unknown as ThroughRouteSegment);
  }
  stmt.free();
  return segments;
}

export function upsertThroughRoute(db: Database, route: ThroughRoute): void {
  db.run(
    `INSERT OR REPLACE INTO through_routes (id, name, sort_order)
     VALUES (?, ?, ?)`,
    [route.id, route.name, route.sort_order],
  );
}

export function deleteThroughRoute(db: Database, id: string): void {
  db.run(`DELETE FROM through_route_segments WHERE through_route_id = ?`, [id]);
  db.run(`DELETE FROM through_routes WHERE id = ?`, [id]);
}

function getLineStationOrder(
  db: Database,
  lineId: string,
): {
  stationIds: string[];
  order: Map<string, number>;
  isLoop: boolean;
} {
  const stmt = db.prepare(
    `SELECT sl.station_id, sl.sort_order, l.is_loop
     FROM station_lines sl
     JOIN lines l ON l.id = sl.line_id
     WHERE sl.line_id = ?
     ORDER BY sl.sort_order ASC`,
  );
  stmt.bind([lineId]);
  const stationIds: string[] = [];
  const order = new Map<string, number>();
  let isLoop = false;
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      station_id: string;
      sort_order: number;
      is_loop: number;
    };
    stationIds.push(row.station_id);
    order.set(row.station_id, row.sort_order);
    isLoop = row.is_loop === 1;
  }
  stmt.free();
  return { stationIds, order, isLoop };
}

function getAdjacentStationIds(
  stationIds: string[],
  stationId: string,
  isLoop: boolean,
): { previous: string | null; next: string | null } {
  const index = stationIds.indexOf(stationId);
  if (index === -1 || stationIds.length < 2) {
    return { previous: null, next: null };
  }
  return {
    previous:
      index > 0
        ? stationIds[index - 1]
        : isLoop
          ? stationIds[stationIds.length - 1]
          : null,
    next:
      index < stationIds.length - 1
        ? stationIds[index + 1]
        : isLoop
          ? stationIds[0]
          : null,
  };
}

function getRelativeDirectionFromThroughRoutes(
  db: Database,
  referenceLineId: string,
  targetLineId: string,
  stationId: string,
): ThroughRouteSegment["direction"] | null {
  const stmt = db.prepare(
    `SELECT reference.direction AS reference_direction,
            target.direction AS target_direction
     FROM through_route_segments reference
     JOIN through_route_segments target
       ON target.through_route_id = reference.through_route_id
     WHERE reference.line_id = ?
       AND target.line_id = ?
       AND (
         (target.sort_order = reference.sort_order + 1
          AND reference.exit_station_id = ?
          AND target.entry_station_id = ?)
         OR
         (reference.sort_order = target.sort_order + 1
          AND target.exit_station_id = ?
          AND reference.entry_station_id = ?)
       )`,
  );
  stmt.bind([
    referenceLineId,
    targetLineId,
    stationId,
    stationId,
    stationId,
    stationId,
  ]);
  const relativeDirections = new Set<ThroughRouteSegment["direction"]>();
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      reference_direction: ThroughRouteSegment["direction"];
      target_direction: ThroughRouteSegment["direction"];
    };
    relativeDirections.add(
      row.reference_direction === row.target_direction ? "forward" : "reverse",
    );
  }
  stmt.free();
  return relativeDirections.size === 1
    ? ([...relativeDirections][0] ?? null)
    : null;
}

/**
 * Determine how a target line's canonical station order is oriented relative
 * to a reference line at a shared station. Explicit through-route directions
 * take precedence, followed by evidence from shared station ordering.
 */
export function getRelativeLineDirectionAtStation(
  db: Database,
  referenceLineId: string,
  targetLineId: string,
  stationId: string,
): ThroughRouteSegment["direction"] | null {
  if (referenceLineId === targetLineId) return "forward";

  const reference = getLineStationOrder(db, referenceLineId);
  const target = getLineStationOrder(db, targetLineId);
  const referenceIndex = reference.stationIds.indexOf(stationId);
  const targetIndex = target.stationIds.indexOf(stationId);
  if (referenceIndex === -1 || targetIndex === -1) return null;

  const routeDirection = getRelativeDirectionFromThroughRoutes(
    db,
    referenceLineId,
    targetLineId,
    stationId,
  );
  if (routeDirection) return routeDirection;

  const referenceAdjacent = getAdjacentStationIds(
    reference.stationIds,
    stationId,
    reference.isLoop,
  );
  const targetAdjacent = getAdjacentStationIds(
    target.stationIds,
    stationId,
    target.isLoop,
  );
  const sameDirection =
    (referenceAdjacent.previous !== null &&
      referenceAdjacent.previous === targetAdjacent.previous) ||
    (referenceAdjacent.next !== null &&
      referenceAdjacent.next === targetAdjacent.next);
  const reverseDirection =
    (referenceAdjacent.previous !== null &&
      referenceAdjacent.previous === targetAdjacent.next) ||
    (referenceAdjacent.next !== null &&
      referenceAdjacent.next === targetAdjacent.previous);
  if (sameDirection !== reverseDirection) {
    return sameDirection ? "forward" : "reverse";
  }

  if (reference.isLoop || target.isLoop) return null;
  const commonStation = reference.stationIds
    .filter((id) => id !== stationId && target.order.has(id))
    .sort(
      (first, second) =>
        Math.abs(reference.stationIds.indexOf(first) - referenceIndex) -
        Math.abs(reference.stationIds.indexOf(second) - referenceIndex),
    )[0];
  if (!commonStation) return null;

  const referenceDelta =
    reference.stationIds.indexOf(commonStation) - referenceIndex;
  const targetDelta = target.stationIds.indexOf(commonStation) - targetIndex;
  return Math.sign(referenceDelta) === Math.sign(targetDelta)
    ? "forward"
    : "reverse";
}

/**
 * Resolve a segment to station IDs in travel order. Loop lines wrap across the
 * end/start boundary; direction selects which of the two arcs is traversed.
 */
export function getThroughRouteSegmentStationIds(
  db: Database,
  segment: ThroughRouteSegment,
): string[] {
  const { stationIds, order, isLoop } = getLineStationOrder(
    db,
    segment.line_id,
  );
  const entryOrder = order.get(segment.entry_station_id);
  const exitOrder = order.get(segment.exit_station_id);
  if (entryOrder === undefined || exitOrder === undefined) {
    throw new Error("Invalid through route: station-not-on-line");
  }
  if (entryOrder === exitOrder) {
    throw new Error("Invalid through route: invalid-direction");
  }

  const entryIndex = stationIds.indexOf(segment.entry_station_id);
  const exitIndex = stationIds.indexOf(segment.exit_station_id);
  const step = segment.direction === "forward" ? 1 : -1;
  if (!isLoop) {
    const followsDirection =
      segment.direction === "forward"
        ? entryIndex < exitIndex
        : entryIndex > exitIndex;
    if (!followsDirection) {
      throw new Error("Invalid through route: invalid-direction");
    }
  }

  const result = [segment.entry_station_id];
  let index = entryIndex;
  for (let visited = 1; visited < stationIds.length; visited += 1) {
    index += step;
    if (index < 0 || index >= stationIds.length) {
      if (!isLoop) {
        throw new Error("Invalid through route: invalid-direction");
      }
      index = (index + stationIds.length) % stationIds.length;
    }
    result.push(stationIds[index]);
    if (index === exitIndex) return result;
  }

  throw new Error("Invalid through route: invalid-direction");
}

export interface ThroughRoutePath {
  stationIds: string[];
  /** Line ID for each gap between adjacent station IDs. */
  edgeLineIds: string[];
  lineIds: string[];
}

/** Resolve all segments of a named through route into one branch-free path. */
export function getThroughRoutePath(
  db: Database,
  throughRouteId: string,
): ThroughRoutePath {
  const stationIds: string[] = [];
  const edgeLineIds: string[] = [];
  const lineIds: string[] = [];

  for (const segment of getThroughRouteSegments(db, throughRouteId)) {
    const segmentStationIds = getThroughRouteSegmentStationIds(db, segment);
    const previousStationId = stationIds[stationIds.length - 1];
    if (
      previousStationId !== undefined &&
      previousStationId !== segmentStationIds[0]
    ) {
      throw new Error("Invalid through route: disconnected");
    }

    if (!lineIds.includes(segment.line_id)) lineIds.push(segment.line_id);
    stationIds.push(
      ...(stationIds.length === 0
        ? segmentStationIds
        : segmentStationIds.slice(1)),
    );
    edgeLineIds.push(
      ...Array.from(
        { length: Math.max(0, segmentStationIds.length - 1) },
        () => segment.line_id,
      ),
    );
  }

  return { stationIds, edgeLineIds, lineIds };
}

export function getThroughRouteValidationIssues(
  db: Database,
  segments: ThroughRouteSegment[],
): ThroughRouteValidationIssue[] {
  if (segments.length === 0) {
    return [{ error: "empty", segmentIndex: -1 }];
  }

  const issues: ThroughRouteValidationIssue[] = [];
  let previousExitStationId: string | null = null;
  for (const [segmentIndex, segment] of segments.entries()) {
    const { order, isLoop } = getLineStationOrder(db, segment.line_id);
    const entryOrder = order.get(segment.entry_station_id);
    const exitOrder = order.get(segment.exit_station_id);
    if (entryOrder === undefined || exitOrder === undefined) {
      issues.push({ error: "station-not-on-line", segmentIndex });
    } else if (entryOrder === exitOrder) {
      issues.push({ error: "invalid-direction", segmentIndex });
    } else if (!isLoop) {
      const followsDirection =
        segment.direction === "forward"
          ? entryOrder < exitOrder
          : entryOrder > exitOrder;
      if (!followsDirection) {
        issues.push({ error: "invalid-direction", segmentIndex });
      }
    }
    if (
      previousExitStationId !== null &&
      previousExitStationId !== segment.entry_station_id
    ) {
      issues.push({
        error: "disconnected",
        segmentIndex,
        previousSegmentIndex: segmentIndex - 1,
      });
    }
    previousExitStationId = segment.exit_station_id;
  }

  return issues;
}

export function validateThroughRouteSegments(
  db: Database,
  segments: ThroughRouteSegment[],
): ThroughRouteValidationError | null {
  return getThroughRouteValidationIssues(db, segments)[0]?.error ?? null;
}

export function replaceThroughRouteSegments(
  db: Database,
  throughRouteId: string,
  segments: ThroughRouteSegment[],
): void {
  const error = validateThroughRouteSegments(db, segments);
  if (error) throw new Error(`Invalid through route: ${error}`);

  db.run("BEGIN TRANSACTION");
  try {
    db.run(`DELETE FROM through_route_segments WHERE through_route_id = ?`, [
      throughRouteId,
    ]);
    const stmt = db.prepare(
      `INSERT INTO through_route_segments
         (id, through_route_id, line_id, entry_station_id,
          exit_station_id, direction, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    segments.forEach((segment, index) => {
      stmt.run([
        segment.id,
        throughRouteId,
        segment.line_id,
        segment.entry_station_id,
        segment.exit_station_id,
        segment.direction,
        index,
      ]);
    });
    stmt.free();
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}
