import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("https://js.arcgis.com/5.1/", route => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
  await page.clock.install();
});

test("Daily time excludes the landing page, random rounds, and hidden-tab time", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page.locator("#stopwatch-value")).toHaveText("00:03");
  await page.goto("/");
  await page.clock.runFor(60000);
  await page.goto("/play");
  await expect(page.locator("#scene-image")).toBeVisible();
  await page.clock.runFor(30000);
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(page.locator("#stopwatch-value")).toHaveText("00:03");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(60000);
  await expect(page.locator("#stopwatch-value")).toHaveText("00:03");
  await page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(2000);
  await expect(page.locator("#stopwatch-value")).toHaveText("00:05");
  await page.reload();
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(page.locator("#stopwatch-value")).toHaveText("00:05");
});

test("a pending daily challenge shows loading rather than an unavailable image", async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route("**/api/daily", async route => {
    await held;
    await route.continue();
  });
  await page.goto("/daily");
  const placeholder = page.locator("#scene-placeholder");
  await expect(placeholder).toHaveText("Image loading");
  await expect(placeholder).toHaveAttribute("aria-busy", "true");
  expect(await placeholder.evaluate(node => getComputedStyle(node, "::before").animationName)).toBe("image-loading-spin");
  release();
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(placeholder).toBeHidden();
  await expect(placeholder).toHaveAttribute("aria-busy", "false");
});
