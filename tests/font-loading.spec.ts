import { expect, test } from "@playwright/test";

test("keeps the current preview until the next style is ready", async ({
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
    const initialPreview = await previewImage.getAttribute("src");
    expect(initialPreview).not.toBeNull();

    await page.getByLabel("スタイル").first().click();
    await page
      .getByRole("option", { name: "東京メトロ風（小・日）" })
      .click();

    await expect(page.getByText("フォントを読み込み中...")).toBeVisible();
    await expect(previewImage).toBeVisible();
    await expect(previewImage).toHaveAttribute("src", initialPreview!);

    releaseJost?.();
    await expect
      .poll(() => previewImage.getAttribute("src"), { timeout: 50_000 })
      .not.toBe(initialPreview);
  } finally {
    releaseJost?.();
  }
});
