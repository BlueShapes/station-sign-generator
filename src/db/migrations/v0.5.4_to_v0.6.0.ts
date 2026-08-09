import type { Database } from "sql.js";

function getColumns(db: Database, table: string): string[] {
  const result = db.exec(`PRAGMA table_info(${table})`);
  return result.length
    ? (result[0].values.map((row) => row[1]) as string[])
    : [];
}

function createThroughRoutesTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS through_routes (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function createCurrentSegmentsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS through_route_segments (
      id               TEXT PRIMARY KEY,
      through_route_id TEXT NOT NULL REFERENCES through_routes(id) ON DELETE CASCADE,
      line_id          TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
      entry_station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      exit_station_id  TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      direction        TEXT NOT NULL DEFAULT 'forward' CHECK (direction IN ('forward', 'reverse')),
      sort_order       INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_through_route_segments_route_order
      ON through_route_segments (through_route_id, sort_order)
  `);
}

/**
 * Migrate from v0.5.4 to v0.6.0
 * - Adds named, ordered through-service routes.
 * - Stores each line section as travel-oriented entry/exit stations and a
 *   forward/reverse direction, including loop sections that cross the boundary.
 * - Converts databases made with the intermediate unreleased start/end format.
 */
export default function migrate(db: Database): void {
  createThroughRoutesTable(db);

  const columns = getColumns(db, "through_route_segments");
  if (columns.length === 0) {
    createCurrentSegmentsTable(db);
    return;
  }
  if (
    columns.includes("entry_station_id") &&
    columns.includes("exit_station_id")
  ) {
    createCurrentSegmentsTable(db);
    return;
  }
  if (
    !columns.includes("line_start_station_id") ||
    !columns.includes("line_end_station_id")
  ) {
    return;
  }

  db.run("BEGIN TRANSACTION");
  try {
    db.run(`DROP TABLE IF EXISTS through_route_segments_v060`);
    db.run(`
      CREATE TABLE through_route_segments_v060 (
        id               TEXT PRIMARY KEY,
        through_route_id TEXT NOT NULL REFERENCES through_routes(id) ON DELETE CASCADE,
        line_id          TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
        entry_station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        exit_station_id  TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        direction        TEXT NOT NULL DEFAULT 'forward' CHECK (direction IN ('forward', 'reverse')),
        sort_order       INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.run(`
      INSERT INTO through_route_segments_v060
        (id, through_route_id, line_id, entry_station_id, exit_station_id,
         direction, sort_order)
      SELECT id, through_route_id, line_id,
             CASE direction
               WHEN 'reverse' THEN line_end_station_id
               ELSE line_start_station_id
             END,
             CASE direction
               WHEN 'reverse' THEN line_start_station_id
               ELSE line_end_station_id
             END,
             direction, sort_order
      FROM through_route_segments
    `);
    db.run(`DROP TABLE through_route_segments`);
    db.run(
      `ALTER TABLE through_route_segments_v060 RENAME TO through_route_segments`,
    );
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_through_route_segments_route_order
        ON through_route_segments (through_route_id, sort_order)
    `);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}
