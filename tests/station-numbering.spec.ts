import { test, expect } from "@playwright/test";

test.describe("Tokyo Metro branch numbering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="tab"]', { timeout: 30000 });
    await page.waitForTimeout(3000);
  });

  test("Nakano-Sakaue keeps M06 on the Marunouchi branch", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /edit routes|路線を編集/i }).click();
    await page
      .getByRole("button", {
        name: /sample data|サンプルデータを読み込む/i,
      })
      .click();
    await page.waitForTimeout(1000);

    await page.getByRole("tab", { name: /route input|路線入力/i }).click();

    await page.getByLabel(/line|路線/i).first().click();
    await page
      .getByRole("option", { name: /\[Mb\].*方南町支線/i })
      .click();

    await page.getByLabel(/station|駅/i).first().click();
    await expect(
      page.getByRole("option", { name: /\[M06\] 中野坂上/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /\[Mb06\] 中野坂上/ }),
    ).toHaveCount(0);
  });
});
