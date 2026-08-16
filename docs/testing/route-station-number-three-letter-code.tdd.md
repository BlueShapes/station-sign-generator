# Route-input station-number three-letter code — TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the report: when a user
selects Marunouchi Line M08 Shinjuku and adds a JR East-style station-number
badge, the badge must use `SJK` from the connected JR Shinjuku station in both
standard and branching JR East station signs.

## RED / GREEN evidence

| Stage | Command | Result | Guarantee |
| --- | --- | --- | --- |
| RED | `bun test scripts/route-station-number-selection.test.mjs` | Failed because `getSelectedStationNumberThreeLetterCode` was not exported | The regression test required code resolution from the selected badge's station rather than only the current route station. |
| GREEN | `bun test scripts/route-station-number-selection.test.mjs --coverage` | 5 passed; 100% functions and lines | A selected JR East badge supplies its connected station's code, with the current station code retained as fallback. |

## Final verification

| What is guaranteed | Command | Type | Result |
| --- | --- | --- | --- |
| Sample M08 resolves through its explicit transfer to JR Shinjuku and returns `SJK` | `bun test scripts/route-station-number-three-letter-code.test.mjs` | Integration | Passed |
| Existing route and station-number behavior remains intact | `bun test scripts --coverage` | Unit/integration | 227 passed; 92.09% functions and 91.23% lines |
| Route-input station-number browser journeys remain intact | `bunx playwright test tests/station-numbering.spec.ts` | E2E | 2 passed |
| TypeScript and Astro templates are valid | `bun run astro check` | Static check | 0 errors, warnings, or hints |
| Production output builds | `bun run build` | Build | Passed |

No intentional test gaps remain for this change. Checkpoint commits were not
created because project rules reserve commits and GPG authentication for the
user.
