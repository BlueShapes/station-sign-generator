import { test, expect } from "@playwright/test";

/**
 * Performance test: typing in form inputs should be fast (no blocking re-renders).
 * The preview canvas does NOT need to update in real-time — it's debounced.
 */
test.describe("Input performance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // The app shows a font-loading spinner. Tabs only appear after hydration.
    await page.waitForSelector('[role="tab"]', { timeout: 50000 });
    // Wait for React to finish rendering the tab panel
    await page.waitForTimeout(3000);
  });

  test("typing in station name input should be fast (< 1s overhead for 20 chars)", async ({
    page,
  }) => {
    // Mantine TextInput inputs have class "mantine-TextInput-input"
    // (Select inputs use "mantine-Select-input" and are readonly)
    const textInputs = page.locator(".mantine-TextInput-input");
    const count = await textInputs.count();
    console.log(`Found ${count} TextInput elements`);
    expect(count).toBeGreaterThan(0);

    const stationInput = textInputs.first();
    await stationInput.scrollIntoViewIfNeeded();
    await stationInput.click();
    await stationInput.fill("");

    const testText = "TestStationPerformance20";
    const delayPerChar = 20; // ms between keystrokes

    const start = Date.now();
    await stationInput.pressSequentially(testText, { delay: delayPerChar });
    const elapsed = Date.now() - start;

    // Minimum time: testText.length * delayPerChar
    // With the fix, UI overhead should be < 800ms for 24 chars.
    // Old code would take 3-5s due to Konva re-render on every keystroke.
    const minExpected = testText.length * delayPerChar;
    const maxAllowed = minExpected + 800;

    console.log(
      `Typing ${testText.length} chars: ${elapsed}ms (min: ${minExpected}ms, max allowed: ${maxAllowed}ms)`,
    );
    expect(elapsed).toBeLessThan(maxAllowed);
    await expect(stationInput).toHaveValue(testText);
  });

  test("preview image does not update synchronously while typing", async ({
    page,
  }) => {
    // The sign preview is rendered to canvas then shown as a data-URL <img>
    const previewImg = page.locator('img[src^="data:image"]').first();
    await expect(previewImg).toBeVisible({ timeout: 10000 });

    // Find station name input (first actual TextInput, not a Select)
    const stationInput = page.locator(".mantine-TextInput-input").first();
    await stationInput.scrollIntoViewIfNeeded();
    await stationInput.click();
    await stationInput.fill("");

    // Capture initial preview image src
    const initialSrc = await previewImg.getAttribute("src");

    // Type a single character
    await stationInput.pressSequentially("X", { delay: 10 });

    // Immediately after — preview should NOT have updated yet (debounced 400ms)
    const immediateSrc = await previewImg.getAttribute("src");
    expect(immediateSrc).toEqual(initialSrc);

    // After debounce (400ms) + render time, preview should update
    await page.waitForTimeout(800);
    const updatedSrc = await previewImg.getAttribute("src");
    expect(updatedSrc).not.toEqual(initialSrc);
  });
});
