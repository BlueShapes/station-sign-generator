import { expect, test } from "@playwright/test";

test("chooses a source line before choosing an existing station", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();

  const importDialog = page.getByRole("dialog");
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();

  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: /^\[JY\]/ }).click();
  await page
    .getByRole("button", { name: "Add from Existing Station" })
    .click();

  const linkDialog = page.getByRole("dialog", {
    name: "Add Existing Station to Line",
  });
  const sourceLineSelect = linkDialog.getByRole("textbox", {
    name: "Source line",
  });
  const stationSelect = linkDialog.getByRole("textbox", {
    name: "Select a station to add",
  });

  await expect(sourceLineSelect).toBeVisible();
  await expect(stationSelect).toBeDisabled();

  await sourceLineSelect.click();
  await page.getByRole("option", { name: /^\[M\]/ }).click();
  await expect(stationSelect).toBeEnabled();

  await stationSelect.click();
  await expect(page.getByRole("option", { name: "中野坂上" })).toBeVisible();
  await page.getByRole("option", { name: "中野坂上" }).click();

  await sourceLineSelect.click();
  await page.getByRole("option", { name: /^\[JC\]/ }).click();
  await expect(stationSelect).toHaveValue("");
});
