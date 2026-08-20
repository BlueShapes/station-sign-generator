# Route-input station-sign filename: TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the request: as a user
saving a station sign generated from a route, I want the filename to include the
line and displayed direction so that saved images are distinguishable.

## Task report

- RED: `bun test scripts/route-sign-filename.test.mjs` failed with
  `Export named 'getRouteSignFilename' not found` before production code was
  changed.
- GREEN: after implementing the localized filename builder and all locale
  labels, the filename and existing localization targets passed 7 tests.
- Browser verification: `bun run test:e2e -- tests/route-sign-filename.spec.ts`
  confirmed the suggested filename
  `Yamanote Line_Takanawa Gateway_Right-facing.png`.
- Regression verification: `bun run test:unit` passed 242 tests, `bun run
  test:e2e` passed 38 tests, `bun run check` reported no diagnostics, and `bun
  run build` completed successfully.

## Test specification

| # | Guarantee | Test or command | Type | Result |
|---|---|---|---|---|
| 1 | A route-input filename contains the localized line, station, and direction | `scripts/route-sign-filename.test.mjs` | Unit | PASS |
| 2 | All supported locales define left, both, and right filename labels | `scripts/route-sign-filename.test.mjs` | Integration | PASS |
| 3 | The browser download exposes the complete localized PNG filename | `tests/route-sign-filename.spec.ts` | E2E | PASS |

## Coverage and merge evidence

`bun test scripts/route-sign-filename.test.mjs
scripts/localized-railway-name.test.mjs scripts/site-metadata.test.mjs
--coverage` reported 97.22% function coverage and 89.32% line coverage overall;
`src/lib/localizedRailwayName.ts` reached 100% for both. No test is skipped.
Checkpoint commits were not created because project instructions reserve commits
for the user; the RED/GREEN evidence is recorded above.
