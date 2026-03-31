import type { Database } from "sql.js";

/**
 * Migrate from v0.5.0 to v0.5.1
 * - Correct Tokyo Metro's default company color.
 */
export default function migrate(db: Database): void {
  try {
    db.run(
      `UPDATE companies
       SET company_color = '#00a3d9'
       WHERE name = '東京メトロ' AND company_color = '#000000'`,
    );
  } catch {
    /* ignore */
  }
}
