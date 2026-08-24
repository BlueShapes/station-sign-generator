import type { Database } from "sql.js";

function hasColumn(db: Database, table: string, column: string): boolean {
  return (db.exec(`PRAGMA table_info(${table})`)[0]?.values ?? []).some(
    (row) => row[1] === column,
  );
}

/**
 * Migrate from v0.10.0 to v0.11.0
 * - Separates route-map badge appearance from station-number badge appearance.
 * - Copies the previous shared style so existing route maps keep their look.
 */
export default function migrate(db: Database): void {
  if (hasColumn(db, "companies", "route_badge_style")) return;
  db.run(
    "ALTER TABLE companies ADD COLUMN route_badge_style TEXT NOT NULL DEFAULT 'jreast'",
  );
  db.run("UPDATE companies SET route_badge_style = station_number_style");
}

