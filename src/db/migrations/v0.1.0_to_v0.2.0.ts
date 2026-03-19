import type { Database } from "sql.js";

/**
 * Migrate from v0.1.0 to v0.2.0:
 * - Adds `station_number_style` column to `companies`
 */
export default function migrate(db: Database): void {
  try {
    const cols = db.exec(`PRAGMA table_info(companies)`);
    const colNames = cols.length
      ? (cols[0].values.map((r) => r[1]) as string[])
      : [];
    if (!colNames.includes("station_number_style")) {
      db.run(
        `ALTER TABLE companies ADD COLUMN station_number_style TEXT NOT NULL DEFAULT 'jreast'`,
      );
    }
  } catch {
    /* ignore */
  }
}
