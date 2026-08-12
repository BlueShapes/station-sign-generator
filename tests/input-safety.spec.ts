import { expect, test } from "@playwright/test";

test.describe("Text input safety", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="tab"]', { timeout: 50_000 });
    await page.waitForTimeout(1_000);
  });

  test("limits station text and prevents preview image drops", async ({ page }) => {
    const stationInput = page.locator(".mantine-TextInput-input").first();
    const previewImage = page.locator('img[src^="data:image"]').first();

    await expect(stationInput).toHaveAttribute("maxlength", "100");
    await expect(previewImage).toHaveAttribute("draggable", "false");

    const oversized = "data:image/png;base64," + "A".repeat(1_000);
    await stationInput.evaluate((input, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("HTMLInputElement.value setter missing");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, oversized);
    await expect(stationInput).toHaveValue(oversized.slice(0, 100));

    const dropWasPrevented = await stationInput.evaluate((input) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", "data:image/png;base64,unsafe");
      return !input.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    });

    expect(dropWasPrevented).toBe(true);
    await expect(stationInput).toHaveValue(oversized.slice(0, 100));
  });

  test("allows IME composition in a special-zone abbreviation", async ({
    page,
  }) => {
    await page.getByRole("tab").nth(2).click();

    const specialZonesHeading = page.locator("h3").first();
    await specialZonesHeading.locator("..").getByRole("button").click();

    const abbreviationInput = page
      .getByRole("dialog")
      .getByRole("textbox")
      .nth(1);
    await abbreviationInput.dispatchEvent("compositionstart");
    await abbreviationInput.fill("とうきょう");
    await expect(abbreviationInput).toHaveValue("とうきょう");

    await abbreviationInput.evaluate((input) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("HTMLInputElement.value setter missing");
      setter.call(input, "東京");
      input.dispatchEvent(
        new CompositionEvent("compositionend", {
          bubbles: true,
          data: "東京",
        }),
      );
    });

    await expect(abbreviationInput).toHaveValue("東");
  });
});
