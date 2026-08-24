# Right-facing station-sign default: TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the request: as a user
creating a station sign in Japan, I want it to face right by default so that the
initial direction follows left-hand railway traffic.

## Task report

- Default behavior: `bun test scripts/default-direction.test.mjs` initially
  failed because the v0.9.0-to-v0.10.0 migration did not exist. After the shared
  default, consumers, schema, and migration were implemented, the same target
  passed 4 tests.
- Sample database: the targeted test then failed with the shipped default
  `'left'` and metadata version `0.9.0`. Regenerating the sample database made
  the same test pass with `'right'` and `0.10.0`.
- Regression verification: `bun run test:unit` passed 239 tests, `bun run
  test:e2e` passed 37 tests, `bun run check` reported no diagnostics, and `bun
  run build` completed successfully.

## Test specification

| # | Guarantee | Test or command | Type | Result |
|---|---|---|---|---|
| 1 | New direct-input and route-input signs share the right-facing default | `scripts/default-direction.test.mjs` | Unit | PASS |
| 2 | Fresh and sample databases default new sign settings to `right` | `scripts/default-direction.test.mjs` | Integration | PASS |
| 3 | Migration preserves an existing explicit `left` value and is idempotent | `scripts/default-direction.test.mjs` | Integration | PASS |
| 4 | Existing browser workflows remain functional | `bun run test:e2e` | E2E | PASS (37/37) |

## Coverage and merge evidence

`bun test scripts/default-direction.test.mjs --coverage` reported 100% function
coverage and 96.59% line coverage across the targeted files. No test is skipped.
Checkpoint commits were not created because project instructions reserve commits
for the user; the RED/GREEN evidence is recorded above for later squashing or PR
documentation.
