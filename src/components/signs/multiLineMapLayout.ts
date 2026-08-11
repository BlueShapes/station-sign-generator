export interface MultiLineLayoutInput {
  lineId: string;
  parentLineId: string | null;
  stationIds: string[];
  isLoop?: boolean;
}

export interface MultiLineStationPoint {
  stationId: string;
  x: number;
  y: number;
  isJunction: boolean;
}

export interface MultiLinePathLayout {
  lineId: string;
  parentLineId: string | null;
  points: MultiLineStationPoint[];
  trackPoints: number[];
  labelSide: "above" | "below";
  closed?: boolean;
}

export interface MultiLineMapLayout {
  width: number;
  height: number;
  paths: MultiLinePathLayout[];
  loopCenter?: { x: number; y: number };
}

export const MULTI_LINE_MAP_PADDING = 50;
export const MULTI_LINE_MAP_TITLE_HEIGHT = 54;
export const MULTI_LINE_MAP_BRANCH_GAP = 104;
const LABEL_HEIGHT = 68;
export const MULTI_LINE_LOOP_RADIUS = 250;
const LOOP_LABEL_MARGIN = 185;

export function getMultiLineLoopRadius(
  stationCount: number,
  stationSpacing: number,
): number {
  if (stationCount < 3) return MULTI_LINE_LOOP_RADIUS;
  const spacing = Number.isFinite(stationSpacing) ? Math.max(0, stationSpacing) : 0;
  const radiusForChord = spacing / (2 * Math.sin(Math.PI / stationCount));
  return Math.max(MULTI_LINE_LOOP_RADIUS, radiusForChord);
}

