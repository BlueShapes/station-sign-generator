# Existing-station source-line selection TDD evidence

## Source and user journey

The journey was derived from the requested route-editor change: when adding an
existing station to the selected destination line, the user chooses the line
that currently contains the station before choosing the station itself.

## RED evidence

| Behavior | Command | Result | Evidence |
| --- | --- | --- | --- |
| The existing-station dialog must show a source-line selector before the station selector | `bun run test:e2e -- tests/link-existing-station.spec.ts` | FAIL | The dialog snapshot contained only the station selector; Playwright could not find the `Source line` textbox. |

## GREEN evidence

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The source-line selector appears before station selection | `tests/link-existing-station.spec.ts` | Browser/E2E | PASS |
| 2 | Station selection stays disabled until a source line is chosen | `tests/link-existing-station.spec.ts` | Browser/E2E | PASS |
| 3 | Choosing a source line exposes an eligible station from that line | `tests/link-existing-station.spec.ts` | Browser/E2E | PASS |
| 4 | Changing the source line clears the previously selected station | `tests/link-existing-station.spec.ts` | Browser/E2E | PASS |
| 5 | The new selector label exists in all 15 locale files | Locale-key count and production build | Integration | PASS |

## Coverage, verification, and known gaps

- `bun run test:e2e -- tests/link-existing-station.spec.ts`: 1 passed, 0 failed.
- `bun test scripts --coverage`: 235 passed, 0 failed; 91.67% functions and
  91.05% lines globally.
- `bun run astro check`: 0 errors, 0 warnings, 0 hints.
- `bun run build`: passed. Existing dependency externalization and chunk-size
  warnings remain unchanged.
- The E2E test uses the English UI while the new label is supplied for every
  supported locale and all locale files are parsed by the production build.

No checkpoint commits were created because project rules reserve commits for
the user.
