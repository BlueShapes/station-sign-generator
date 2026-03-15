import { test, expect } from "@playwright/test";
import path from "path";

const SQLITE_PATH = path.resolve(
  __dirname,
  "../.claude/output/sample-yamanote.sqlite",
);

test.describe("SQLite import", () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("PAGE ERROR:", msg.text());
      }
    });
    page.on("pageerror", (err) => {
      console.log("PAGE EXCEPTION:", err.message);
    });

    await page.goto("/");
    await page.waitForSelector('[role="tab"]', { timeout: 30000 });
    // Wait for fonts + DB to load
    await page.waitForTimeout(3000);
  });

  test("import overwrite shows companies table without crash", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to Edit Routes tab
    await page.getByRole("tab", { name: /edit routes|路線を編集/i }).click();
    await page.waitForTimeout(1000);

    // Find hidden file input and upload the SQLite file
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page
        .getByRole("button", { name: /import sqlite|sqliteをインポート/i })
        .click(),
    ]);
    await fileChooser.setFiles(SQLITE_PATH);
    await page.waitForTimeout(1000);

    // A confirmation modal should appear (overwrite vs merge)
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click Overwrite
    await modal.getByRole("button", { name: /overwrite|上書き/i }).click();
    await page.waitForTimeout(2000);

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // No "out of memory" errors
    const oomErrors = errors.filter((e) => e.includes("out of memory"));
    expect(
      oomErrors,
      `Got out-of-memory errors: ${oomErrors.join("\n")}`,
    ).toHaveLength(0);

    // Companies section should now show JR東日本
    await expect(page.getByText("JR東日本").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("import merge shows companies table without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.getByRole("tab", { name: /edit routes|路線を編集/i }).click();
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page
        .getByRole("button", { name: /import sqlite|sqliteをインポート/i })
        .click(),
    ]);
    await fileChooser.setFiles(SQLITE_PATH);
    await page.waitForTimeout(1000);

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.getByRole("button", { name: /^merge$|^マージ$/i }).click();
    await page.waitForTimeout(2000);

    await expect(modal).not.toBeVisible({ timeout: 5000 });

    const oomErrors = errors.filter((e) => e.includes("out of memory"));
    expect(
      oomErrors,
      `Got out-of-memory errors: ${oomErrors.join("\n")}`,
    ).toHaveLength(0);

    await expect(page.getByText("JR東日本").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("rejects non-sqlite file with error message", async ({ page }) => {
    await page.getByRole("tab", { name: /edit routes|路線を編集/i }).click();
    await page.waitForTimeout(1000);

    // Create a fake file in the browser context
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page
        .getByRole("button", { name: /import sqlite|sqliteをインポート/i })
        .click(),
    ]);

    // Use a text file with .sqlite extension to trigger invalid-file error
    await fileChooser.setFiles({
      name: "invalid.sqlite",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("this is not a sqlite file"),
    });
    await page.waitForTimeout(1000);

    // Should show an error alert, not a modal
    const alertText = page.locator('[role="alert"]');
    await expect(alertText).toBeVisible({ timeout: 5000 });
    // Modal should NOT appear
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
