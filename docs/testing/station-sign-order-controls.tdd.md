# Station-sign badge and center-color ordering — TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the request: a user can
reorder selected station-number badges and center-square colors without removing
and re-adding them, in both the standard and branching JR East station signs.

## RED / GREEN evidence

| Stage | Command | Result | Guarantee |
| --- | --- | --- | --- |
| RED | `bunx playwright test tests/station-numbering.spec.ts --grep "route-input station signs"` | Failed because `station-number-order` was absent | The reproducer reached a station with two selected badges and proved that no reorder control existed. |
| GREEN | `bunx playwright test tests/station-numbering.spec.ts --grep "route-input station signs" --reporter=line` | 1 passed | The user can move the Tozai badge and center color ahead of the Chuo Line selection, and both controls remain available after switching to the branching style. |

## Final verification

| What is guaranteed | Command | Type | Result |
| --- | --- | --- | --- |
| Ordered-ID moves preserve the selection and change only its order | `bun test scripts --coverage` | Unit | 224 passed; `orderedIds.ts` 100% functions and lines |
| Standard and branching station signs expose working order controls | `bunx playwright test tests/station-numbering.spec.ts` | E2E | 2 passed |
| TypeScript and Astro templates are valid | `bun run astro check` | Static check | 0 errors, warnings, or hints |
| Production output builds | `bun run build` | Build | Passed |

Overall unit coverage was 91.84% functions and 90.98% lines. No intentional test
gaps remain for this change. Checkpoint commits were not created because project
rules reserve commits and GPG authentication for the user.
