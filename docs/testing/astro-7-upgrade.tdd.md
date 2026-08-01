# Astro 7 upgrade verification

## Source and user journeys

The journeys were derived from the Astro 7 upgrade verification request.

- A production build can load YAML translations through Vite 8.
- Database import E2E tests use a fixture that is part of the repository.
- Form responsiveness is measured without Playwright transport latency.
- The Marunouchi branch-numbering flow can load sample data and select the intended controls.
- A single project command runs both unit and E2E suites against a local server.

## RED/GREEN evidence

| Guarantee | RED evidence | GREEN command and result |
| --- | --- | --- |
| YAML locales build with Astro 7 / Vite 8 | `bun run build` parsed `src/locales/en.yml` as JavaScript and failed at line 1 | `bun run build` — PASS, 4 pages built |
| SQLite overwrite and merge use an available fixture | Both tests failed with `ENOENT` for `.claude/output/sample.sqlite` | `bun run test:e2e -- tests/import-db.spec.ts --workers=1` — 3/3 PASS |
| Input responsiveness is measured in the browser | Parallel E2E run measured 1590 ms against a 1280 ms limit because runner scheduling was included | `bun run test` — performance test PASS at 577 ms during the 7-worker run |
| Marunouchi branch station numbering is selectable | Test timed out first on the import modal, then on fuzzy selectors that matched the hidden station-sign radio | `bun run test:e2e -- tests/station-numbering.spec.ts --workers=1` — 1/1 PASS |
| Complete verification remains green | Initial build and 4 of 7 E2E tests failed | `bun run test` — 11/11 unit and 7/7 E2E PASS; `bun run check` — 0 errors; `bun run build` — PASS |

## Coverage and known gaps

The repository has no configured source-coverage command or threshold, so no percentage is claimed. The full existing unit and browser suites were executed without skips. Astro check reports zero errors, warnings, and hints. The production build still reports existing `sql.js` browser-externalization and large-chunk warnings.

## Merge evidence

No checkpoint commits were created because the project rules reserve commits for the user. The RED/GREEN evidence above is intended to remain valid if these working-tree changes are later squashed.
