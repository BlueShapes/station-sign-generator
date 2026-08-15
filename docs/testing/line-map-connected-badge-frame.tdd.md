# Line-map connected badge frame regression

## Source and user journey

No plan file was provided. The journey was derived from the reported production
regression: as a route-map user, I want connected JR East station-number badges
to retain the same visible black outer frame as the simple-input station sign.

## RED and GREEN evidence

| Stage | Command | Result | Guarantee |
| --- | --- | --- | --- |
| RED | `bun test scripts/transit-line-layout.test.mjs` | Failed because `layoutConnectedMarkersInsideFrame` did not exist | The new test exercised the missing framed-marker geometry before production code changed |
| GREEN | `bun test scripts/transit-line-layout.test.mjs` | 30 passed, 0 failed | Two stroked badges retain a two-unit black frame on both sides and between badges, matching the scaled station-sign width |
| Browser | `bunx playwright test tests/station-number-group.spec.ts tests/through-routes.spec.ts` | 5 passed, 0 failed | Single/through route-map rendering keeps both side borders visible and preserves through-route behavior |

## Coverage and checks

- `bun test --coverage scripts/transit-line-layout.test.mjs`: 85.87% functions
  and 82.52% lines overall; `lineMapGeometry.ts` reached 95.24% functions and
  95.60% lines.
- `bun run test:unit`: 221 passed, 0 failed.
- `bun run astro check`: 0 errors, warnings, or hints.
- `bun run build`: passed. Existing sql.js browser-externalization and large
  chunk warnings remain unchanged.

## Merge evidence

No checkpoint commits were created because the project workflow reserves commit
signing for the user. The RED/GREEN commands and results above preserve the TDD
evidence if the final change is squashed.
