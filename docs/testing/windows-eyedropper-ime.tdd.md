# Windows screen-eyedropper IME mitigation TDD evidence

## Source and user journey

The journey was derived from the reported Windows/Google Japanese Input defect:
after choosing a screen color, the user must still be able to enter Japanese
without switching focus to another application window.

Because a web page cannot reliably restore a Windows third-party IME context,
the mitigation prevents the browser-supplied screen eyedropper from opening on
Windows. The in-page hue/value palette, swatches, and hexadecimal input remain
available. Other operating systems retain the screen eyedropper when supported.

## RED evidence

| Behavior | Command | Result | Evidence |
| --- | --- | --- | --- |
| Windows must not expose the native screen eyedropper | `bun test scripts/platform-color-input.test.mjs` | FAIL | `PlatformColorInput.tsx` did not exist before the mitigation. |
| The line color control must report the screen eyedropper disabled while retaining its palette | `bunx playwright test tests/input-safety.spec.ts -g "keeps the color palette but disables the Windows screen eyedropper"` | FAIL | The line color input had no disabled marker and still used Mantine's native eyedropper path. |

## GREEN evidence

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | Windows, Win32, and Windows user-agent fallbacks disable the screen eyedropper | `scripts/platform-color-input.test.mjs` | Unit | PASS |
| 2 | Non-Windows platforms retain the requested screen eyedropper | `scripts/platform-color-input.test.mjs` | Unit | PASS |
| 3 | Explicitly disabled eyedroppers remain disabled on every platform | `scripts/platform-color-input.test.mjs` | Unit | PASS |
| 4 | The Windows line-add form hides the native screen eyedropper and still opens the in-page color palette | `tests/input-safety.spec.ts` | Browser/E2E | PASS |
| 5 | Every application ColorInput uses the shared platform-safe wrapper | Source review of `DirectInput.tsx` and `EditRoutesTab.tsx` | Integration | PASS |

## Coverage, verification, and known gap

- `bun test scripts --coverage`: 235 passed, 0 failed; 91.87% functions and
  91.05% lines globally.
- `bunx playwright test tests/input-safety.spec.ts`: 4 passed, 0 failed.
- `bun run astro check`: 0 errors, 0 warnings, 0 hints.
- `bun run build`: passed. Existing dependency externalization and chunk-size
  warnings remain unchanged.
- The real operating-system Google Japanese Input state cannot be driven or
  inspected by headless Playwright. The regression guarantee is therefore that
  the problematic native EyeDropper API is unreachable on Windows.

No checkpoint commits were created because project rules reserve commits for
the user.
