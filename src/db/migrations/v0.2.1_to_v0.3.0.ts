import type { Database } from "sql.js";

/**
 * Migrate from v0.2.1 to v0.3.0:
 * - Adds `services` table (per-line named services: Local, Rapid, etc.)
 * - Adds `station_service_stops` junction table
 * - Seeds a "Local" service for every existing line
 * - Seeds stops for all existing station–line assignments
 */
export default function migrate(db: Database): void {
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS services (
        id         TEXT PRIMARY KEY,
        line_id    TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `);
  } catch {
    /* ignore */
  }

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS station_service_stops (
        id         TEXT PRIMARY KEY,
        station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE
      )
    `);
  } catch {
    /* ignore */
  }

  // Seed "Local" service for each line that has no services yet, and add stops
  try {
    const lines = db.exec(`SELECT id FROM lines`);
    if (!lines.length || !lines[0].values.length) return;

    for (const [lineId] of lines[0].values) {
      const existing = db.exec(
        `SELECT id FROM services WHERE line_id = ?`,
        [lineId as string],
      );
      if (existing.length && existing[0].values.length) continue;

      const serviceId = `seed-local-${lineId as string}`;
      db.run(
        `INSERT OR IGNORE INTO services (id, line_id, name, sort_order) VALUES (?, ?, 'Local', 0)`,
        [serviceId, lineId as string],
      );

      const stationsOnLine = db.exec(
        `SELECT station_id FROM station_lines WHERE line_id = ?`,
        [lineId as string],
      );
      if (!stationsOnLine.length || !stationsOnLine[0].values.length) continue;

      for (const [stationId] of stationsOnLine[0].values) {
        const stopId = `seed-stop-${stationId as string}-${serviceId}`;
        db.run(
          `INSERT OR IGNORE INTO station_service_stops (id, station_id, service_id) VALUES (?, ?, ?)`,
          [stopId, stationId as string, serviceId],
        );
      }
    }
  } catch {
    /* ignore */
  }
}
