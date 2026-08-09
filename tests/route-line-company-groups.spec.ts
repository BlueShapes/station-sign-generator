import { expect, test, type Page } from "@playwright/test";

async function loadSampleDatabase(page: Page) {
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();
}

test("groups the station line selector by railway company", async ({ page }) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page
    .getByRole("textbox", { name: "Lines", exact: true })
    .click();

  const listbox = page.getByRole("listbox");
  const jrEastGroup = listbox
    .getByText("JR東日本", { exact: true })
    .locator("..");
  const metroGroup = listbox
    .getByText("東京メトロ", { exact: true })
    .locator("..");
  const toyoGroup = listbox
    .getByText("東葉高速鉄道", { exact: true })
    .locator("..");

  await expect(jrEastGroup.getByRole("option", { name: /^\[JY\]/ })).toBeVisible();
  await expect(metroGroup.getByRole("option", { name: /^\[M\]/ })).toBeVisible();
  await expect(toyoGroup.getByRole("option", { name: /^\[TR\]/ })).toBeVisible();
  await expect(jrEastGroup.getByRole("option", { name: /^\[M\]/ })).toHaveCount(0);
});
