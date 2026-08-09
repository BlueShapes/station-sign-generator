import { expect, test } from "@playwright/test";

test("does not expose a fallback-font preview while a style font is loading", async ({
  page,
}) => {
  let releaseJost: (() => void) | undefined;
  const jostReleased = new Promise<void>((resolve) => {
    releaseJost = resolve;
  });

  await page.route(/Jost-VariableFont_wght.*\.ttf/, async (route) => {
    await jostReleased;
    await route.continue();
  });

  try {
    await page.goto("/ja/");
    const previewImage = page.locator('img[src^="data:image/"]');
    await expect(previewImage).toBeVisible({ timeout: 50_000 });

    await page.getByLabel("スタイル").first().click();
    await page
      .getByRole("option", { name: "東京メトロ・都営地下鉄風（横長）" })
      .click();

    await expect(page.getByText("フォントを読み込み中...")).toBeVisible();
    await expect(previewImage).toHaveCount(0);

    releaseJost?.();
    await expect(previewImage).toBeVisible({ timeout: 50_000 });
  } finally {
    releaseJost?.();
  }
});
