# Footer redesign verification

## User journeys

- Visitors can scan creator links and development resources as two consistent groups.
- Visitors can read creator links as circular stations on a green route and development links as rounded-square stations on a blue route.
- Visitors can open the current Misskey profile at `@aosankaku@crafters.aosankaku.net`.
- External links open safely in a new tab.
- The footer remains readable on desktop, mobile, light, and dark themes.

## RED/GREEN evidence

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| The page exposes a semantic footer with localized group headings | `tests/footer.spec.ts` failed because `getByRole("contentinfo")` found no element | `bun run test:e2e -- tests/footer.spec.ts --workers=1` — 1/1 PASS |
| Misskey points to the requested profile | The previous footer linked to profiles on `misskey.systems` and `yumk.xyz` | The footer test verifies `https://crafters.aosankaku.net/@aosankaku` |
| Every footer link uses safe new-tab attributes | The previous link markup did not consistently set `target` or `rel` | The footer test verifies `target="_blank"` and `rel="noopener noreferrer"` on every footer link |

## Visual verification

Playwright screenshots were reviewed at 1280 px and 390 px widths and with the dark color scheme. The following details were visually checked:

- The top accent line has no marker that can be clipped by the footer shell.
- Each route joins the center of its station markers without extending beyond the first or last station.
- Creator links use green circular stations, while development resources use blue rounded-square stations.
- The two-column desktop layout becomes two stacked route groups on mobile.
- The legal notice, labels, dark-theme contrast, and fixed-mobile-navigation clearance remain readable.

## Coverage and merge evidence

The repository does not configure source coverage for React components, so no percentage is claimed. The focused browser test covers the user-visible link guarantees. No commit or staging checkpoint was created for this footer change; the project reserves commits for the user.
