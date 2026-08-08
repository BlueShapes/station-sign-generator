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
  db.run(`DELETE FROM through_route_segments WHERE line_id = ?`, [id]);
  db.run(`DELETE FROM lines WHERE id = ?`, [id]);
}
