import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { BASE_SIGN_STYLE_IDS } from "../src/customization/model";

const en = YAML.parse(readFileSync("src/locales/en.yml", "utf8"));
const imageSettings = en["sign-images"];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="#ff00ff"/></svg>';
const preview = (page: Page) => page.locator('img[src^="data:image/png"]').first();
const settings = (page: Page) => page.getByTestId("sign-image-settings");

async function upload(page: Page, name = "Test image") {
  await page.getByRole("tab", { name: en.tabs.settings, exact: true }).click();
  await page.getByRole("button", { name: en.settings.images.upload, exact: true }).click();
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "test.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
  const modal = page.getByRole("dialog");
  await modal.getByLabel(en.settings.images["display-name"]).fill(name);
  await modal.getByRole("button", { name: en.settings.images["upload-submit"], exact: true }).click();
  await expect(modal).toHaveCount(0);
}

async function openImages(page: Page, scope: Locator = settings(page)) {
  const toggle = scope.getByRole("button", { name: imageSettings.title, exact: true });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
}

async function pixel(image: Locator, x: number, y: number) {
  return image.evaluate(async (element, point) => {
    const source = element as HTMLImageElement;
    await source.decode();
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    return Array.from(ctx.getImageData(Math.round(point.x * 3), Math.round(point.y * 3), 1, 1).data);
  }, { x, y });
}

async function expectMagenta(image: Locator, x = 2, y = 2) {
  await expect.poll(() => pixel(image, x, y)).toEqual([255, 0, 255, 255]);
}

test("places images in every template and preserves transforms through reload, PNG and JSON", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/");
  await upload(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ssg-image-cache-v1")!)[0].dataUrl)).toContain("data:image/svg+xml");
  await page.getByRole("tab", { name: en.tabs.simple, exact: true }).click();
  await openImages(page);
  await settings(page).getByRole("button", { name: imageSettings.add, exact: true }).click();
  const part = settings(page).getByRole("group", { name: "Image 1", exact: true });
  await expect(part.getByLabel(imageSettings.x, { exact: true })).toHaveValue("0");
  await expect(part.getByLabel(imageSettings.y, { exact: true })).toHaveValue("0");
  const style = page.getByRole("textbox", { name: en.route.sign.style, exact: true });
  for (const template of BASE_SIGN_STYLE_IDS) {
    await style.click();
    await page.getByRole("option", { name: en.route.sign[template], exact: true }).click();
    await expect(page.locator('img[aria-hidden="true"][src^="data:image/"]')).toHaveCount(0);
    await expectMagenta(preview(page));
  }
  await style.click();
  await page.getByRole("option", { name: en.route.sign.jreast, exact: true }).click();
  for (const [field, value] of Object.entries({ width: "30", height: "10", x: "100", y: "30", rotation: "90" })) {
    await part.getByLabel(imageSettings[field], { exact: true }).fill(value);
  }
  await expectMagenta(preview(page), 115, 22);
  await expect.poll(() => pixel(preview(page), 101, 31)).not.toEqual([255, 0, 255, 255]);
  await part.getByLabel(imageSettings.opacity, { exact: true }).fill("50");
  await expect.poll(() => pixel(preview(page), 115, 22)).toEqual([255, 127, 255, 255]);
  await part.getByLabel(imageSettings.opacity, { exact: true }).fill("100");
  await expectMagenta(preview(page), 115, 22);
  const transformed = await preview(page).getAttribute("src");
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: en.input.direct["export-download"], exact: true }).click();
  const exported = JSON.parse(readFileSync((await (await jsonDownload).path())!, "utf8"));
  expect(exported.images[0]).toMatchObject({ x: 100, y: 30, width: 30, height: 10, rotation: 90, opacity: 1 });
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: en.input.save, exact: true }).click();
  const png = readFileSync((await (await pngDownload).path())!);
  const savedPixel = await page.evaluate(async (base64) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return Array.from(ctx.getImageData(Math.round(image.width * 115 / 630), Math.round(image.height * 22 / 140), 1, 1).data);
  }, png.toString("base64"));
  expect(savedPixel).toEqual([255, 0, 255, 255]);
  await page.reload();
  await expect.poll(() => preview(page).getAttribute("src")).toBe(transformed);
  await page.getByRole("button", { name: en.input.direct.reset, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: en.common.confirm, exact: true }).click();
  await expect.poll(() => preview(page).getAttribute("src")).not.toBe(transformed);
  await page.getByRole("button", { name: en.input.direct.import, exact: true }).click();
  await page.getByLabel(en.input.direct["import-paste-label"]).fill(JSON.stringify(exported));
  await page.getByRole("dialog").getByRole("button", { name: en.input.direct["import-submit"], exact: true }).click();
  await expect.poll(() => preview(page).getAttribute("src")).toBe(transformed);
  await openImages(page);
  await settings(page).screenshot({ path: "test-results/sign-images-simple.png" });
  expect(errors).toEqual([]);
});

