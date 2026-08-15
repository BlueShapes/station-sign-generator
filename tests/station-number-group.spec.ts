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

test("shows a three-letter code only on the JR East badge in a mixed group", async ({
  page,
}, testInfo) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("button", { name: "Add Through Route" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Route Name" }).fill("M-JY test");

  const selectOption = async (
    label: string,
    index: number,
    option: RegExp,
  ) => {
    await dialog.getByRole("textbox", { name: label, exact: true }).nth(index).click();
    await page.getByRole("option", { name: option }).click();
  };

  await selectOption("Line", 0, /^\[M\]/);
  await selectOption("Entry Station", 0, /^\[M07\]/);
  await selectOption("Exit Station", 0, /^\[M08\]/);
  await dialog.getByRole("button", { name: "Add Line Section" }).click();
  await selectOption("Line", 1, /^\[JY\]/);
  await selectOption("Entry Station", 1, /^\[JY17\]/);
  await selectOption("Exit Station", 1, /^\[JY16\]/);
  await selectOption("Section Direction", 1, /^Reverse/);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: "M-JY test", exact: true }).click();
  await page
    .getByRole("radio", { name: "Badge", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());

  const preview = page.locator(".map-preview");
  await expect(preview.locator("canvas")).toBeVisible();
  await preview.screenshot({
    path: testInfo.outputPath("mixed-station-number-group.png"),
  });

  const hasJrEastHeader = await preview.locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context is unavailable");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let greenNearBlack = 0;
    for (let y = 8; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const isGreen =
          pixels[index] > 80 &&
          pixels[index] < 180 &&
          pixels[index + 1] > 140 &&
          pixels[index + 2] < 100;
        if (!isGreen) continue;
        const above = ((y - 8) * canvas.width + x) * 4;
        if (
          pixels[above] < 20 &&
          pixels[above + 1] < 20 &&
          pixels[above + 2] < 20
        ) {
          greenNearBlack += 1;
        }
      }
    }
    return greenNearBlack > 5;
  });
  expect(hasJrEastHeader).toBe(true);
});

test("shares one three-letter-code header across connected JR East badges", async ({
  page,
}, testInfo) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("button", { name: "Add Through Route" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Route Name" }).fill("JY-JC test");
  const selectOption = async (
    label: string,
    index: number,
    option: RegExp,
  ) => {
    await dialog.getByRole("textbox", { name: label, exact: true }).nth(index).click();
    await page.getByRole("option", { name: option }).click();
  };

  await selectOption("Line", 0, /^\[JY\]/);
  await selectOption("Entry Station", 0, /^\[JY16\]/);
  await selectOption("Exit Station", 0, /^\[JY17\]/);
  await dialog.getByRole("button", { name: "Add Line Section" }).click();
  await selectOption("Line", 1, /^\[JC\]/);
  await selectOption("Entry Station", 1, /^\[JC05\]/);
  await selectOption("Exit Station", 1, /^\[JC06\]/);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: "JY-JC test", exact: true }).click();
  await page
    .getByRole("radio", { name: "Badge", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());

  const preview = page.locator(".map-preview");
  await preview.screenshot({
    path: testInfo.outputPath("shared-station-number-group.png"),
  });
  const sharedFrame = await preview.locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context is unavailable");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const isBlack = (x: number, y: number) => {
      const index = (y * canvas.width + x) * 4;
      return (
        pixels[index] < 20 &&
        pixels[index + 1] < 20 &&
        pixels[index + 2] < 20
      );
    };
    let longest = 0;
    let longestStart = 0;
    let longestEnd = 0;
    let longestY = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      let current = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        current = isBlack(x, y) ? current + 1 : 0;
        if (current > longest) {
          longest = current;
          longestStart = x - current + 1;
          longestEnd = x;
          longestY = y;
        }
      }
    }

    const longestVerticalRun = (x: number) => {
      let current = 0;
      let result = 0;
      const startY = Math.max(0, longestY - 8);
      const endY = Math.min(canvas.height, longestY + 90);
      for (let y = startY; y < endY; y += 1) {
        current = isBlack(x, y) ? current + 1 : 0;
        result = Math.max(result, current);
      }
      return result;
    };

    return {
      longest,
      leftBorderHeight: longestVerticalRun(longestStart + 1),
      rightBorderHeight: longestVerticalRun(longestEnd - 1),
    };
  });
  expect(sharedFrame.longest).toBeGreaterThan(70);
  expect(sharedFrame.leftBorderHeight).toBeGreaterThan(40);
  expect(sharedFrame.rightBorderHeight).toBeGreaterThan(40);
});
