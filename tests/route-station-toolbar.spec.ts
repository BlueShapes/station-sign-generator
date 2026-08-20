import { expect, test } from "@playwright/test";

test("keeps station actions visible while scrolling a long station list", async ({
  page,
}) => {
  await page.goto("/en/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.getByRole("tab", { name: "Edit Routes" }).click();
  await page.getByRole("button", { name: "Load Sample Data" }).click();

  const importDialog = page.getByRole("dialog");
  await expect(importDialog).toBeVisible();
  await importDialog
    .getByRole("button", { name: "Overwrite", exact: true })
    .click();
  await expect(importDialog).not.toBeVisible();

  await page
    .getByRole("textbox", { name: "Lines", exact: true })
    .click();
  await page.getByRole("option", { name: /^\[JY\]/ }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const toolbar = page.locator(".route-station-toolbar");
  await expect(toolbar).toBeInViewport();
  await expect(toolbar.getByRole("button", { name: "Add Station" })).toBeVisible();

  const toolbarStyle = await toolbar.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      top: element.getBoundingClientRect().top,
      backgroundColor: style.backgroundColor,
    };
  });

  expect(toolbarStyle.position).toBe("sticky");
  expect(toolbarStyle.top).toBeGreaterThanOrEqual(63);
  expect(toolbarStyle.top).toBeLessThanOrEqual(65);
  expect(toolbarStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
});
