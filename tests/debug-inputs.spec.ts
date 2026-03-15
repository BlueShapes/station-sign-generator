import { test } from "@playwright/test";

test("debug: list all inputs on page", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[role="tab"]', { timeout: 50000 });
  await page.waitForTimeout(2000);

  const inputs = await page.evaluate(() => {
    const els = document.querySelectorAll("input");
    return Array.from(els).map((el) => ({
      type: el.type,
      name: el.name,
      value: el.value.substring(0, 20),
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });
  console.log("Inputs found:", JSON.stringify(inputs, null, 2));

  const allElements = await page.evaluate(() => {
    const els = document.querySelectorAll("[role]");
    return Array.from(els)
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        role: el.getAttribute("role"),
        text: el.textContent?.substring(0, 30),
      }));
  });
  console.log("Role elements:", JSON.stringify(allElements, null, 2));
});
