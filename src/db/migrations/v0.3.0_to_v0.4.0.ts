import type { Database } from "sql.js";

/**
 * Migrate from v0.3.0 to v0.4.0:
 * - Adds `color` column to `services` (defaults to the owning line's color)
 * - Adds `status` column to `station_service_stops` ('stop' | 'special')
 */
export default function migrate(db: Database): void {
  // Add color to services
  try {
    const cols = db.exec(`PRAGMA table_info(services)`);
    const colNames = cols.length
      ? (cols[0].values.map((r) => r[1]) as string[])
      : [];
    if (!colNames.includes("color")) {
      db.run(
        `ALTER TABLE services ADD COLUMN color TEXT NOT NULL DEFAULT '#8cc800'`,
      );
      // Backfill with the owning line's color
      db.run(
        `UPDATE services SET color = (SELECT line_color FROM lines WHERE lines.id = services.line_id)`,
      );
    }
  } catch {
    /* ignore */
  }

  // Add status to station_service_stops
  try {
    const cols = db.exec(`PRAGMA table_info(station_service_stops)`);
    const colNames = cols.length
      ? (cols[0].values.map((r) => r[1]) as string[])
      : [];
    if (!colNames.includes("status")) {
      db.run(
        `ALTER TABLE station_service_stops ADD COLUMN status TEXT NOT NULL DEFAULT 'stop'`,
      );
    }
  } catch {
    /* ignore */
  }
}
