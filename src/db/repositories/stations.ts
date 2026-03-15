import type { Database } from "sql.js";
import type {
  Station,
  StationLine,
  StationNumber,
  StationArea,
  StationAreaWithZone,
} from "@/db/types";

// ── Stations ──────────────────────────────────────────────────────────────────

export function getAllStations(db: Database): Station[] {
  const stmt = db.prepare(
    `SELECT id, primary_name, primary_name_furigana, secondary_name, tertiary_name,
            quaternary_name, quinary_name, note, three_letter_code, sort_order
     FROM stations ORDER BY sort_order ASC, primary_name ASC`,
  );
  const results: Station[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as Station);
  }
  stmt.free();
  return results;
}

export function getStationsByLine(db: Database, lineId: string): Station[] {
  const stmt = db.prepare(
    `SELECT s.id, s.primary_name, s.primary_name_furigana, s.secondary_name,
            s.tertiary_name, s.quaternary_name, s.quinary_name, s.note,
            s.three_letter_code, s.sort_order
     FROM stations s
     JOIN station_lines sl ON sl.station_id = s.id
     WHERE sl.line_id = ?
     ORDER BY sl.sort_order ASC`,
  );
  stmt.bind([lineId]);
  const results: Station[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as Station);
  }
  stmt.free();
  return results;
}

export function upsertStation(db: Database, station: Station): void {
  db.run(
    `INSERT OR REPLACE INTO stations
       (id, primary_name, primary_name_furigana, secondary_name, tertiary_name,
        quaternary_name, quinary_name, note, three_letter_code, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      station.id,
      station.primary_name,
      station.primary_name_furigana,
      station.secondary_name,
      station.tertiary_name,
      station.quaternary_name,
      station.quinary_name,
      station.note,
      station.three_letter_code,
      station.sort_order,
    ],
  );
}

export function deleteStation(db: Database, id: string): void {
  db.run(`DELETE FROM stations WHERE id = ?`, [id]);
}

// ── Station Lines ─────────────────────────────────────────────────────────────

export function getStationLines(
  db: Database,
  stationId: string,
): StationLine[] {
  const stmt = db.prepare(
    `SELECT id, station_id, line_id, sort_order FROM station_lines WHERE station_id = ? ORDER BY sort_order ASC`,
  );
  stmt.bind([stationId]);
  const results: StationLine[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as StationLine);
  }
  stmt.free();
  return results;
}

export function upsertStationLine(db: Database, sl: StationLine): void {
  db.run(
    `INSERT OR REPLACE INTO station_lines (id, station_id, line_id, sort_order) VALUES (?, ?, ?, ?)`,
    [sl.id, sl.station_id, sl.line_id, sl.sort_order],
  );
}

export function deleteStationLine(db: Database, id: string): void {
  db.run(`DELETE FROM station_lines WHERE id = ?`, [id]);
}

export function deleteStationFromLine(
  db: Database,
  stationId: string,
  lineId: string,
): void {
  db.run(`DELETE FROM station_lines WHERE station_id = ? AND line_id = ?`, [
    stationId,
    lineId,
  ]);
}

// ── Station Numbers ───────────────────────────────────────────────────────────

export function getStationNumbers(
  db: Database,
  stationId: string,
  lineId?: string,
): StationNumber[] {
  let stmt;
  if (lineId !== undefined) {
    stmt = db.prepare(
      `SELECT id, station_id, line_id, value FROM station_numbers WHERE station_id = ? AND line_id = ?`,
    );
    stmt.bind([stationId, lineId]);
  } else {
    stmt = db.prepare(
      `SELECT id, station_id, line_id, value FROM station_numbers WHERE station_id = ?`,
    );
    stmt.bind([stationId]);
  }
  const results: StationNumber[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as StationNumber);
  }
  stmt.free();
  return results;
}

export function upsertStationNumber(db: Database, sn: StationNumber): void {
  db.run(
    `INSERT OR REPLACE INTO station_numbers (id, station_id, line_id, value) VALUES (?, ?, ?, ?)`,
    [sn.id, sn.station_id, sn.line_id, sn.value],
  );
}

export function deleteStationNumber(db: Database, id: string): void {
  db.run(`DELETE FROM station_numbers WHERE id = ?`, [id]);
}

// ── Station Areas ─────────────────────────────────────────────────────────────

export function getStationAreas(
  db: Database,
  stationId: string,
): StationArea[] {
  const stmt = db.prepare(
    `SELECT id, station_id, zone_id, sort_order FROM station_areas WHERE station_id = ? ORDER BY sort_order ASC`,
  );
  stmt.bind([stationId]);
  const results: StationArea[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as StationArea);
  }
  stmt.free();
  return results;
}

export function getStationAreasWithZones(
  db: Database,
  stationId: string,
): StationAreaWithZone[] {
  const stmt = db.prepare(
    `SELECT sa.id, sa.station_id, sa.zone_id, sa.sort_order,
            sz.name AS zone_name, sz.abbreviation AS zone_abbreviation,
            sz.is_black AS zone_is_black
     FROM station_areas sa
     JOIN special_zones sz ON sz.id = sa.zone_id
     WHERE sa.station_id = ?
     ORDER BY sa.sort_order ASC`,
  );
  stmt.bind([stationId]);
  const results: StationAreaWithZone[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as StationAreaWithZone);
  }
  stmt.free();
  return results;
}

export function upsertStationArea(db: Database, sa: StationArea): void {
  db.run(
    `INSERT OR REPLACE INTO station_areas (id, station_id, zone_id, sort_order) VALUES (?, ?, ?, ?)`,
    [sa.id, sa.station_id, sa.zone_id, sa.sort_order],
  );
}

export function deleteStationArea(db: Database, id: string): void {
  db.run(`DELETE FROM station_areas WHERE id = ?`, [id]);
}

export function syncStationAreas(
  db: Database,
  stationId: string,
  areas: StationArea[],
): void {
  db.run(`DELETE FROM station_areas WHERE station_id = ?`, [stationId]);
  areas.forEach((area) => {
    db.run(
      `INSERT INTO station_areas (id, station_id, zone_id, sort_order) VALUES (?, ?, ?, ?)`,
      [area.id, stationId, area.zone_id, area.sort_order],
    );
  });
}
