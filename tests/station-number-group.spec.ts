import { expect, test, type Locator, type Page } from "@playwright/test";

async function loadSampleDatabase(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();
}

async function setStationThreeLetterCode(
  page: Page,
  line: RegExp,
  stationName: string,
  code: string,
) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: line }).click();

  const stationRow = page
    .getByRole("row")
    .filter({ has: page.getByText(stationName, { exact: true }) });
  await stationRow.locator("button:has(svg.tabler-icon-edit)").click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Three Letter Code" })
    .fill(code);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function setMarunouchiAsLoopLine(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  const lineRow = page
    .getByRole("row")
    .filter({ has: page.getByText("丸ノ内線", { exact: true }) });
  await lineRow.locator("button:has(svg.tabler-icon-edit)").click();
  const dialog = page.getByRole("dialog");
  const loopSwitch = dialog.getByRole("switch", {
    name: "Loop Line (circular route)",
  });
  await loopSwitch.evaluate((element) =>
    (element as HTMLInputElement).click(),
  );
  await expect(loopSwitch).toBeChecked();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function stableCanvasSnapshot(canvas: Locator) {
  await expect(canvas).toBeVisible();
  let previous = "";
  await expect
    .poll(async () => {
      const current = await canvas.evaluate((element) =>
        (element as HTMLCanvasElement).toDataURL(),
      );
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);
  return canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
    image: (element as HTMLCanvasElement).toDataURL(),
  }));
}

async function openVerticalMarunouchiBadgeMap(page: Page) {
  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page
    .getByRole("option", { name: "[M] 丸ノ内線", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Vertical", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());
  await page
    .getByRole("radio", { name: "Badge", exact: true })
    .evaluate((element) => (element as HTMLInputElement).click());

  const canvas = page.locator(".map-preview canvas").first();
  return stableCanvasSnapshot(canvas);
}

async function openCircularMarunouchiMaps(page: Page) {
  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page
    .getByRole("option", { name: "[M] 丸ノ内線", exact: true })
    .click();

  const canvas = page.locator(".map-preview canvas").first();
  const captureMode = async (name: "Badge" | "Replace Dot") => {
    const radio = page.getByRole("radio", { name, exact: true });
    await radio.evaluate((element) => (element as HTMLInputElement).click());
    await expect(radio).toBeChecked();
    return stableCanvasSnapshot(canvas);
  };
  return {
    badge: await captureMode("Badge"),
    dot: await captureMode("Replace Dot"),
  };
}

test("does not add JR East headers to Tokyo Metro badges in circular badge or dot modes", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);
  await setMarunouchiAsLoopLine(page);

  const withoutCode = await openCircularMarunouchiMaps(page);
  await setStationThreeLetterCode(page, /^\[M\] 丸ノ内線$/, "荻窪", "GEN");
  const withCode = await openCircularMarunouchiMaps(page);

  expect(
    withCode,
    "a Tokyo Metro station code must not change either circular SnBadge path",
  ).toEqual(withoutCode);
});

test("does not add a JR East header to a Tokyo Metro badge in a vertical single-line map", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  const withoutCode = await openVerticalMarunouchiBadgeMap(page);
  await setStationThreeLetterCode(page, /^\[M\] 丸ノ内線$/, "荻窪", "GEN");
  const withCode = await openVerticalMarunouchiBadgeMap(page);

  expect(
    withCode,
    "a Tokyo Metro station code must not change the rendered badge or its layout",
  ).toEqual(withoutCode);
});

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

  const openMixedRouteMap = async () => {
    await page.getByRole("tab", { name: "From Route" }).click();
    await page.getByText("Line Map (Single/Through)", { exact: true }).click();
    await page.getByRole("textbox", { name: "Lines", exact: true }).click();
    await page.getByRole("option", { name: "M-JY test", exact: true }).click();
    await page
      .getByRole("radio", { name: "Badge", exact: true })
      .evaluate((element) => (element as HTMLInputElement).click());
    return page.locator(".map-preview canvas").first();
  };

  const withoutMetroCode = await stableCanvasSnapshot(
    await openMixedRouteMap(),
  );
  await setStationThreeLetterCode(page, /^\[M\] 丸ノ内線$/, "新宿", "GEN");
  const canvas = await openMixedRouteMap();
  const withMetroCode = await stableCanvasSnapshot(canvas);
  expect(
    withMetroCode,
    "a Tokyo Metro code must not add a second header to the mixed connected group",
  ).toEqual(withoutMetroCode);

  const preview = page.locator(".map-preview");
  await preview.screenshot({
    path: testInfo.outputPath("mixed-station-number-group.png"),
  });

  const hasJrEastHeader = await canvas.evaluate((element) => {
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
