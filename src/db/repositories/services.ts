import type { Database } from "sql.js";
import type { Service, StationServiceStop, ServiceStopStatus } from "@/db/types";

export function getServicesByLine(db: Database, lineId: string): Service[] {
  const stmt = db.prepare(
    `SELECT id, line_id, name, color, sort_order FROM services WHERE line_id = ? ORDER BY sort_order ASC, name ASC`,
  );
  stmt.bind([lineId]);
  const results: Service[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      line_id: string;
      name: string;
      color: string;
      sort_order: number;
    };
    results.push({
      id: row.id,
      line_id: row.line_id,
      name: row.name,
      color: row.color ?? "#8cc800",
      sort_order: row.sort_order ?? 0,
    });
  }
  stmt.free();
  return results;
}

export function upsertService(db: Database, service: Service): void {
  db.run(
    `INSERT OR REPLACE INTO services (id, line_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)`,
    [service.id, service.line_id, service.name, service.color, service.sort_order],
  );
}

export function deleteService(db: Database, id: string): void {
  db.run(`DELETE FROM services WHERE id = ?`, [id]);
}

/** Returns all station_service_stops for services belonging to a given line. */
export function getServiceStopsByLine(
  db: Database,
  lineId: string,
): StationServiceStop[] {
  const stmt = db.prepare(`
    SELECT sss.id, sss.station_id, sss.service_id, sss.status
    FROM station_service_stops sss
    JOIN services s ON sss.service_id = s.id
    WHERE s.line_id = ?
  `);
  stmt.bind([lineId]);
  const results: StationServiceStop[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      station_id: string;
      service_id: string;
      status: string;
    };
    results.push({
      id: row.id,
      station_id: row.station_id,
      service_id: row.service_id,
      status: row.status === "special" ? "special" : "stop",
    });
  }
  stmt.free();
  return results;
}

export function upsertStationServiceStop(
  db: Database,
  stop: StationServiceStop,
): void {
  db.run(
    `INSERT OR REPLACE INTO station_service_stops (id, station_id, service_id, status) VALUES (?, ?, ?, ?)`,
    [stop.id, stop.station_id, stop.service_id, stop.status],
  );
}

export function deleteStationServiceStop(
  db: Database,
  stationId: string,
  serviceId: string,
): void {
  db.run(
    `DELETE FROM station_service_stops WHERE station_id = ? AND service_id = ?`,
    [stationId, serviceId],
  );
}

/** Convenience: set status for a station+service, or delete if 'pass'. */
export function setStationServiceStop(
  db: Database,
  id: string,
  stationId: string,
  serviceId: string,
  status: "pass" | ServiceStopStatus,
): void {
  deleteStationServiceStop(db, stationId, serviceId);
  if (status !== "pass") {
    upsertStationServiceStop(db, {
      id,
      station_id: stationId,
      service_id: serviceId,
      status,
    });
  }
}
