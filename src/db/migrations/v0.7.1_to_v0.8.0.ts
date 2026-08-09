import type { Database } from "sql.js";

/**
 * Migrate from v0.7.1 to v0.8.0
 * - Adds explicit, symmetric transfer connections between distinct stations.
 */
export default function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS station_transfers (
      id           TEXT PRIMARY KEY,
      station_a_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      station_b_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      CHECK (station_a_id < station_b_id),
      UNIQUE (station_a_id, station_b_id)
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_station_transfers_station_b
      ON station_transfers (station_b_id)
  `);
}
