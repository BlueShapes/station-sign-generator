import type { Database } from "sql.js";
import type { Line } from "@/db/types";

export function getAllLines(db: Database): Line[] {
  const stmt = db.prepare(
    `SELECT id, company_id, name, secondary_name, tertiary_name,
            quaternary_name, line_color, prefix, priority, is_loop,
            parent_line_id
       FROM lines
      ORDER BY priority ASC, name ASC`,
  );
  const results: Line[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      company_id: string | null;
      name: string;
      secondary_name: string | null;
      tertiary_name: string | null;
      quaternary_name: string | null;
      line_color: string;
      prefix: string;
      priority: number | null;
      is_loop: number;
      parent_line_id: string | null;
    };
    results.push({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      secondary_name: row.secondary_name ?? null,
      tertiary_name: row.tertiary_name ?? null,
      quaternary_name: row.quaternary_name ?? null,
      line_color: row.line_color,
      prefix: row.prefix,
      priority: row.priority,
      is_loop: row.is_loop ?? 0,
      parent_line_id: row.parent_line_id ?? null,
    });
  }
  stmt.free();
  return results;
}

export function getLinesByCompany(db: Database, companyId: string): Line[] {
  const stmt = db.prepare(
    `SELECT id, company_id, name, secondary_name, tertiary_name,
            quaternary_name, line_color, prefix, priority, is_loop,
            parent_line_id
       FROM lines
      WHERE company_id = ?
      ORDER BY priority ASC, name ASC`,
  );
  stmt.bind([companyId]);
  const results: Line[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      company_id: string | null;
      name: string;
      secondary_name: string | null;
      tertiary_name: string | null;
      quaternary_name: string | null;
      line_color: string;
      prefix: string;
      priority: number | null;
      is_loop: number;
      parent_line_id: string | null;
    };
    results.push({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      secondary_name: row.secondary_name ?? null,
      tertiary_name: row.tertiary_name ?? null,
      quaternary_name: row.quaternary_name ?? null,
      line_color: row.line_color,
      prefix: row.prefix,
      priority: row.priority,
      is_loop: row.is_loop ?? 0,
      parent_line_id: row.parent_line_id ?? null,
    });
  }
  stmt.free();
  return results;
}

export function upsertLine(db: Database, line: Line): void {
  db.run(
    `INSERT OR REPLACE INTO lines
      (id, company_id, name, secondary_name, tertiary_name, quaternary_name,
       line_color, prefix, priority, is_loop, parent_line_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      line.id,
      line.company_id,
      line.name,
      line.secondary_name,
      line.tertiary_name,
      line.quaternary_name,
      line.line_color,
      line.prefix,
      line.priority,
      line.is_loop,
      line.parent_line_id,
    ],
  );
}

export function deleteLine(db: Database, id: string): void {
  deleteLines(db, [id]);
}

export function deleteLines(db: Database, ids: string[]): void {
  if (ids.length === 0) return;

  db.run("SAVEPOINT delete_lines");
  try {
    // Delete dependants explicitly so cleanup also works for imported databases
    // where SQLite foreign-key enforcement may not have been enabled.
    db.run(`CREATE TEMP TABLE lines_pending_deletion (id TEXT PRIMARY KEY)`);
    const insertLine = db.prepare(
      `INSERT OR IGNORE INTO lines_pending_deletion (id) VALUES (?)`,
    );
    for (const id of ids) {
      insertLine.run([id]);
    }
    insertLine.free();

    db.run(`
      CREATE TEMP TABLE through_routes_pending_deletion (id TEXT PRIMARY KEY)
    `);
    db.run(`
      INSERT OR IGNORE INTO through_routes_pending_deletion (id)
      SELECT DISTINCT through_route_id
        FROM through_route_segments
       WHERE line_id IN (SELECT id FROM lines_pending_deletion)
    `);
    db.run(`
      DELETE FROM through_route_segments
       WHERE through_route_id IN (
         SELECT id FROM through_routes_pending_deletion
       )
    `);
    db.run(`
      DELETE FROM through_routes
       WHERE id IN (SELECT id FROM through_routes_pending_deletion)
    `);
    db.run(
      `DELETE FROM station_service_stops
        WHERE service_id IN (
          SELECT id FROM services
           WHERE line_id IN (SELECT id FROM lines_pending_deletion)
        )`,
    );
    db.run(
      `DELETE FROM services
        WHERE line_id IN (SELECT id FROM lines_pending_deletion)`,
    );
    db.run(
      `DELETE FROM station_numbers
        WHERE line_id IN (SELECT id FROM lines_pending_deletion)`,
    );
    db.run(
      `DELETE FROM station_lines
        WHERE line_id IN (SELECT id FROM lines_pending_deletion)`,
    );
    db.run(
      `UPDATE lines
          SET parent_line_id = NULL
        WHERE parent_line_id IN (SELECT id FROM lines_pending_deletion)`,
    );
    db.run(
      `DELETE FROM lines
        WHERE id IN (SELECT id FROM lines_pending_deletion)`,
    );
    db.run(`DROP TABLE through_routes_pending_deletion`);
    db.run(`DROP TABLE lines_pending_deletion`);
    db.run("RELEASE SAVEPOINT delete_lines");
  } catch (error) {
    db.run("ROLLBACK TO SAVEPOINT delete_lines");
    db.run("RELEASE SAVEPOINT delete_lines");
    throw error;
  }
}

export function deleteAllLines(db: Database): void {
  const statement = db.prepare(`SELECT id FROM lines`);
  const ids: string[] = [];
  while (statement.step()) {
    ids.push(statement.getAsObject().id as string);
  }
  statement.free();

  db.run("SAVEPOINT delete_all_lines");
  try {
    deleteLines(db, ids);
    // Also remove any empty through routes left by older database versions.
    db.run(`DELETE FROM through_route_segments`);
    db.run(`DELETE FROM through_routes`);
    db.run("RELEASE SAVEPOINT delete_all_lines");
  } catch (error) {
    db.run("ROLLBACK TO SAVEPOINT delete_all_lines");
    db.run("RELEASE SAVEPOINT delete_all_lines");
    throw error;
  }
}
