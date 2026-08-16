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

    const importModal = page.getByRole("dialog");
    await expect(importModal).toBeVisible();
    await importModal
      .getByRole("button", { name: /overwrite|上書き/i })
      .click();
    await expect(importModal).not.toBeVisible();

    await page
      .getByRole("tab", { name: /from route|路線から入力/i })
      .click();

    const lineSelect = page.getByRole("textbox", {
      name: /^line$|^路線$/i,
    });
    await lineSelect.click();
    const lineListbox = page.getByRole("listbox");
    await expect(lineListbox).toBeVisible();
    await lineListbox
      .getByRole("option", { name: /\[Mb\].*方南町支線/i })
      .click();

    const stationSelect = page.getByRole("textbox", {
      name: /^station$|^駅$/i,
    });
    await stationSelect.click();
    await expect(
      page.getByRole("option", { name: /\[M06\] 中野坂上/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /\[Mb06\] 中野坂上/ }),
    ).toHaveCount(0);
  });

  test("route-input station signs can choose badges from other lines", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /edit routes|路線を編集/i }).click();
    await page
      .getByRole("button", {
        name: /sample data|サンプルデータを読み込む/i,
      })
      .click();

    const importModal = page.getByRole("dialog");
    await expect(importModal).toBeVisible();
    await importModal
      .getByRole("button", { name: /overwrite|上書き/i })
      .click();
    await expect(importModal).not.toBeVisible();

    await page
      .getByRole("tab", { name: /from route|路線から入力/i })
      .click();

    await page.getByRole("textbox", { name: /^line$|^路線$/i }).click();
    await page
      .getByRole("option", { name: /\[JC\].*中央線快速/i })
      .click();

    await page.getByRole("textbox", { name: /^station$|^駅$/i }).click();
    await page.getByRole("option", { name: /\[JC06\] 中野/ }).click();

    const badgeSelect = page.getByRole("textbox", {
      name: /station number badges|駅番号バッジ/i,
    });
    await expect(badgeSelect).toBeVisible();
    await badgeSelect.click();
    await expect(
      page.getByRole("option", { name: /\[JB07\].*中央・総武線/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /\[T01\].*東西線/i }),
    ).toBeVisible();
    await page
      .getByRole("option", { name: /\[T01\].*東西線/i })
      .click();
    await page.keyboard.press("Escape");
    await expect(
      page
        .getByRole("tabpanel", { name: /from route|路線から入力/i })
        .getByText("[T01] 東西線", { exact: true }),
    ).toBeVisible();

    await page.getByRole("textbox", { name: /^station$|^駅$/i }).click();
    await page.getByRole("option", { name: /\[JC05\] 新宿/ }).click();
    await badgeSelect.click();
    await expect(
      page.getByRole("option", { name: /\[M08\].*丸ノ内線/i }),
    ).toBeVisible();
  });
});
