import { expect, type Locator, test } from "@playwright/test";

async function expectStandardRatioMark(slider: Locator) {
  const root = slider.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' mantine-Slider-root ')][1]",
  );
  const marks = root.locator(".mantine-Slider-mark");
  const markWrappers = root.locator(".mantine-Slider-markWrapper");

  await expect(marks).toHaveCount(1);
  await expect(root.locator(".mantine-Slider-markLabel")).toHaveCount(0);

  const offset = await markWrappers.evaluateAll((elements) =>
    elements.map((element) =>
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue("--mark-offset"),
      ),
    ),
  );
  expect(offset).toEqual([expect.closeTo(((4.5 - 2.5) / (8 - 2.5)) * 100, 5)]);
}

test("shows the standard 4.5 ratio as a small mark on JR East ratio sliders", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 50_000 });

  const directRatioSlider = page.getByRole("slider");
  await expect(directRatioSlider).toHaveCount(1);
  await expectStandardRatioMark(directRatioSlider);

  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();

  await page.getByRole("tab", { name: "From Route" }).click();

  const routeRatioSlider = page.getByRole("slider");
  await expect(routeRatioSlider).toHaveCount(1);
  await expectStandardRatioMark(routeRatioSlider);
});
