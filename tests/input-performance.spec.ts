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

    // Measure in the browser so Playwright transport and worker scheduling do
    // not count as UI latency. One animation frame per character still lets
    // React render each controlled-input update.
    const elapsed = await stationInput.evaluate(async (input, text) => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!valueSetter) throw new Error("HTMLInputElement.value setter missing");

      const start = performance.now();
      let value = "";
      for (const character of text) {
        value += character;
        valueSetter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      return performance.now() - start;
    }, testText);

    // A healthy controlled input should process 24 updates well below 1s.
    // The previous synchronous Konva rendering path took 3-5s.
    const maxAllowed = 1000;

    console.log(
      `Typing ${testText.length} chars: ${elapsed}ms (max allowed: ${maxAllowed}ms)`,
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
