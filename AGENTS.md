# Project Rules for Codex

## Localization

- Every locale file in `src/locales/` must contain the same complete set of
  translation keys.
- Whenever a translation key is added, removed, renamed, or moved, update all
  locale files in the same change. Do not leave new keys translated in only a
  subset of supported languages.
- Preserve interpolation placeholders such as `{name}` and `{detail}` in every
  translation.
- Use the locale codes and metadata in `src/i18n/locales.ts` as the canonical
  list of supported languages.
- Keep Hong Kong Traditional Chinese (`zh-HK`) and Taiwanese Traditional
  Chinese (`zh-TW`) as separate translations, using region-appropriate terms.

## Station-sign and route-map visual geometry

- Treat each rendering context as its own visual system. Station signs,
  positions within a sign, station-number badges, and route maps may need
  different font sizes, line heights, spacing, and optical alignment even when
  they display the same data.
- Do not share a font size, baseline, offset, stroke width, corner radius, or
  badge dimension merely because two elements have the same meaning. Share
  geometry only when the designs intentionally use the same reference shape.
- Extract a small typed metrics or geometry helper when several dimensions are
  coupled, when values scale from a reference size, or when multiple consumers
  intentionally share the same geometry. Keep genuine one-off optical
  corrections local to their rendering context.
- Derive scaled values from one named reference size instead of scattering
  magic-number ratios through JSX. Name offsets by their visual purpose, such
  as an outer-frame lift or a text-baseline correction.
- Keep context-specific optical corrections explicit. Do not move a correction
  into a generic shared component if that would alter unrelated badge styles,
  sign layouts, or route-map rendering.
- Before modifying an established shared component or helper, inspect all call
  sites and relevant Git history to understand why it was shared and which
  variants it supports. Preserve unaffected variants, or split the helper when
  the consumers no longer share the same visual geometry.
- Remember that canvas and SVG strokes are normally centered on their paths.
  Define nominal bounds and stroke thickness separately when the visible outer
  edge or uniform border weight matters.
- Verify geometry changes at every affected size and variant, including single
  and connected badges, applicable railway styles, sign positions, and route-map
  orientations. Add or update unit tests for derived metrics and use a rendered
  browser/image regression when pixel placement or stroke thickness is relevant.
- The JR East station-sign frame metrics are defined in
  `src/components/signs/stationNumberBadgeFrame.ts`. Extend that helper only for
  the same reference geometry; create a context-specific helper for route maps
  or other layouts whose typography or geometry differs.

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

After updating `SCHEMA_SQL` in `src/db/init.ts`, overwrite `.Codex/output/schema.sql`
with the full, up-to-date schema. Update the version comment on the first line:

```sql
-- Station Sign Generator — SQLite Schema (v0.2.0)
```

The file is the canonical human-readable snapshot of the **current** schema.
Previous versions are recoverable via `git log -- .Codex/output/schema.sql`
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
