import type { Database } from "sql.js";

function getColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`);
  return new Set(
    (result[0]?.values ?? []).map((row) => String(row[1])),
  );
}

/**
 * Migrate from v0.8.0 to v0.9.0
 * - Allows a service type to belong to either a line or a through route.
 */
export default function migrate(db: Database): void {
  if (getColumns(db, "services").has("through_route_id")) return;

  db.run("SAVEPOINT migrate_v080_to_v090");
  try {
    db.run(`
      CREATE TABLE services_v090 (
        id               TEXT PRIMARY KEY,
        line_id          TEXT REFERENCES lines(id) ON DELETE CASCADE,
        through_route_id TEXT REFERENCES through_routes(id) ON DELETE CASCADE,
        name             TEXT NOT NULL,
        color            TEXT NOT NULL DEFAULT '#8cc800',
        sort_order       INTEGER DEFAULT 0,
        CHECK ((line_id IS NOT NULL) <> (through_route_id IS NOT NULL))
      )
    `);
    db.run(`
      INSERT INTO services_v090
        (id, line_id, through_route_id, name, color, sort_order)
      SELECT id, line_id, NULL, name, color, sort_order
        FROM services
    `);
    db.run(`
      CREATE TABLE station_service_stops_v090 (
        id         TEXT PRIMARY KEY,
        station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        service_id TEXT NOT NULL REFERENCES services_v090(id) ON DELETE CASCADE,
        status     TEXT NOT NULL DEFAULT 'stop'
      )
    `);
    db.run(`
      INSERT INTO station_service_stops_v090
        (id, station_id, service_id, status)
      SELECT id, station_id, service_id, status
        FROM station_service_stops
    `);
    db.run(`DROP TABLE station_service_stops`);
    db.run(`DROP TABLE services`);
    db.run(`ALTER TABLE services_v090 RENAME TO services`);
    db.run(
      `ALTER TABLE station_service_stops_v090 RENAME TO station_service_stops`,
    );
    db.run("RELEASE SAVEPOINT migrate_v080_to_v090");
  } catch (error) {
    db.run("ROLLBACK TO SAVEPOINT migrate_v080_to_v090");
    db.run("RELEASE SAVEPOINT migrate_v080_to_v090");
    throw error;
  }
}
