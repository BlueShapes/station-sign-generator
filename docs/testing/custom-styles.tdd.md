# Custom styles TDD evidence

## Source and user journeys

The journeys were derived from the feature request in this task; no external plan file was used.

- A user can upload a font and keep it available in Settings.
- A user can create independent station-sign, station-number-badge, and route-badge definitions from existing templates.
- A user can preview each unsaved custom-style draft with the simple-input default station while changing its template, font, and layout.
- A custom station sign can override font family, font size, letter spacing, and Y offset for every non-number text role.
- Uploaded font binaries used by a custom definition remain embedded in that definition.
- A user can duplicate a custom station-sign style without sharing its identity or mutable font buffers.
- A user can edit a custom station-sign style while preserving its existing identity and creation time.
- JR Central adjacent station readings remain on one line when a custom font is wider than the template font.
- Every station-sign template keeps non-number text on one line and fits wider custom fonts into the template text box unless an advanced font size was explicitly selected.
- Existing railway databases migrate without losing their prior route-badge appearance.

## RED / GREEN evidence

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Typed custom definition model and badge registries | `bun test scripts/custom-styles.test.mjs` failed because `src/customization/model.ts` did not exist | Same target: 9 passing tests | The three definition kinds stay distinct, template resolution works, and text overrides preserve zero-valued spacing/offsets |
| Independent route-badge database reference | `bun test scripts/custom-route-badge-migration.test.mjs` failed because `v0.10.0_to_v0.11.0.ts` did not exist | Same target: 2 passing tests | The migration is idempotent and copies the old shared company style into the new route-badge column |
| Multiple embedded fonts | Target test failed with `definition.fonts` undefined | Same target passes | Definitions can carry multiple uploaded font binaries used by different text roles |
| Custom text property resolution | Target test failed because `customSignTextLayout.ts` did not exist | Same target passes | Font, size, letter spacing, and Y offset override only the corresponding text configuration |
| Complete browser journey | Initial Playwright run exposed an unstable-array loop in `useCanvasFonts`; after stabilizing identical font-spec arrays, the flow passed | `bun run test:e2e -- tests/custom-styles.spec.ts`: 1 passed | Upload, embedded-font save, advanced layout, all three creators, reload persistence, and custom sign selection work in Chromium |
| Live draft previews | `bun test scripts/custom-styles.test.mjs` failed because `CustomStylePreview.tsx` did not exist; the first browser run then showed that the station-sign Stage ref was missing | Unit target: 10 passing tests; `bun run test:e2e -- tests/custom-styles.spec.ts`: 1 passed | All three creators render the unsaved draft, use the high-Takanawa simple-input defaults, and refresh the station-sign image after font changes |
| JR Central custom-font wrapping | `bun test scripts/jr-central-sign.test.mjs scripts/custom-styles.test.mjs` failed because `getJrCentralAdjacentTextLayout` was not exported | Same target: 22 passing tests; DotGothic16 browser journey: 1 passed | Left and right adjacent readings use fixed, single-line text boxes with side-specific alignment instead of widths measured using the template font |
| All-template custom-font wrapping | `bun test scripts/custom-styles.test.mjs` failed because the common fit helpers were not exported | Same target: 15 passing tests; DotGothic16 browser journey: 2 passed | All ten station-sign templates use the common one-line renderer, which measures the resolved custom font and shrinks only when a width-affecting override would overflow |
| Duplicate and edit station-sign styles | The updated Playwright journey timed out waiting for the missing `複製: E2E カスタム駅名標` button | Focused Playwright journey: 1 passed; full suite with four workers: 42 passed | Duplication creates a separately persisted record and editing updates the original record, including embedded fonts and advanced layout values |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Custom sign, station-number badge, and route badge records are different discriminated types | `scripts/custom-styles.test.mjs` | unit | PASS |
| 2 | All ten non-number text roles are available for advanced layout | `scripts/custom-styles.test.mjs` | unit | PASS |
| 3 | Font size, letter spacing, and offsets are normalized safely | `scripts/custom-styles.test.mjs` | unit | PASS |
| 4 | Uploaded font data survives inside custom definitions, including multiple fonts | `scripts/custom-styles.test.mjs` | unit | PASS |
| 5 | Custom badge IDs resolve to their base geometry and selected font | `scripts/custom-styles.test.mjs` | unit | PASS |
| 6 | The v0.10.0 → v0.11.0 migration is idempotent and appearance-preserving | `scripts/custom-route-badge-migration.test.mjs` | integration | PASS |
| 7 | The settings workflow persists and is usable after reload | `tests/custom-styles.spec.ts` | E2E | PASS |
| 8 | Unsaved station-sign and badge drafts show a live preview based on `DEFAULT_DATA` | `scripts/custom-styles.test.mjs`, `tests/custom-styles.spec.ts` | unit + E2E | PASS |
| 9 | JR Central adjacent names keep a fixed one-line region for both left and right sides | `scripts/jr-central-sign.test.mjs` | unit | PASS |
| 10 | A duplicated sign gets a new ID and independent font binary while retaining its template and layout | `scripts/custom-styles.test.mjs` | unit | PASS |
| 11 | Editing preserves the sign ID and creation time while updating its editable fields | `scripts/custom-styles.test.mjs` | unit | PASS |
| 12 | Create, duplicate, edit, reload, and select work as one browser journey | `tests/custom-styles.spec.ts` | E2E | PASS |
| 13 | Every sign template renders a width-changing custom font without automatic line wrapping | `scripts/custom-styles.test.mjs`, `tests/custom-styles.spec.ts` | unit + E2E | PASS |

## Coverage and remaining gaps

The focused command `bun test --coverage scripts/custom-styles.test.mjs scripts/jr-central-sign.test.mjs` reports 96.73% functions and 98.10% lines, with 100% function and line coverage for the common text-layout helper. The full unit suite has 263 passing tests. The full Chromium suite completed 42 tests before one transient development-server `ERR_CONNECTION_FAILED`; the affected two-test file then passed independently, as did the three focused font-loading/performance tests. DotGothic16 was supplied through `CUSTOM_STYLE_FONT_FIXTURE` and visually verified in all ten station-sign template previews. Pixel-by-pixel baselines for every custom value are not included; the renderers retain their existing geometry tests and the shared one-line fitting path is unit-tested.

No checkpoint commits were created because this repository requires the user to perform GPG-authenticated commits.
