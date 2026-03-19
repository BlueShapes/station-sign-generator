import type { Database } from "sql.js";
import type { Company } from "@/db/types";

export function getAllCompanies(db: Database): Company[] {
  const stmt = db.prepare(
    `SELECT id, name, company_color, station_number_style FROM companies ORDER BY name`,
  );
  const results: Company[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      name: string;
      company_color: string;
      station_number_style: string;
    };
    results.push({
      id: row.id,
      name: row.name,
      company_color: row.company_color,
      station_number_style: row.station_number_style,
    });
  }
  stmt.free();
  return results;
}

export function upsertCompany(db: Database, company: Company): void {
  db.run(
    `INSERT OR REPLACE INTO companies (id, name, company_color, station_number_style) VALUES (?, ?, ?, ?)`,
    [company.id, company.name, company.company_color, company.station_number_style],
  );
}

export function deleteCompany(db: Database, id: string): void {
  db.run(`DELETE FROM companies WHERE id = ?`, [id]);
}
