import { expect, test, type Page } from "@playwright/test";

async function loadSampleDatabase(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog.getByRole("button", { name: "Overwrite", exact: true }).click();
  await expect(importDialog).not.toBeVisible();
}

test("shows canonical through routes from the sample database", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.getByRole("tab", { name: /edit routes|路線を編集/i }).click();
  await page
    .getByRole("button", { name: /load sample data|サンプルデータを読み込む/i })
    .click();

  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog
    .getByRole("button", { name: /^overwrite$|^上書き$/i })
    .click();
  await expect(importDialog).not.toBeVisible();

  const tsudanumaRouteRow = page
    .getByRole("row")
    .filter({ hasText: "三鷹 → 津田沼（東西線直通）" });
  await expect(tsudanumaRouteRow).toContainText("中央・総武線各駅停車: 三鷹 → 中野");
  await expect(tsudanumaRouteRow).toContainText("東西線: 中野 → 西船橋");
  await expect(tsudanumaRouteRow).toContainText("中央・総武線各駅停車: 西船橋 → 津田沼");
  await expect(page.getByText("東葉勝田台 → 三鷹（東西線直通）")).toHaveCount(0);

  await tsudanumaRouteRow.getByRole("button").first().click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toContainText(/edit through route|直通経路を編集/i);
  await expect(editDialog.getByText(/三鷹.*→.*中野/)).toBeVisible();
  await expect(editDialog.getByText(/中野.*→.*西船橋/)).toBeVisible();
  await expect(editDialog.getByText(/西船橋.*→.*津田沼/)).toBeVisible();
});

test("aligns reversed adjacent lines in route input", async ({ page }) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: "[JC] 中央線快速" }).click();
  await page.getByRole("textbox", { name: "Stations", exact: true }).click();
  await page.getByRole("option", { name: "[JC08] 阿佐ケ谷" }).click();

  await page
    .getByRole("textbox", { name: "Previous station", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "高円寺（中央線快速）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "高円寺（中央・総武線各駅停車）" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("textbox", { name: "Next station", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "荻窪（中央線快速）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "荻窪（中央・総武線各駅停車）" }),
  ).toBeVisible();
});

test("selects and draws a through route with each section color", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await expect(page.getByText("Through Routes", { exact: true })).toBeVisible();
  await page
    .getByRole("option", {
      name: "三鷹 → 東葉勝田台（東西線直通）",
      exact: true,
    })
    .click();

  await expect(page.getByRole("textbox", { name: "From" })).toHaveValue(
    /三鷹/,
  );
  await expect(page.getByRole("textbox", { name: "To" })).toHaveValue(
    /東葉勝田台/,
  );

  const canvas = page.locator(".map-preview canvas").first();
  await expect(canvas).toBeVisible();
  const [firstSectionColor, lastSectionColor] = await canvas.evaluate(
    (element) => {
      const routeCanvas = element as HTMLCanvasElement;
      const context = routeCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas context is unavailable");
      const sample = (x: number) =>
        Array.from(context.getImageData(x, 210, 1, 1).data.slice(0, 3));
      return [sample(175), sample(routeCanvas.width - 175)];
    },
  );

  expect(firstSectionColor).toEqual([255, 212, 0]);
  expect(lastSectionColor).toEqual([120, 233, 0]);

  const canvasSize = () =>
    page
      .locator(".map-preview canvas")
      .first()
      .evaluate((element) => ({
        width: (element as HTMLCanvasElement).width,
        height: (element as HTMLCanvasElement).height,
      }));
  const baseHorizontalSize = await canvasSize();

  await page
    .getByRole("radio", { name: "Badge", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());
  await expect
    .poll(async () => (await canvasSize()).width)
    .toBe(baseHorizontalSize.width);
  const connectedBadgeColors = await page
    .locator(".map-preview canvas")
    .first()
    .evaluate((element) => {
      const routeCanvas = element as HTMLCanvasElement;
      const context = routeCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas context is unavailable");
      const pixels = context.getImageData(930, 110, 140, 90).data;
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
      };
    });
  expect(connectedBadgeColors).toEqual({
    hasChuoSobu: true,
    hasTozai: true,
  });

  await page
    .getByRole("radio", { name: "Replace Dot", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());
  await expect
    .poll(async () => (await canvasSize()).width)
    .toBeGreaterThan(baseHorizontalSize.width);

  const trackWidthSlider = page.getByRole("slider").nth(1);
  await trackWidthSlider.focus();
  await page.keyboard.press("End");
  await expect(trackWidthSlider).toHaveAttribute("aria-valuenow", "30");

  const whiteHairlineXs = await canvas.evaluate((element) => {
    const routeCanvas = element as HTMLCanvasElement;
    const context = routeCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context is unavailable");

    const centerY = 210;
    const lowerTrackY = 236;
    const centerRow = context.getImageData(
      0,
      centerY,
      routeCanvas.width,
      1,
    ).data;
    const lowerRow = context.getImageData(
      0,
      lowerTrackY,
      routeCanvas.width,
      1,
    ).data;
    const isWhite = (pixels: Uint8ClampedArray, x: number) => {
      const offset = x * 4;
      return (
        pixels[offset] > 245 &&
        pixels[offset + 1] > 245 &&
        pixels[offset + 2] > 245
      );
    };

    let firstTrackX = 0;
    while (firstTrackX < routeCanvas.width && isWhite(centerRow, firstTrackX)) {
      firstTrackX += 1;
    }
    let lastTrackX = routeCanvas.width - 1;
    while (lastTrackX > firstTrackX && isWhite(centerRow, lastTrackX)) {
      lastTrackX -= 1;
    }

    const hairlines: number[] = [];
    for (let x = firstTrackX + 40; x <= lastTrackX - 40; x += 1) {
      if (isWhite(lowerRow, x)) hairlines.push(x);
    }
    return hairlines;
  });
  expect(whiteHairlineXs).toEqual([]);

  await page
    .getByRole("radio", { name: "Vertical", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());
  await expect
    .poll(async () => (await canvasSize()).height)
    .toBeGreaterThan(baseHorizontalSize.height);
  const expandedVerticalHeight = (await canvasSize()).height;

  await page
    .getByRole("radio", { name: "Badge", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());
  await expect
    .poll(async () => (await canvasSize()).height)
    .toBeLessThan(expandedVerticalHeight);
});
