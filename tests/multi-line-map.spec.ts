import { expect, test, type Page } from "@playwright/test";

async function loadSampleDatabase(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();
}

test("multiple-line map includes only manually selected Marunouchi lines", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Multiple Lines)", { exact: true }).click();

  const lineSelect = page.getByRole("textbox", { name: "Lines", exact: true });
  await lineSelect.click();
  await page.getByRole("option", { name: /^\[M\]/ }).click();
  await page.keyboard.press("Escape");

  const mapCanvas = page.locator(".map-preview canvas");
  await expect(mapCanvas).toHaveCount(1);
  await expect(mapCanvas).toHaveAttribute("height", "430");

  await lineSelect.click();
  await page.getByRole("option", { name: /^\[Mb\]/ }).click();

  await page.keyboard.press("Escape");
  await expect(mapCanvas).toHaveAttribute("height", "638");

  const orderedLines = page
    .getByTestId("multi-line-order")
    .locator("[data-line-id]");
  await expect(orderedLines).toHaveCount(2);
  await expect
    .poll(() =>
      orderedLines.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-line-id")),
      ),
    )
    .toEqual(["line-marunouchi", "line-marunouchi-branch"]);

  await page
    .getByRole("button", { name: "Move down: 丸ノ内線", exact: true })
    .click();
  await expect
    .poll(() =>
      orderedLines.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-line-id")),
      ),
    )
    .toEqual(["line-marunouchi-branch", "line-marunouchi"]);

  await page
    .getByRole("button", { name: "Move up: 丸ノ内線", exact: true })
    .click();
  await expect
    .poll(() =>
      orderedLines.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-line-id")),
      ),
    )
    .toEqual(["line-marunouchi", "line-marunouchi-branch"]);

  const lineWidthSlider = page.getByRole("slider").nth(1);
  await lineWidthSlider.focus();
  await page.keyboard.press("End");
  await expect(lineWidthSlider).toHaveAttribute("aria-valuenow", "30");

  const transitSelect = page.getByRole("textbox", {
    name: "Show Transit Lines",
  });
  await transitSelect.click({ force: true });
  await page.getByRole("option", { name: /^\[JC\]/ }).click();
  await page.keyboard.press("Escape");
  await expect(mapCanvas).toHaveCount(1);
});

test("Yamanote loop and Keihin-Tohoku shared section render together", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Multiple Lines)", { exact: true }).click();
  const lineSelect = page.getByRole("textbox", { name: "Lines", exact: true });
  await lineSelect.click();
  await page.getByRole("option", { name: /^\[JY\]/ }).click();
  await lineSelect.click();
  await page.getByRole("option", { name: /^\[JK\]/ }).click();
  await page.keyboard.press("Escape");

  const orderedLines = page
    .getByTestId("multi-line-order")
    .locator("[data-line-id]");
  await expect
    .poll(() =>
      orderedLines.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-line-id")),
      ),
    )
    .toEqual(["line-yamanote", "line-keihin-tohoku"]);

  const mapCanvas = page.locator(".map-preview canvas");
  await expect(mapCanvas).toHaveCount(1);
  const dimensions = await mapCanvas.evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
  }));
  expect(dimensions.width).toBeGreaterThan(3000);
  expect(dimensions.height).toBeGreaterThan(1400);

  const routeColorPixels = await mapCanvas.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d")!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let yamanote = 0;
    let keihinTohoku = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (green > 150 && red > 90 && red < 180 && blue < 80) yamanote += 1;
      if (blue > 170 && red > 60 && red < 150 && green > 100) keihinTohoku += 1;
    }
    return { yamanote, keihinTohoku };
  });
  expect(routeColorPixels.yamanote).toBeGreaterThan(1000);
  expect(routeColorPixels.keihinTohoku).toBeGreaterThan(1000);

  await orderedLines.first().getByRole("button").last().click();
  await expect
    .poll(() =>
      orderedLines.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-line-id")),
      ),
    )
    .toEqual(["line-keihin-tohoku", "line-yamanote"]);
  await expect
    .poll(() => mapCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.width))
    .toBeGreaterThan(3000);
});
