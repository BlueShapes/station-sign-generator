# IME service-name submission TDD evidence

## Source and user journey

The journey was derived from the reported defect: a user can compose a Japanese
service name while adding a line, confirm the IME conversion with Enter, and
then press Enter again to add the completed service name.

## RED evidence

| Behavior | Command | Result | Evidence |
| --- | --- | --- | --- |
| IME confirmation must not add or clear the draft service | `bunx playwright test tests/input-safety.spec.ts -g "does not add a service while IME composition is being confirmed"` | FAIL | The page snapshot showed `かいそく` added as a second service and the draft input cleared immediately after a composing Enter. |
| The submit predicate must distinguish normal Enter from IME Enter | `bun test scripts/ime-submit.test.mjs` | FAIL | The new `imeSubmit.ts` module did not exist before the fix. |

The first browser run had to be repeated outside the filesystem sandbox because
Astro telemetry initialization could not create its user configuration folder.

## GREEN evidence

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | A normal Enter submits a completed service name | `scripts/ime-submit.test.mjs` | Unit | PASS |
| 2 | Enter does not submit while `isComposing` is true | `scripts/ime-submit.test.mjs` | Unit | PASS |
| 3 | Legacy IME keyboard events with key code 229 do not submit | `scripts/ime-submit.test.mjs` | Unit | PASS |
| 4 | The line-add dialog preserves the composing Japanese text and adds it only after composition ends | `tests/input-safety.spec.ts` | Browser/E2E | PASS |
| 5 | The project remains type-safe and builds for production | `bun run astro check`; `bun run build` | Static/build | PASS |

## Coverage and final verification

- `bun test scripts --coverage`: 231 passed, 0 failed; 92.28% functions and
  91.44% lines globally; `imeSubmit.ts` reached 100% function and line coverage.
- `bunx playwright test tests/input-safety.spec.ts`: 3 passed, 0 failed.
- `bun run astro check`: 0 errors, 0 warnings, 0 hints.
- `bun run build`: passed. Existing dependency externalization and chunk-size
  warnings remain unchanged.

The same predicate is used by line creation, through-route creation, and the
saved-route service editor. No checkpoint commits were created because project
rules reserve commits for the user.
