import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";

let SQL: SqlJsStatic;
test.beforeAll(async () => {
  SQL = await initSqlJs({ wasmBinary: Uint8Array.from(readFileSync(resolve("node_modules/sql.js/dist/sql-wasm.wasm"))).buffer });
});
const modern = { code: 200, data: {
  stations: [{ id: "a", name: "南|South" }, { id: "b", name: "北|North" }],
  routes: [
    { id: "r1", name: "MTR本線|MTR Main", number: "MT", color: 0x123456, circularState: "NONE", stations: [{ id: "a", name: "1" }, { id: "b", name: "2" }] },
    { id: "r2", name: "MTR本線|MTR Main", number: "MT", color: 0x123456, circularState: "NONE", stations: [{ id: "b", name: "2" }, { id: "a", name: "1" }] },
  ],
} };
const legacy = [{ stations: {}, routes: [] }, {
  stations: { "-9223372036854775807": { name: "南|South" }, "2": { name: "北|North" } },
  routes: [{ name: "MTR本線|MTR Main||Outbound", number: "MT", color: 0x123456, circular: "", stations: ["-9223372036854775807_1193046", "2_1193046"] }],
}];

async function openImport(page: Page) {
  await page.goto("/en/");
  await page.getByRole("tab", { name: "Edit Routes", exact: true }).click();
  await page.getByRole("button", { name: "Import from MTR", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function readStoredDb(page: Page) {
  const base64 = await page.evaluate(() => localStorage.getItem("station-sign-db-v2"));
  expect(base64).toBeTruthy();
  return new SQL.Database(Buffer.from(base64!, "base64"));
}

for (const version of ["4.0.5", "4.1.0-beta.2", "3.2.2-hotfix-2"]) {
  test(`imports ${version} pasted JSON and persists only the selected routes`, async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByRole("textbox", { name: "MTR version", exact: true }).click();
    await page.getByRole("option", { name: version, exact: true }).click();
    await dialog.getByText("Paste JSON", { exact: true }).click();
    const isLegacy = version === "3.2.2-hotfix-2";
    if (isLegacy) await dialog.getByRole("textbox", { name: "Dimension index" }).fill("1");
    await dialog.getByRole("textbox", { name: "API JSON", exact: true }).fill(JSON.stringify(isLegacy ? legacy : modern));
    await dialog.getByRole("button", { name: "Read JSON" }).click();
    await expect(dialog.getByRole("checkbox")).toHaveCount(isLegacy ? 1 : 2);
    await expect(dialog).toContainText("南 → 北");
    if (!isLegacy) await expect(dialog).toContainText("北 → 南");
    await dialog.getByRole("button", { name: "Deselect all" }).click();
    await expect(dialog.getByRole("button", { name: "Import 0 routes" })).toBeDisabled();
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("button", { name: "Import 1 routes", exact: true }).click();
    await expect(dialog).toContainText("Added 1 routes and 2 stations.");
    const db = await readStoredDb(page);
    try {
      expect(db.exec("SELECT name,secondary_name,line_color,prefix FROM lines WHERE name = 'MTR本線'")[0].values).toEqual([["MTR本線", "MTR Main", "#123456", "MT"]]);
      expect(db.exec("SELECT s.primary_name FROM stations s JOIN station_lines sl ON s.id = sl.station_id JOIN lines l ON l.id = sl.line_id WHERE l.name='MTR本線' ORDER BY sl.sort_order")[0].values).toEqual([["南"], ["北"]]);
    } finally { db.close(); }
    await page.reload();
    await page.getByRole("tab", { name: "Edit Routes", exact: true }).click();
    await page.getByRole("textbox", { name: "Lines", exact: true }).click();
    await expect(page.getByRole("option", { name: /MTR本線/ })).toBeVisible();
  });
}

test("fetches a long map URL, retains its dimension and invalidates stale preview after input changes", async ({ page }) => {
  const path = "/" + "map-prefix-".repeat(12) + "/";
  const url = `https://mtr.example${path}?dimension=2`;
  let requested = "";
  await page.route("https://mtr.example/**", async (route) => {
    requested = route.request().url();
    await route.fulfill({ json: modern });
  });
  const dialog = await openImport(page);
  const urlInput = dialog.getByRole("textbox", { name: "Map or API URL" });
  await urlInput.fill(url);
  await expect(urlInput).toHaveValue(url);
  await expect(dialog.getByRole("textbox", { name: "Dimension index" })).toHaveValue("2");
  await dialog.getByRole("button", { name: "Load routes", exact: true }).click();
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  expect(requested).toBe(`https://mtr.example${path}mtr/api/map/stations-and-routes?dimension=2`);
  await urlInput.fill("https://mtr.example/changed/");
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Import \d+ routes$/ })).toHaveCount(0);
});

test("rejects malformed JSON and offers manual paste after a failed browser request", async ({ page }) => {
  await page.route("https://mtr.example/**", (route) => route.abort("failed"));
  const dialog = await openImport(page);
  await dialog.getByRole("textbox", { name: "Map or API URL" }).fill("https://mtr.example/");
  await dialog.getByRole("button", { name: "Load routes", exact: true }).click();
  await expect(dialog).toContainText("Could not load the API.");
  await dialog.getByText("Paste JSON", { exact: true }).click();
  await dialog.getByRole("textbox", { name: "API JSON", exact: true }).fill("{bad");
  await dialog.getByRole("button", { name: "Read JSON" }).click();
  await expect(dialog).toContainText("Invalid JSON.");
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
});

test("keeps the saved and in-memory database unchanged on quota failure, and allows retry", async ({ page }) => {
  const dialog = await openImport(page);
  const before = await page.evaluate(() => localStorage.getItem("station-sign-db-v2"));
  await dialog.getByText("Paste JSON", { exact: true }).click();
  await dialog.getByRole("textbox", { name: "API JSON", exact: true }).fill(JSON.stringify(modern));
  await dialog.getByRole("button", { name: "Read JSON" }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreMtrStorage: () => void }).restoreMtrStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key === "station-sign-db-v2") throw new DOMException("Test quota", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await dialog.getByRole("button", { name: "Import 2 routes", exact: true }).click();
  await expect(dialog).toContainText("Could not import the routes. No routes were added.");
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem("station-sign-db-v2"))).toBe(before);
  await page.evaluate(() => (window as unknown as { restoreMtrStorage: () => void }).restoreMtrStorage());
  await dialog.getByRole("button", { name: "Import 2 routes", exact: true }).click();
  await expect(dialog).toContainText("Added 2 routes and 2 stations.");
  const db = await readStoredDb(page);
  try {
    expect(db.exec("SELECT COUNT(*) FROM lines WHERE name = 'MTR本線'")[0].values).toEqual([[2]]);
    expect(db.exec("SELECT COUNT(*) FROM stations WHERE primary_name IN ('南','北')")[0].values).toEqual([[2]]);
  } finally { db.close(); }
});
