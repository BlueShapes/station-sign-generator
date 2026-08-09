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

test("adds and removes an explicit connection between distinct stations", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await loadSampleDatabase(page);

  const lineSelect = page.getByRole("textbox", {
    name: "Lines",
    exact: true,
  });
  await lineSelect.click();
  await page.getByRole("option", { name: /^\[JY\]/ }).click();

  const manageTransferButton = page
    .getByRole("button", { name: "View and manage transfer information" })
    .nth(1);
  await expect(manageTransferButton).toBeVisible();
  await manageTransferButton.click();

  const transferDialog = page.getByRole("dialog");
  await expect(transferDialog).toContainText(
    "Lines sharing the same station ID",
  );
  await expect(transferDialog).toContainText("[JK]");
  await expect(transferDialog).toContainText("[JC]");
  await expect(transferDialog).toContainText(
    "Explicit transfers between stations",
  );
  await expect(transferDialog).toContainText("No transfer connections");
  await transferDialog
    .getByRole("textbox", { name: "Connecting station" })
    .click();
  const targetOption = page.getByRole("option").first();
  await expect(targetOption).toBeVisible();
  await targetOption.click();
  await transferDialog.getByRole("button", { name: "Add" }).click();

  await expect(transferDialog).not.toContainText("No transfer connections");
  const deleteButton = transferDialog.getByRole("button", { name: "Delete" });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  await expect(transferDialog).toContainText("No transfer connections");
});

test("shows explicit Marunouchi transfer lines on the line map", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await loadSampleDatabase(page);

  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: /^\[M\]/ }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();

  const transferSelect = page.getByRole("textbox", {
    name: "Show Transit Lines",
  });
  await expect(transferSelect).toBeVisible();
  await transferSelect.click({ force: true });
  await expect(page.getByRole("option", { name: /^\[JC\]/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /^\[JB\]/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /^\[JY\]/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /^\[T\]/ })).toBeVisible();
});
