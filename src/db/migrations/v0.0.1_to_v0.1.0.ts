import type { Database } from "sql.js";

/**
 * Migrate from v0.0.1 to v0.1.0:
 * - Adds `is_loop` column to `lines`
 * - Adds `special_zones` table
 * - Migrates `station_areas` from (name, is_white) to (zone_id) via special_zones
 */
export default function migrate(db: Database): void {
  // Add is_loop to lines if missing
  try {
    const linesCols = db.exec(`PRAGMA table_info(lines)`);
    const linesColNames = linesCols.length
      ? (linesCols[0].values.map((r) => r[1]) as string[])
      : [];
    if (!linesColNames.includes("is_loop")) {
      db.run(`ALTER TABLE lines ADD COLUMN is_loop INTEGER NOT NULL DEFAULT 0`);
    }
  } catch {
    /* ignore */
  }

  // Migrate station_areas from old schema (name/is_white) to new (zone_id)
  try {
    const areasCols = db.exec(`PRAGMA table_info(station_areas)`);
    const areasColNames = areasCols.length
      ? (areasCols[0].values.map((r) => r[1]) as string[])
      : [];

    if (areasColNames.includes("name") && !areasColNames.includes("zone_id")) {
      const distinctZones = db.exec(
        `SELECT DISTINCT name, is_white FROM station_areas`,
      );
      const zoneMap: Record<string, string> = {};

      if (distinctZones.length && distinctZones[0].values.length) {
        for (const row of distinctZones[0].values) {
          const [name, is_white] = row as [string, number];
          const safeKey = String(name).replace(
            /[^a-zA-Z0-9\u3000-\u9FFF]/g,
            "_",
          );
          const zoneId = `mig-${safeKey}-${is_white}`;
          const abbreviation = String(name).charAt(0);
          const is_black = is_white === 1 ? 0 : 1;
          db.run(
            `INSERT OR IGNORE INTO special_zones (id, name, abbreviation, is_black) VALUES (?, ?, ?, ?)`,
            [zoneId, String(name), abbreviation, is_black],
          );
          zoneMap[`${name}|${is_white}`] = zoneId;
        }
      }

      const oldData = db.exec(
        `SELECT id, station_id, name, is_white, sort_order FROM station_areas`,
      );

      db.run(`DROP TABLE station_areas`);
      db.run(`
        CREATE TABLE station_areas (
          id         TEXT PRIMARY KEY,
          station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
          zone_id    TEXT NOT NULL REFERENCES special_zones(id) ON DELETE CASCADE,
          sort_order INTEGER DEFAULT 0
        )
      `);

      if (oldData.length && oldData[0].values.length) {
        for (const row of oldData[0].values) {
          const [id, station_id, name, is_white, sort_order] = row as [
            string,
            string,
            string,
            number,
            number,
          ];
          const zone_id = zoneMap[`${name}|${is_white}`];
          if (zone_id) {
            db.run(
              `INSERT INTO station_areas (id, station_id, zone_id, sort_order) VALUES (?, ?, ?, ?)`,
              [id, station_id, zone_id, sort_order],
            );
          }
        }
      }
    }
  } catch {
    /* ignore — already on new schema */
  }
}
