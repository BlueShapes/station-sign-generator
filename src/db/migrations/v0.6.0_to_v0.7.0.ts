import type { Database } from "sql.js";

function getColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`);
  return new Set(
    result.length ? result[0].values.map((row) => String(row[1])) : [],
  );
}

function addColumnIfMissing(
  db: Database,
  table: string,
  columns: Set<string>,
  name: string,
  definition: string,
): void {
  if (columns.has(name)) return;
  db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  columns.add(name);
}

/**
 * Migrate from v0.6.0 to v0.7.0
 * - Adds the ordered display languages owned by each railway company.
 * - Adds second through fourth language names to each line.
 */
export default function migrate(db: Database): void {
  const companyColumns = getColumns(db, "companies");
  addColumnIfMissing(
    db,
    "companies",
    companyColumns,
    "primary_language",
    "TEXT NOT NULL DEFAULT 'ja'",
  );
  addColumnIfMissing(
    db,
    "companies",
    companyColumns,
    "secondary_language",
    "TEXT NOT NULL DEFAULT 'en'",
  );
  addColumnIfMissing(
    db,
    "companies",
    companyColumns,
    "tertiary_language",
    "TEXT NOT NULL DEFAULT 'ko'",
  );
  addColumnIfMissing(
    db,
    "companies",
    companyColumns,
    "quaternary_language",
    "TEXT NOT NULL DEFAULT 'zh-CN'",
  );

  const lineColumns = getColumns(db, "lines");
  addColumnIfMissing(db, "lines", lineColumns, "secondary_name", "TEXT");
  addColumnIfMissing(db, "lines", lineColumns, "tertiary_name", "TEXT");
  addColumnIfMissing(db, "lines", lineColumns, "quaternary_name", "TEXT");
}
