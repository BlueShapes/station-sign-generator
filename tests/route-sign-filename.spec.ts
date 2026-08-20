import { expect, test } from "@playwright/test";

test("route-input station-sign downloads include line and direction", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog.getByRole("button", { name: "Overwrite", exact: true }).click();
  await expect(importDialog).not.toBeVisible();

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: "[JY] 山手線" }).click();
  await page.getByRole("textbox", { name: "Stations", exact: true }).click();
  await page
    .getByRole("option", { name: "[JY26] 高輪ゲートウェイ" })
    .click();

  const saveButton = page.getByRole("button", {
    name: "Save as Image",
    exact: true,
  });
  await expect(saveButton).toBeEnabled({ timeout: 30000 });

  const downloadPromise = page.waitForEvent("download");
  await saveButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "Yamanote Line_Takanawa Gateway_Right-facing.png",
  );
});
