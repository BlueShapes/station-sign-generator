import type { Database } from "sql.js";
import type { Line } from "@/db/types";

export function getAllLines(db: Database): Line[] {
  const stmt = db.prepare(
    `SELECT id, company_id, name, line_color, prefix, priority FROM lines ORDER BY priority ASC, name ASC`,
  );
  const results: Line[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      company_id: string | null;
      name: string;
      line_color: string;
      prefix: string;
      priority: number | null;
    };
    results.push({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      line_color: row.line_color,
      prefix: row.prefix,
      priority: row.priority,
    });
  }
  stmt.free();
  return results;
}

export function getLinesByCompany(db: Database, companyId: string): Line[] {
  const stmt = db.prepare(
    `SELECT id, company_id, name, line_color, prefix, priority FROM lines WHERE company_id = ? ORDER BY priority ASC, name ASC`,
  );
  stmt.bind([companyId]);
  const results: Line[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      company_id: string | null;
      name: string;
      line_color: string;
      prefix: string;
      priority: number | null;
    };
    results.push({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      line_color: row.line_color,
      prefix: row.prefix,
      priority: row.priority,
    });
  }
  stmt.free();
  return results;
}

export function upsertLine(db: Database, line: Line): void {
  db.run(
    `INSERT OR REPLACE INTO lines (id, company_id, name, line_color, prefix, priority) VALUES (?, ?, ?, ?, ?, ?)`,
    [line.id, line.company_id, line.name, line.line_color, line.prefix, line.priority],
  );
}

export function deleteLine(db: Database, id: string): void {
  db.run(`DELETE FROM lines WHERE id = ?`, [id]);
}
