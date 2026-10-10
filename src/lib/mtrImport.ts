export type MtrVersion = "4.0.5" | "4.1.0-beta.2" | "3.2.2-hotfix-2";
export const MTR_JSON_MAX_BYTES = 10 * 1024 * 1024;
const MAX_STATIONS = 50_000;
const MAX_ROUTES = 5_000;
const MAX_STOPS = 200_000;
const MAX_NAME_LENGTH = 100;

export type MtrErrorCode = "invalid-json" | "invalid-data" | "no-routes" | "too-large"
  | "invalid-url" | "fetch-failed" | "timeout" | "import-failed";
export class MtrImportError extends Error {
  constructor(public readonly code: MtrErrorCode) {
    super(code);
    this.name = "MtrImportError";
  }
}
export interface MtrStation { id: string; names: string[] }
export interface MtrRoute {
  id: string;
  names: string[];
  color: string;
  prefix: string;
  isLoop: boolean;
  stationIds: string[];
}
export interface MtrMap {
  version: MtrVersion;
  stations: MtrStation[];
  routes: MtrRoute[];
  skippedRoutes: number;
}

function invalid(): never { throw new MtrImportError("invalid-data"); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value)) return invalid();
  if (value.length > max) throw new MtrImportError("too-large");
  return value;
}
function text(value: unknown, max = 2_000): string {
  if (typeof value !== "string" || value.length > max) return invalid();
  return value;
}
function id(value: unknown): string {
  const result = text(value, 128);
  return result.length > 0 ? result : invalid();
}
function names(value: unknown): string[] {
  const slots = text(value).split("|").map((name) => name.trim());
  if (!slots[0] || slots.some((name) => name.length > MAX_NAME_LENGTH)) return invalid();
  return slots;
}
function color(value: unknown): string {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffffff) return invalid();
  return `#${value.toString(16).padStart(6, "0")}`;
}

/** Consecutive platforms are one stop. Only explicit circular routes can close. */
function normalizeStops(stops: string[], isLoop: boolean): string[] | null {
  const consecutive = stops.filter((stop, index) => index === 0 || stop !== stops[index - 1]);
  const result = isLoop && consecutive.length > 1 && consecutive[0] === consecutive.at(-1)
    ? consecutive.slice(0, -1) : consecutive;
  return result.length && new Set(result).size === result.length ? result : null;
}

function convertPayload(payload: Record<string, unknown>, version: MtrVersion): MtrMap {
  const legacy = version === "3.2.2-hotfix-2";
  const sourceStations: Record<string, unknown>[] = legacy
    ? Object.entries(record(payload.stations)).map(([stationId, station]) => ({ ...record(station), id: stationId }))
    : list(payload.stations, MAX_STATIONS).map(record);
  if (sourceStations.length > MAX_STATIONS) throw new MtrImportError("too-large");
  const stations = sourceStations.map((station) => ({ id: id(station.id), names: names(station.name) }));
  const stationIds = new Set(stations.map((station) => station.id));
  if (stationIds.size !== stations.length) return invalid();
  const sourceRoutes = list(payload.routes, MAX_ROUTES);
  const routeIds = new Set<string>();
  let stopCount = 0;
  let skippedRoutes = 0;
  const routes: MtrRoute[] = [];
  for (const [index, value] of sourceRoutes.entries()) {
    const route = record(value);
    const routeId = legacy ? `mtr3-${index}` : id(route.id);
    if (routeIds.has(routeId)) return invalid();
    routeIds.add(routeId);
    const routeColor = color(route.color);
    const routeName = text(route.name);
    const routeNames = names(legacy ? routeName.split("||")[0] : routeName);
    const prefix = text(route.number ?? "", MAX_NAME_LENGTH);
    const circular = legacy ? route.circular : route.circularState;
    if (!(legacy ? ["", "cw", "ccw"] : ["NONE", "CLOCKWISE", "ANTICLOCKWISE"]).includes(circular as string)) return invalid();
    const isLoop = legacy ? circular !== "" : circular !== "NONE";
    const stops = list(route.stations, MAX_STOPS).map((stop) => {
      if (!legacy) return id(record(stop).id);
      const match = text(stop, 160).match(/^(-?\d+)_([0-9]+)$/);
      if (!match) return invalid();
      return match[1];
    });
    stopCount += stops.length;
    if (stopCount > MAX_STOPS) throw new MtrImportError("too-large");
    if (stops.some((stop) => !stationIds.has(stop))) return invalid();
    const normalized = normalizeStops(stops, isLoop);
    if (!normalized) { skippedRoutes += 1; continue; }
    routes.push({ id: routeId, names: routeNames, color: routeColor,
      prefix: legacy ? prefix.split("||")[0] : prefix, isLoop, stationIds: normalized });
  }
  if (!routes.length) throw new MtrImportError("no-routes");
  return { version, stations, routes, skippedRoutes };
}

export function parseMtrJson(json: string, version: MtrVersion, dimension = 0): MtrMap {
  if (json.length > MTR_JSON_MAX_BYTES || new TextEncoder().encode(json).byteLength > MTR_JSON_MAX_BYTES) {
    throw new MtrImportError("too-large");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(json.trim()); }
  catch { throw new MtrImportError("invalid-json"); }
  if (version === "3.2.2-hotfix-2") {
    if (!Number.isSafeInteger(dimension) || dimension < 0) return invalid();
    const dimensions = list(parsed, 1_024);
    return convertPayload(record(dimensions[dimension]), version);
  }
  if (version !== "4.0.5" && version !== "4.1.0-beta.2") return invalid();
  const response = record(parsed);
  if (response.code !== undefined && response.code !== 200) return invalid();
  if (response.status !== undefined && response.status !== 200) return invalid();
  // Accept a complete response, or just its data object copied from DevTools.
  return convertPayload(record(response.data ?? response), version);
}
