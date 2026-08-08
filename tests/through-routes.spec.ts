import { expect, test, type Page } from "@playwright/test";

async function loadSampleDatabase(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog.getByRole("button", { name: "Overwrite", exact: true }).click();
  await expect(importDialog).not.toBeVisible();
}

test("shows direction-aware through routes from the sample database", async ({
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

  const reverseRouteRow = page
    .getByRole("row")
    .filter({ hasText: "東葉勝田台 → 三鷹（東西線直通）" });
  await expect(reverseRouteRow).toContainText("東葉高速線: 東葉勝田台 → 西船橋");
  await expect(reverseRouteRow).toContainText("東西線: 西船橋 → 中野");
  await expect(reverseRouteRow).toContainText("中央・総武線各駅停車: 中野 → 三鷹");

  await reverseRouteRow.getByRole("button").first().click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toContainText(/edit through route|直通経路を編集/i);
  await expect(editDialog.getByText("東葉勝田台 → 西船橋")).toBeVisible();
  await expect(editDialog.getByText("西船橋 → 中野")).toBeVisible();
  await expect(editDialog.getByText("中野 → 三鷹")).toBeVisible();
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