function edgeKey(first: string, second: string): string {
  return first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`;
}

function routeEdges(route: MultiLineLayoutInput): string[] {
  const edges = route.stationIds.slice(1).map((stationId, index) =>
    edgeKey(route.stationIds[index], stationId)
  );
  if (route.isLoop && route.stationIds.length > 2) {
    edges.push(edgeKey(route.stationIds.at(-1)!, route.stationIds[0]));
  }
  return edges;
}

export function getParallelRouteIdsByStation(
  routes: MultiLineLayoutInput[],
): Map<string, string[]> {
  const routesByEdge = new Map<string, string[]>();
  for (const route of routes) {
    for (const key of routeEdges(route)) {
      const lineIds = routesByEdge.get(key) ?? [];
      if (!lineIds.includes(route.lineId)) lineIds.push(route.lineId);
      routesByEdge.set(key, lineIds);
    }
  }

  const parallelByStation = new Map<string, Set<string>>();
  for (const [key, lineIds] of routesByEdge) {
    if (lineIds.length < 2) continue;
    const [first, second] = key.split("\u0000");
    for (const stationId of [first, second]) {
      const set = parallelByStation.get(stationId) ?? new Set<string>();
      lineIds.forEach((lineId) => set.add(lineId));
      parallelByStation.set(stationId, set);
    }
  }

  return new Map(
    [...parallelByStation].map(([stationId, lineIds]) => [
      stationId,
      routes
        .map((route) => route.lineId)
        .filter((lineId) => lineIds.has(lineId)),
    ]),
  );
}

export function orderParallelRouteIdsByVerticalPosition(
  lineIds: string[],
  positions: Array<{ lineId: string; y: number }>,
): string[] {
  const yByLineId = new Map(
    positions.map(({ lineId, y }) => [lineId, y]),
  );
  const originalIndex = new Map(
    lineIds.map((lineId, index) => [lineId, index]),
  );
  return [...lineIds].sort((first, second) => {
    const firstY = yByLineId.get(first);
    const secondY = yByLineId.get(second);
    if (firstY != null && secondY != null && firstY !== secondY) {
      return firstY - secondY;
    }
    return originalIndex.get(first)! - originalIndex.get(second)!;
  });
}

function laneOffset(lineIds: string[], lineId: string, gap: number): number {
  const index = lineIds.indexOf(lineId);
  return index < 0 ? 0 : (index - (lineIds.length - 1) / 2) * gap;
}

/**
 * Align every repeated run of stations to the first selected route and give
 * each route its own lane. A station shared only as a branch junction is left
 * untouched, preserving the Marunouchi branch layout.
 */
export function applyParallelRouteLanes(
  layout: MultiLineMapLayout,
  routes: MultiLineLayoutInput[],
  gap: number,
): MultiLineMapLayout {
  const parallelByStation = getParallelRouteIdsByStation(routes);
  if (parallelByStation.size === 0) return layout;

  const canonical = new Map<string, { x: number; y: number }>();
  for (const path of layout.paths) {
    for (const point of path.points) {
      if (!canonical.has(point.stationId)) {
        canonical.set(point.stationId, { x: point.x, y: point.y });
      }
    }
  }

  const paths = layout.paths.map((path) => {
    const points = path.points.map((point) => {
      const lineIds = parallelByStation.get(point.stationId);
      const origin = lineIds ? canonical.get(point.stationId) : null;
      if (!lineIds || !origin) return point;
      return {
        ...point,
        x: origin.x,
        y: origin.y + laneOffset(lineIds, path.lineId, gap),
        isJunction: true,
      };
    });
    return {
      ...path,
      points,
      trackPoints: points.flatMap(({ x, y }) => [x, y]),
    };
  });

  return { ...layout, paths };
}

/**
 * Circular spine layout used when the first selected route is a loop. Routes
 * sharing an arc receive concentric lanes; non-loop tails continue outwards
 * from the first and last shared stations.
 */
export function layoutCircularMultiLineMap(
  routes: MultiLineLayoutInput[],
  requestedRootId: string,
  stationSpacing = 75,
  laneGap = 16,
): MultiLineMapLayout {
  const root = rootOf(routes, requestedRootId);
  if (!root || root.stationIds.length === 0) {
    return { width: 300, height: 200, paths: [] };
  }

  const rootIndex = new Map(root.stationIds.map((stationId, index) => [stationId, index]));
  const parallelByStation = getParallelRouteIdsByStation(routes);
  const loopRadius = getMultiLineLoopRadius(root.stationIds.length, stationSpacing);
  const center = loopRadius + LOOP_LABEL_MARGIN;
  const pointOnLoop = (stationId: string, lineId: string) => {
    const index = rootIndex.get(stationId) ?? 0;
    const angle = (2 * Math.PI * index) / root.stationIds.length - Math.PI / 2;
    const lineIds = parallelByStation.get(stationId) ?? [lineId];
    const radius = loopRadius + laneOffset(lineIds, lineId, laneGap);
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      angle,
    };
  };

  const rawPaths: MultiLinePathLayout[] = routes.map((route, routeIndex) => {
    const sharedIndices = route.stationIds
      .map((stationId, index) => rootIndex.has(stationId) ? index : -1)
      .filter((index) => index >= 0);
    const firstShared = sharedIndices[0] ?? -1;
    const lastShared = sharedIndices.at(-1) ?? -1;
    const firstAnchor = firstShared >= 0
      ? pointOnLoop(route.stationIds[firstShared], route.lineId)
      : null;
    const lastAnchor = lastShared >= 0
      ? pointOnLoop(route.stationIds[lastShared], route.lineId)
      : null;

    const points = route.stationIds.map((stationId, index) => {
      if (rootIndex.has(stationId)) {
        const point = pointOnLoop(stationId, route.lineId);
        return {
          stationId,
          x: point.x,
          y: point.y,
          isJunction: (parallelByStation.get(stationId)?.length ?? 0) > 1,
        };
      }

      if (firstAnchor && index < firstShared) {
        const distance = (firstShared - index) * stationSpacing;
        return {
          stationId,
          x: firstAnchor.x + Math.cos(firstAnchor.angle) * distance,
          y: firstAnchor.y + Math.sin(firstAnchor.angle) * distance,
          isJunction: false,
        };
      }
      if (lastAnchor && index > lastShared) {
        const distance = (index - lastShared) * stationSpacing;
        return {
          stationId,
          x: lastAnchor.x + Math.cos(lastAnchor.angle) * distance,
          y: lastAnchor.y + Math.sin(lastAnchor.angle) * distance,
          isJunction: false,
        };
      }

      return {
        stationId,
        x: MULTI_LINE_MAP_PADDING + index * stationSpacing,
        y: center * 2 + routeIndex * MULTI_LINE_MAP_BRANCH_GAP,
        isJunction: false,
      };
    });
    return {
      lineId: route.lineId,
      parentLineId: route.parentLineId,
      points,
      trackPoints: points.flatMap(({ x, y }) => [x, y]),
      labelSide: routeIndex === 0 ? "above" as const : "below" as const,
      closed: route.lineId === root.lineId && !!root.isLoop,
    };
  });

  const allPoints = rawPaths.flatMap((path) => path.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const shiftX = LOOP_LABEL_MARGIN - minX;
  const shiftY = LOOP_LABEL_MARGIN - minY;
  const paths = rawPaths.map((path) => {
    const points = path.points.map((point) => ({
      ...point,
      x: point.x + shiftX,
      y: point.y + shiftY,
    }));
    return { ...path, points, trackPoints: points.flatMap(({ x, y }) => [x, y]) };
  });

  return {
    width: Math.ceil(maxX - minX + LOOP_LABEL_MARGIN * 2),
    height: Math.ceil(maxY - minY + LOOP_LABEL_MARGIN * 2),
    paths,
    loopCenter: { x: center + shiftX, y: center + shiftY },
  };
}

function rootOf(
  routes: MultiLineLayoutInput[],
  requestedRootId: string,
): MultiLineLayoutInput | null {
  return (
    routes.find((route) => route.lineId === requestedRootId) ?? routes[0] ?? null
  );
}

/**
 * Creates a compact, deterministic route-family layout. The root line is the
 * horizontal spine. Child lines are attached at a shared station and continue
 * on their own row. A branch grows towards the nearest end of the spine, which
 * keeps short branches (such as the Marunouchi Honancho branch) inside the map.
 */
export function layoutMultiLineMap(
  routes: MultiLineLayoutInput[],
  requestedRootId: string,
  stationSpacing = 75,
): MultiLineMapLayout {
  const root = rootOf(routes, requestedRootId);
  if (!root || root.stationIds.length === 0) {
    return { width: 300, height: 200, paths: [] };
  }

  const rootY = MULTI_LINE_MAP_TITLE_HEIGHT + LABEL_HEIGHT;
  const rawPaths: MultiLinePathLayout[] = [];
  const rootPoints = root.stationIds.map((stationId, index) => ({
    stationId,
    x: MULTI_LINE_MAP_PADDING + index * stationSpacing,
    y: rootY,
    isJunction: false,
  }));
  rawPaths.push({
    lineId: root.lineId,
    parentLineId: root.parentLineId,
    points: rootPoints,
    trackPoints: rootPoints.flatMap(({ x, y }) => [x, y]),
    labelSide: "above",
  });

  const routeById = new Map(routes.map((route) => [route.lineId, route]));
  const laidOutById = new Map<string, MultiLinePathLayout>([
    [root.lineId, rawPaths[0]],
  ]);
  const remaining = routes.filter((route) => route.lineId !== root.lineId);
  let branchRow = 0;

  // Parent-first iteration also permits a branch of a branch without making
  // the common Marunouchi case more complicated.
  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((route) =>
      route.parentLineId
        ? laidOutById.has(route.parentLineId)
        : laidOutById.has(root.lineId),
    );
    const route = remaining.splice(nextIndex >= 0 ? nextIndex : 0, 1)[0];
    const parentId = route.parentLineId ?? root.lineId;
    const parentRoute = routeById.get(parentId) ?? root;
    const parentLayout = laidOutById.get(parentId) ?? rawPaths[0];
    const sharedId = route.stationIds.find((stationId) =>
      parentRoute.stationIds.includes(stationId),
    );

    if (!sharedId) {
      branchRow += 1;
      const y = rootY + branchRow * MULTI_LINE_MAP_BRANCH_GAP;
      const points = route.stationIds.map((stationId, index) => ({
        stationId,
        x: MULTI_LINE_MAP_PADDING + index * stationSpacing,
        y,
        isJunction: false,
      }));
      const path = {
        lineId: route.lineId,
        parentLineId: route.parentLineId,
        points,
        trackPoints: points.flatMap(({ x, y: pointY }) => [x, pointY]),
        labelSide: "below" as const,
      };
      rawPaths.push(path);
      laidOutById.set(route.lineId, path);
      continue;
    }

    const junction = parentLayout.points.find(
      (point) => point.stationId === sharedId,
    )!;
    junction.isJunction = true;
    const sharedIndex = route.stationIds.indexOf(sharedId);
    branchRow += 1;
    const y = rootY + branchRow * MULTI_LINE_MAP_BRANCH_GAP;

    // When the selected spine meets the middle of another line, retain both
    // sides of that line. This makes route ordering genuinely reversible
    // instead of silently dropping the stations before the junction.
    if (sharedIndex > 0 && sharedIndex < route.stationIds.length - 1) {
      const points = route.stationIds.map((stationId, index) => ({
        stationId,
        x: junction.x + (index - sharedIndex) * stationSpacing,
        y: index === sharedIndex ? junction.y : y,
        isJunction: index === sharedIndex,
      }));
      const path = {
        lineId: route.lineId,
        parentLineId: route.parentLineId,
        points,
        trackPoints: points.flatMap(({ x, y: pointY }) => [x, pointY]),
        labelSide: "below" as const,
      };
      rawPaths.push(path);
      laidOutById.set(route.lineId, path);
      continue;
    }

    const outwardStationIds =
      sharedIndex === route.stationIds.length - 1
        ? [...route.stationIds].reverse()
        : route.stationIds.slice(sharedIndex);
    const parentMinX = Math.min(...parentLayout.points.map((point) => point.x));
    const parentMaxX = Math.max(...parentLayout.points.map((point) => point.x));
    const growsLeft = junction.x <= (parentMinX + parentMaxX) / 2;
    const direction = growsLeft ? -1 : 1;
    const points = outwardStationIds.map((stationId, index) => ({
      stationId,
      x: junction.x + direction * index * stationSpacing,
      y: index === 0 ? junction.y : y,
      isJunction: index === 0,
    }));
    const path = {
      lineId: route.lineId,
      parentLineId: route.parentLineId,
      points,
      trackPoints: points.flatMap(({ x, y: pointY }) => [x, pointY]),
      labelSide: "below" as const,
    };
    rawPaths.push(path);
    laidOutById.set(route.lineId, path);
  }

  const allPoints = rawPaths.flatMap((path) => path.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const shiftX = minX < MULTI_LINE_MAP_PADDING
    ? MULTI_LINE_MAP_PADDING - minX
    : 0;
  const paths = rawPaths.map((path) => ({
    ...path,
    points: path.points.map((point) => ({ ...point, x: point.x + shiftX })),
    trackPoints: path.trackPoints.map((value, index) =>
      index % 2 === 0 ? value + shiftX : value
    ),
  }));

  return {
    width: Math.max(300, maxX + shiftX + MULTI_LINE_MAP_PADDING),
    height:
      rootY +
      Math.max(0, branchRow) * MULTI_LINE_MAP_BRANCH_GAP +
      LABEL_HEIGHT +
      MULTI_LINE_MAP_PADDING / 2,
    paths,
  };
}
