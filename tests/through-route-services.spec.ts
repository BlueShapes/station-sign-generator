import { expect, test, type Page } from "@playwright/test";

async function loadSampleDatabase(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();
}

test("configures and selects a rapid service on a through route", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  const routeName = "三鷹 → 東葉勝田台（東西線直通）";
  const routeRow = page.getByRole("row").filter({ hasText: routeName });
  await routeRow.getByRole("button").first().click();

  const routeDialog = page.getByRole("dialog");
  await expect(routeDialog).toContainText("Services");
  await expect(routeDialog.locator('input[value="Local"]')).toBeVisible();
  await routeDialog.getByPlaceholder("Service name").fill("Rapid");
  await routeDialog.getByPlaceholder("Service name").press("Enter");
  await expect(routeDialog.locator('input[value="Rapid"]')).toBeVisible();
  await routeDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(routeDialog).not.toBeVisible();

  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: routeName, exact: true }).click();
  await expect(page.getByText(`Editing service types and stops for “${routeName}”.`)).toBeVisible();
  await expect(page.getByText("Rapid", { exact: true }).first()).toBeVisible();
  const mitakaRow = page.getByRole("row").filter({ hasText: "三鷹" }).last();
  await mitakaRow.getByRole("button", { name: "×", exact: true }).last().click();

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: routeName, exact: true }).click();

  const serviceSelect = page.getByRole("textbox", {
    name: "Services",
    exact: true,
  });
  await expect(serviceSelect).toBeVisible();
  await serviceSelect.click();
  await page.getByRole("option", { name: "Rapid", exact: true }).click();
  await expect(page.getByText("Passed Stations", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await serviceSelect.click();
  await page.getByRole("option", { name: "Local", exact: true }).click();

  const canvas = page.locator(".map-preview canvas").first();
  const widthBeforeBadges = await canvas.evaluate(
    (element) => (element as HTMLCanvasElement).width,
  );
  await page
    .getByRole("radio", { name: "Badge", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(widthBeforeBadges);

  const stationNumberColors = await page
    .locator(".map-preview canvas")
    .first()
    .evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas context is unavailable");
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const hasColor = (target: [number, number, number]) => {
        for (let index = 0; index < pixels.length; index += 4) {
          if (
            Math.abs(pixels[index] - target[0]) <= 2 &&
            Math.abs(pixels[index + 1] - target[1]) <= 2 &&
            Math.abs(pixels[index + 2] - target[2]) <= 2
          ) {
            return true;
          }
        }
        return false;
      };
      return {
        hasChuoSobu: hasColor([255, 212, 0]),
        hasTozai: hasColor([0, 167, 219]),
        hasToyoRapid: hasColor([120, 233, 0]),
      };
    });

  expect(stationNumberColors).toEqual({
    hasChuoSobu: true,
    hasTozai: true,
    hasToyoRapid: true,
  });
});
