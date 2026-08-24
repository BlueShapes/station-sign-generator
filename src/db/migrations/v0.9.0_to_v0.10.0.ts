import type { Database } from "sql.js";

function getDirectionDefault(db: Database): string | null {
  const result = db.exec("PRAGMA table_info(current_sign_configurations)");
  const directionColumn = (result[0]?.values ?? []).find(
    (row) => row[1] === "direction",
  );
  return directionColumn ? String(directionColumn[4]) : null;
}

/**
 * Migrate from v0.9.0 to v0.10.0
 * - Makes right-facing station signs the default for newly created settings.
 * - Preserves the direction selected for every existing setting.
 */
export default function migrate(db: Database): void {
  if (getDirectionDefault(db) === "'right'") return;

  db.run("SAVEPOINT migrate_v090_to_v0100");
  try {
    db.run(`
      CREATE TABLE current_sign_configurations_v0100 (
        id         TEXT PRIMARY KEY,
        station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
        ratio      REAL DEFAULT 4.5,
        direction  TEXT DEFAULT 'right',
        sign_style TEXT
      )
    `);
    db.run(`
      INSERT INTO current_sign_configurations_v0100
        (id, station_id, ratio, direction, sign_style)
      SELECT id, station_id, ratio, direction, sign_style
        FROM current_sign_configurations
    `);
    db.run("DROP TABLE current_sign_configurations");
    db.run(`
      ALTER TABLE current_sign_configurations_v0100
      RENAME TO current_sign_configurations
    `);
    db.run("RELEASE SAVEPOINT migrate_v090_to_v0100");
  } catch (error) {
    db.run("ROLLBACK TO SAVEPOINT migrate_v090_to_v0100");
    db.run("RELEASE SAVEPOINT migrate_v090_to_v0100");
    throw error;
  }
}