test("saves, duplicates and edits custom style images and lets simple input override them", async ({ page }) => {
  await page.goto("/en/");
  await upload(page);
  await page.getByRole("button", { name: en.settings.custom.sign.create, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: en.settings.custom.name, exact: true }).fill("Image style");
  await openImages(page, dialog.getByTestId("sign-image-settings"));
  await dialog.getByRole("button", { name: imageSettings.add, exact: true }).click();
  await expectMagenta(dialog.getByTestId("custom-style-preview").locator('img[src^="data:image/png"]'));
  await dialog.getByRole("button", { name: en.common.save, exact: true }).click();
  await page.getByRole("button", { name: `${en.settings.custom.duplicate}: Image style`, exact: true }).click();
  const copyName = en.settings.custom["copy-name"].replace("{name}", "Image style");
  await expect(page.getByText(copyName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${en.common.edit}: ${copyName}`, exact: true }).click();
  await openImages(page, dialog.getByTestId("sign-image-settings"));
  await dialog.getByLabel(imageSettings.x, { exact: true }).fill("60");
  await expectMagenta(dialog.getByTestId("custom-style-preview").locator('img[src^="data:image/png"]'), 62, 2);
  await dialog.getByRole("button", { name: en.common.save, exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: en.tabs.simple, exact: true }).click();
  await page.getByRole("textbox", { name: en.route.sign.style, exact: true }).click();
  await page.getByRole("option", { name: `${en.settings.custom["option-prefix"]}: Image style`, exact: true }).click();
  await expectMagenta(preview(page));
  await openImages(page);
  await settings(page).getByRole("button", { name: en.common.delete, exact: true }).click();
  await expect.poll(() => pixel(preview(page), 2, 2)).not.toEqual([255, 0, 255, 255]);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("sign-config-v1")!).images)).toEqual([]);
  await settings(page).getByRole("button", { name: imageSettings.reset, exact: true }).click();
  await expectMagenta(preview(page));
  await page.getByRole("tab", { name: en.tabs.settings, exact: true }).click();
  const imageCard = page.getByRole("img", { name: "Test image", exact: true }).locator("..");
  await imageCard.getByRole("button", { name: en.common.delete, exact: true }).click();
  await page.getByRole("tab", { name: en.tabs.simple, exact: true }).click();
  await openImages(page);
  await expect(settings(page).getByRole("textbox", { name: imageSettings.image, exact: true })).toHaveValue(imageSettings.missing);
  await expect.poll(() => pixel(preview(page), 2, 2)).not.toEqual([255, 0, 255, 255]);
});

test("keeps route station image overrides independent across navigation and reload", async ({ page }) => {
  await page.goto("/en/");
  await upload(page);
  await page.getByRole("tab", { name: en.tabs["route-edit"], exact: true }).click();
  await page.getByRole("button", { name: "Load Sample Data", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Overwrite", exact: true }).click();
  const selectStation = async () => {
    await page.getByRole("tab", { name: en.tabs["route-input"], exact: true }).click();
    await page.getByRole("textbox", { name: "Lines", exact: true }).click();
    await page.getByRole("option", { name: "[JY] 山手線", exact: true }).click();
    await page.getByRole("textbox", { name: "Stations", exact: true }).click();
    await page.getByRole("option", { name: "[JY26] 高輪ゲートウェイ", exact: true }).click();
  };
  await selectStation();
  await openImages(page);
  await settings(page).getByRole("button", { name: imageSettings.add, exact: true }).click();
  await settings(page).getByLabel(imageSettings.x, { exact: true }).fill("50");
  await expectMagenta(preview(page), 52, 2);
  await page.getByRole("button", { name: en.route.sign["next-station"], exact: true }).click();
  await expect(settings(page).getByRole("group", { name: "Image 1", exact: true })).toHaveCount(0);
  await settings(page).getByRole("button", { name: imageSettings.add, exact: true }).click();
  await expectMagenta(preview(page));
  await page.getByRole("button", { name: en.route.sign["prev-station"], exact: true }).click();
  await expect(settings(page).getByLabel(imageSettings.x, { exact: true })).toHaveValue("50");
  await expectMagenta(preview(page), 52, 2);
  await page.reload();
  await selectStation();
  await openImages(page);
  await expect(settings(page).getByLabel(imageSettings.x, { exact: true })).toHaveValue("50");
  await expectMagenta(preview(page), 52, 2);
  await settings(page).screenshot({ path: "test-results/sign-images-route.png" });
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "ssg-route-sign-images-v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await settings(page).getByLabel(imageSettings.x, { exact: true }).fill("75");
  await expect(page.getByRole("alert")).toContainText(imageSettings["save-error"]);
  await expectMagenta(preview(page), 52, 2);
  expect(await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("ssg-route-sign-images-v1")!) as Record<string, { x: number }[]>;
    return Object.values(saved).some((images) => images[0]?.x === 75);
  })).toBe(false);
});

test("reports cache quota and invalid image errors without accepting the upload", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("tab", { name: en.tabs.settings, exact: true }).click();
  await page.getByRole("button", { name: en.settings.images.upload, exact: true }).click();
  const input = page.locator('input[type="file"][accept="image/*"]');
  const modal = page.getByRole("dialog");
  await input.setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await modal.getByRole("button", { name: en.settings.images["upload-submit"], exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText(imageSettings["upload-error"]);
  await input.setInputFiles({ name: "test.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "ssg-image-cache-v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await modal.getByRole("button", { name: en.settings.images["upload-submit"], exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText(imageSettings["upload-error"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ssg-image-cache-v1") ?? "[]"))).toEqual([]);
});

test("migrates existing IndexedDB uploads to localStorage without changing IDs", async ({ page }) => {
  await page.goto("/en/");
  await expect(preview(page)).toBeVisible();
  await page.evaluate(async (source) => {
    const request = indexedDB.open("ssg-image-store", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = db.transaction("user-images", "readwrite");
    transaction.objectStore("user-images").put({ id: "legacy-image", name: "Legacy image", mimeType: "image/svg+xml", data: new TextEncoder().encode(source).buffer, size: source.length, width: 12, height: 8, addedAt: Date.now() });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, svg);
  await page.reload();
  await page.getByRole("tab", { name: en.tabs.settings, exact: true }).click();
  await expect(page.getByText("Legacy image", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ssg-image-cache-v1")!)[0].id)).toBe("legacy-image");
  await page.getByRole("tab", { name: en.tabs.simple, exact: true }).click();
  await openImages(page);
  await settings(page).getByRole("button", { name: imageSettings.add, exact: true }).click();
  await expectMagenta(preview(page));
  const ar = YAML.parse(readFileSync("src/locales/ar.yml", "utf8"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/");
  await settings(page).getByRole("button", { name: ar["sign-images"].title, exact: true }).click();
  const bounds = (await settings(page).boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await expect(settings(page)).toHaveCSS("direction", "rtl");
  await settings(page).screenshot({ path: "test-results/sign-images-ar.png" });
});

test("waits for image decoding before saving a PNG", async ({ page }) => {
  await page.goto("/en/");
  await upload(page);
  await page.getByRole("tab", { name: en.tabs.simple, exact: true }).click();
  await openImages(page);
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(value: string) {
        if (value.startsWith("data:image/svg+xml")) setTimeout(() => descriptor.set!.call(this, value), 800);
        else descriptor.set!.call(this, value);
      },
    });
  });
  await settings(page).getByRole("button", { name: imageSettings.add, exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: en.input.save, exact: true }).click();
  const png = readFileSync((await (await downloadPromise).path())!).toString("base64");
  const savedPixel = await page.evaluate(async (base64) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    return Array.from(ctx.getImageData(3, 3, 1, 1).data);
  }, png);
  expect(savedPixel).toEqual([255, 0, 255, 255]);
});
