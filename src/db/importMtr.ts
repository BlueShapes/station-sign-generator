import type { Database } from "sql.js";
import { v7 as uuidv7 } from "uuid";
import type { MtrMap } from "../lib/mtrImport";

/** Add one independent import, sharing source station IDs only within this batch. */
export function importMtrRoutes(
  db: Database,
  map: MtrMap,
  routeIds: string[],
  companyId: string | null,
  persist?: () => void,
): { routes: number; stations: number } {
  const selectedIds = new Set(routeIds);
  const routes = map.routes.filter((route) => selectedIds.has(route.id));
  if (!routes.length || routes.length !== selectedIds.size) {
    throw new Error("Invalid route selection");
  }
  if (companyId !== null) {
    const company = db.exec("SELECT id FROM companies WHERE id = ?", [companyId]);
    if (!company[0]?.values.length) throw new Error("Unknown company");
  }
  const sourceStations = new Map(map.stations.map((station) => [station.id, station]));
  const stationIds = new Map<string, string>();
  const priorityResult = db.exec("SELECT COALESCE(MAX(priority), 0) FROM lines");
  const priority = Number(priorityResult[0]?.values[0][0] ?? 0);
  const foreignKeys = db.exec("PRAGMA foreign_keys")[0]?.values[0][0] === 1;
  const lineIds: string[] = [];
  let committed = false;

  db.run("SAVEPOINT import_mtr_routes");
  try {
    for (const [routeIndex, route] of routes.entries()) {
      const lineId = uuidv7();
      lineIds.push(lineId);
      db.run(
        `INSERT INTO lines
          (id,company_id,name,secondary_name,tertiary_name,quaternary_name,
           line_color,prefix,priority,is_loop,parent_line_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`,
        [lineId, companyId, route.names[0], route.names[1] ?? null,
          route.names[2] ?? null, route.names[3] ?? null, route.color,
          route.prefix, priority + routeIndex + 1, route.isLoop ? 1 : 0],
      );
      for (const [stationIndex, sourceId] of route.stationIds.entries()) {
        let stationId = stationIds.get(sourceId);
        if (!stationId) {
          const station = sourceStations.get(sourceId);
          if (!station) throw new Error("Unknown station");
          stationId = uuidv7();
          db.run(
            `INSERT INTO stations
              (id,primary_name,primary_name_furigana,secondary_name,tertiary_name,
               quaternary_name,quinary_name,note,three_letter_code,sort_order)
             VALUES (?,?,NULL,?,?,?,?,NULL,NULL,NULL)`,
            [stationId, station.names[0], station.names[1] ?? null,
              station.names[2] ?? null, station.names[3] ?? null, station.names[4] ?? null],
          );
          stationIds.set(sourceId, stationId);
        }
        db.run(
          "INSERT INTO station_lines (id,station_id,line_id,sort_order) VALUES (?,?,?,?)",
          [uuidv7(), stationId, lineId, stationIndex + 1],
        );
      }
    }
    db.run("RELEASE SAVEPOINT import_mtr_routes");
    committed = true;
    // sql.js export reopens the connection, so persistence must follow commit.
    persist?.();
    return { routes: routes.length, stations: stationIds.size };
  } catch (error) {
    if (committed) {
      // localStorage.setItem is atomic. If saving fails, remove only this batch
      // from memory; the previously saved database remains intact for retry.
      db.run("SAVEPOINT undo_mtr_import");
      try {
        for (const lineId of lineIds) {
          db.run("DELETE FROM station_lines WHERE line_id = ?", [lineId]);
          db.run("DELETE FROM lines WHERE id = ?", [lineId]);
        }
        for (const stationId of stationIds.values()) {
          db.run("DELETE FROM stations WHERE id = ?", [stationId]);
        }
        db.run("RELEASE SAVEPOINT undo_mtr_import");
      } catch (rollbackError) {
        db.run("ROLLBACK TO SAVEPOINT undo_mtr_import");
        db.run("RELEASE SAVEPOINT undo_mtr_import");
        throw rollbackError;
      }
    } else {
      db.run("ROLLBACK TO SAVEPOINT import_mtr_routes");
      db.run("RELEASE SAVEPOINT import_mtr_routes");
    }
    throw error;
  } finally {
    // Database.export() also clears connection pragmas. Preserve enforcement.
    if (committed && persist) db.run(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  }
}
