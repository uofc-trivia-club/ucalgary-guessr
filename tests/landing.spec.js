import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("https://js.arcgis.com/5.1/", route => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
});

test("landing choices fit the screen without empty space pushing them out of view", async ({ page }, testInfo) => {
  const sizes = testInfo.project.name === "mobile"
    ? [[320, 780], [412, 840]] : [[1280, 720], [1920, 918]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".landing-option-play")).toBeInViewport({ ratio: 1 });
    for (const mode of ["play", "weekly", "daily"]) {
      const card = page.locator(".landing-option-" + mode);
      const bounds = await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
  }
});

test("landing loads its local assets and opens all three game modes", async ({ page }) => {
  const missingAssets = new Set();
  const isLocalAsset = url => url.origin === "http://127.0.0.1:3100"
    && /^\/(assets|css|js)\//.test(url.pathname);
  page.on("response", response => {
    const url = new URL(response.url());
    if (isLocalAsset(url) && response.status() >= 400) missingAssets.add(url.pathname);
  });
  page.on("requestfailed", request => {
    const url = new URL(request.url());
    if (isLocalAsset(url)) missingAssets.add(url.pathname);
  });
  for (const mode of ["play", "weekly", "daily"]) {
    await page.goto("/");
    expect([...missingAssets]).toEqual([]);
    await page.locator(".landing-option-" + mode).click();
    await expect(page).toHaveURL(url => url.pathname === "/" + mode);
    await expect(page.locator("#scene-image")).toBeVisible();
    await expect.poll(() => page.locator("#scene-image").evaluate(image =>
      image.complete && image.naturalWidth > 0)).toBe(true);
  }
});
