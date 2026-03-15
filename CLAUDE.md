# Project Rules for Claude

## Database schema changes

### 1. Update DB_VERSION

Whenever you modify the database schema (add/remove/rename tables or columns,
change constraints, etc.), update `DB_VERSION` in `src/config.ts` following the
versioning policy described in that file:

- **Patch** (`0.1.x`): new default data, index tweaks, no structural change
- **Minor** (`0.x.0`): structural change that is migratable (new column with a
  default, new table, data transform)
- **Major** (`x.0.0`): destructive or incompatible change where migration cannot
  reliably preserve existing data

### 2. Create a migration file

For every schema change create a migration file in `src/db/migrations/`:

**Naming:** `v<from>_to_v<to>.ts`  (e.g. `v0.1.0_to_v0.2.0.ts`)

**Template:**
```ts
import type { Database } from "sql.js";

/**
 * Migrate from vX.Y.Z to vA.B.C
 * <bullet list of what changed>
 */
export default function migrate(db: Database): void {
  // Use IF NOT EXISTS / IF EXISTS / column-presence checks to stay idempotent
}
```

**Rules:**
- The function must be **idempotent** — safe to call multiple times.
- Use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (or a column-presence check)
  instead of unconditional ALTERs.
- For table-level restructuring (column rename, type change), use the
  CREATE-new / INSERT-SELECT / DROP-old / ALTER RENAME pattern.

### 3. Save a schema snapshot

After updating `SCHEMA_SQL` in `src/db/init.ts`, overwrite `.claude/output/schema.sql`
with the full, up-to-date schema. Update the version comment on the first line:

```sql
-- Station Sign Generator — SQLite Schema (v0.2.0)
```

The file is the canonical human-readable snapshot of the **current** schema.
Previous versions are recoverable via `git log -- .claude/output/schema.sql`
or by checking out an old worktree — no need to keep separate per-version files.

### 4. Register the migration in init.ts

In `src/db/init.ts`, import the new migration and add it to the `migrations`
array inside `migrateDatabase()`:

```ts
import migrateV010toV020 from "./migrations/v0.1.0_to_v0.2.0";

function migrateDatabase(database: Database): void {
  const migrations = [
    migrateV001toV010,
    migrateV010toV020,  // ← add here, in version order
  ];
  ...
}
```

---

## Version history / aliases

| Stored in DB | Canonical label | Notes |
|---|---|---|
| `0.0.1` | v0.0.1 | Initial schema |
| `0.0.2` | v0.1.0 | **Alias** — some early databases were stamped `0.0.2` but are structurally identical to v0.1.0. The migration `v0.0.1_to_v0.1.0.ts` handles both. |
| `0.1.0` | v0.1.0 | Current schema |
