import type { Database } from "sql.js";
import type { Company } from "@/db/types";
import { deleteLines } from "@/db/repositories/lines";

export function getAllCompanies(db: Database): Company[] {
  const stmt = db.prepare(
    `SELECT id, name, company_color, station_number_style,
            primary_language, secondary_language, tertiary_language,
            quaternary_language
       FROM companies
      ORDER BY name`,
  );
  const results: Company[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      name: string;
      company_color: string;
      station_number_style: string;
      primary_language: string;
      secondary_language: string;
      tertiary_language: string;
      quaternary_language: string;
    };
    results.push({
      id: row.id,
      name: row.name,
      company_color: row.company_color,
      station_number_style: row.station_number_style,
      primary_language: row.primary_language,
      secondary_language: row.secondary_language,
      tertiary_language: row.tertiary_language,
      quaternary_language: row.quaternary_language,
    });
  }
  stmt.free();
  return results;
}

export function upsertCompany(db: Database, company: Company): void {
  db.run(
    `INSERT OR REPLACE INTO companies
      (id, name, company_color, station_number_style, primary_language,
       secondary_language, tertiary_language, quaternary_language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      company.id,
      company.name,
      company.company_color,
      company.station_number_style,
      company.primary_language,
      company.secondary_language,
      company.tertiary_language,
      company.quaternary_language,
    ],
  );
}

export function deleteCompany(db: Database, id: string): void {
  db.run("SAVEPOINT delete_company");
  try {
    const statement = db.prepare(`SELECT id FROM lines WHERE company_id = ?`);
    statement.bind([id]);
    const lineIds: string[] = [];
    while (statement.step()) {
      lineIds.push(statement.getAsObject().id as string);
    }
    statement.free();

    deleteLines(db, lineIds);
    db.run(`DELETE FROM companies WHERE id = ?`, [id]);
    db.run("RELEASE SAVEPOINT delete_company");
  } catch (error) {
    db.run("ROLLBACK TO SAVEPOINT delete_company");
    db.run("RELEASE SAVEPOINT delete_company");
    throw error;
  }
}
