import { test, expect } from "@playwright/test";

test("capture maximum track badges", async ({ page }) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Overwrite", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("tab", { name: "From Route" }).click();
  await page.getByRole("textbox", { name: "Lines", exact: true }).click();
  await page.getByRole("option", { name: /^\[JY\]/ }).click();
  await page.getByText("Line Map (Single/Through)", { exact: true }).click();
  const slider = page.getByRole("slider", { name: "Track Width" });
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "30";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("radio", { name: "Badge", exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator(".map-preview canvas").first().screenshot({
    path: "C:/Users/abcde/.codex/visualizations/2026/08/12/019ff4bb-8f87-75e2-b9bb-645d85557e75/badge-max.png",
  });
  await page.getByRole("radio", { name: "Replace Dot", exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator(".map-preview canvas").first().screenshot({
    path: "C:/Users/abcde/.codex/visualizations/2026/08/12/019ff4bb-8f87-75e2-b9bb-645d85557e75/dot-max.png",
  });
});
