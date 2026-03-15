# Database Migrations

Each file in this folder handles migration from one schema version to the next.

## Naming convention

```
<from-version>_to_<to-version>.ts
```

Example: `v0.0.1_to_v0.1.0.ts`

## File structure

Each migration file must export a single default function:

```ts
import type { Database } from "sql.js";

/**
 * Migrate from vX.Y.Z to vA.B.C
 */
export default function migrate(db: Database): void {
  // ALTER TABLE / CREATE TABLE / data transforms
}
```

The function receives the live `Database` instance. It must be idempotent
(safe to run more than once). Use `IF NOT EXISTS`, `IF EXISTS`, column-
presence checks, or `INSERT OR IGNORE` as appropriate.

## Registration

After creating a migration file, register it in `src/db/init.ts` inside
`migrateDatabase()` and update `DB_VERSION` in `src/config.ts`.
