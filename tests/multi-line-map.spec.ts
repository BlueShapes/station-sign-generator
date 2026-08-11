import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

async function prepareMultipleLineMapExport(page: Page) {
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
  await expect(page.locator(".map-preview canvas")).toHaveCount(1);

  const formatSelect = page.getByRole("textbox", {
    name: "Export Format",
    exact: true,
  });
  const saveButton = page.getByRole("button", {
    name: "Save as Image",
    exact: true,
  });

  return { formatSelect, saveButton };
}

test("multiple-line maps download as vector SVG and streamed PNG", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { formatSelect, saveButton } = await prepareMultipleLineMapExport(page);

  await formatSelect.click();
  await page.getByRole("option", { name: "SVG (Vector)" }).click();
  const svgDownloadPromise = page.waitForEvent("download");
  await saveButton.click();
  const svgDownload = await svgDownloadPromise;
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
  const svgPath = await svgDownload.path();
  expect(svgPath).not.toBeNull();
  const svg = await readFile(svgPath!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("<text");
  expect(svg).toContain("@font-face");
  expect(svg).not.toContain("<image");

  await formatSelect.click();
  await page.getByRole("option", { name: "PNG" }).click();
  const sizeSelect = page.getByRole("textbox", { name: "Image Size", exact: true });
  await sizeSelect.click();
  await page.getByRole("option", { name: /\(XXL\)$/ }).click();
  const pngDownloadPromise = page.waitForEvent("download");
  await saveButton.click();
  const pngDownload = await pngDownloadPromise;
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
  const pngPath = await pngDownload.path();
  expect(pngPath).not.toBeNull();
  const png = await readFile(pngPath!);
  expect(Array.from(png.subarray(0, 8))).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(png[25]).toBe(2);
  expect(png.byteLength).toBeLessThan(5_000_000);
  expect(png.readUInt32BE(16)).toBeGreaterThan(15000);
  expect(png.readUInt32BE(20)).toBeGreaterThan(5000);
});

test("multiple-line maps download as vector PDF @pdf", async ({ page }) => {
  test.setTimeout(120000);
  const { formatSelect, saveButton } = await prepareMultipleLineMapExport(page);

  await formatSelect.click();
  await page.getByRole("option", { name: "PDF (Vector)" }).click();
  const pdfDownloadPromise = page.waitForEvent("download");
  await saveButton.click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).not.toBeNull();
  const pdf = await readFile(pdfPath!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const pdfSource = pdf.toString("latin1");
  expect(pdfSource).toContain("/Font");
  expect(pdfSource).toContain("NotoSansJP");
  expect(pdfSource).toContain("HindSemiBold");
  expect(pdfSource).toContain("Identity-H");
  expect(pdfSource).not.toContain("/Subtype /Image");
  expect(pdf.byteLength).toBeGreaterThan(200000);
});
