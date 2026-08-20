# JR East standard-ratio mark TDD evidence

## Source and user journey

The journey was derived from the requested UI change: when adjusting a JR East
station sign's width-to-height ratio, the user can recognize 4.5 as the standard
length from a small, unlabeled mark on the slider.

## RED evidence

| Behavior | Command | Result | Evidence |
| --- | --- | --- | --- |
| Both JR East ratio sliders show one unlabeled mark at 4.5 | `bun run test:e2e -- tests/jr-east-standard-ratio-mark.spec.ts` | FAIL | Playwright found no Mantine slider marks before the implementation. |

## GREEN evidence

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Simple input shows exactly one unlabeled ratio mark | `tests/jr-east-standard-ratio-mark.spec.ts` | Browser/E2E | PASS |
| 2 | Route input shows exactly one unlabeled ratio mark | `tests/jr-east-standard-ratio-mark.spec.ts` | Browser/E2E | PASS |
| 3 | Each mark is positioned at 4.5 within the 2.5–8.0 slider range | `tests/jr-east-standard-ratio-mark.spec.ts` | Browser/E2E | PASS |

## Coverage, verification, and known gaps

- `bun run test:e2e -- tests/jr-east-standard-ratio-mark.spec.ts`: 1 passed,
  0 failed.
- `bun run test:e2e`: 35 passed; two pre-existing pixel-polling tests timed out
  while the parallel dev server also reported transient dependency-optimization
  504 responses. Both failures passed when rerun directly with
  `bun run test:e2e -- tests/jr-east-branch-sign.spec.ts --grep "both JR East styles"`.
- `bun test scripts --coverage`: 235 passed, 0 failed; 91.67% functions and
  91.05% lines globally.
- `ASTRO_TELEMETRY_DISABLED=1 bun run check`: 0 errors, 0 warnings, 0 hints.
- `ASTRO_TELEMETRY_DISABLED=1 bun run build`: passed. Existing dependency
  externalization and chunk-size warnings remain unchanged.
- The E2E test checks the rendered Mantine mark and its computed position. No
  custom marker CSS was introduced.

No checkpoint commits were created because project rules reserve commits for
the user.
