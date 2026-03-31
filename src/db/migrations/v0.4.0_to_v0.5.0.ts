import type { Database } from "sql.js";

/**
 * Migrate from v0.4.0 to v0.5.0
 * - Adds `parent_line_id` column to `lines` (NULL for standalone lines)
 *   This supports branch lines and through-service routes that share station
 *   numbers with a parent line (e.g. 丸ノ内線方南町支線 shares M06 with 丸ノ内線).
 */
export default function migrate(db: Database): void {
  try {
    const cols = db.exec(`PRAGMA table_info(lines)`);
    const colNames = cols.length
      ? (cols[0].values.map((r) => r[1]) as string[])
      : [];
    if (!colNames.includes("parent_line_id")) {
      db.run(
        `ALTER TABLE lines ADD COLUMN parent_line_id TEXT REFERENCES lines(id) ON DELETE SET NULL`,
      );
    }
  } catch {
    /* ignore */
  }
}
