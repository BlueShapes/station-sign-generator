import type { Database } from "sql.js";
import type { SpecialZone } from "@/db/types";

export function getAllSpecialZones(db: Database): SpecialZone[] {
  const stmt = db.prepare(
    `SELECT id, name, abbreviation, is_black FROM special_zones ORDER BY name ASC`,
  );
  const results: SpecialZone[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as SpecialZone);
  }
  stmt.free();
  return results;
}

export function upsertSpecialZone(db: Database, zone: SpecialZone): void {
  db.run(
    `INSERT OR REPLACE INTO special_zones (id, name, abbreviation, is_black) VALUES (?, ?, ?, ?)`,
    [zone.id, zone.name, zone.abbreviation, zone.is_black],
  );
}

export function deleteSpecialZone(db: Database, id: string): void {
  db.run(`DELETE FROM special_zones WHERE id = ?`, [id]);
}
