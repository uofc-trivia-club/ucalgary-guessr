import { test, expect } from "@playwright/test";
import path from "node:path";

import { photoFiles, photoResponse } from "./fixtures/photo-files.js";
const photoFilenames = photoFiles();

test.beforeEach(async ({ page }) => {
  await page.route("https://js.arcgis.com/5.1/", (route) => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
  await page.goto("/play");
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect.poll(() => page.locator("#scene-image").evaluate((img) =>
    img.complete && img.naturalWidth > 0 && img.style.opacity === "1"
  )).toBe(true);
});

async function clickMap(page) {
  const mapTab = page.getByRole("tab", { name: "Map", exact: true });
  if (await mapTab.isVisible()) await mapTab.click();
  const map = page.locator("#map");
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test("one click or tap selects and highlights a building before delayed click handling", async ({ page }) => {
  await clickMap(page);
  await expect(page.locator("#result-primary")).toHaveText("Administration selected.", { timeout: 350 });
  const guess = await page.evaluate(async () => (await import("/js/gameState.js")).getLastGuess());
  expect(guess).toMatchObject({ type: "building", buildingName: "Administration", latitude: 51.07817 });
  await expect(page.locator("#make-guess-btn")).toBeEnabled();
  expect(await page.locator("#map").evaluate((map) => map.graphics.items.map((g) => g.geometry.type))).toEqual(["polygon"]);
});

test("switching from a building to empty ground stays responsive with a stalled GPU lookup", async ({ page }) => {
  await clickMap(page);
  await expect(page.locator("#result-primary")).toHaveText("Administration selected.");
  await page.locator("#map").evaluate(map => {
    window.originalBuildingFeatures = map.features;
    window.gpuLookupCalls = 0;
    map.features = [];
    map.hitTest = () => { window.gpuLookupCalls++; return new Promise(() => {}); };
    map.fetchPopupFeatures = () => new Promise(() => {});
  });
  await clickMap(page);
  await expect(page.locator("#selected-location")).toHaveText("Map location selected", { timeout: 350 });
  await expect(page.locator("#make-guess-btn")).toBeEnabled();
  expect(await page.locator("#map").evaluate(map => map.graphics.items.map(graphic => graphic.geometry.type)))
    .toEqual(["point"]);
  expect(await page.evaluate(() => window.gpuLookupCalls)).toBe(0);

  await page.locator("#map").evaluate(map => { map.features = window.originalBuildingFeatures; });
  await clickMap(page);
  await expect(page.locator("#result-primary")).toHaveText("Administration selected.", { timeout: 350 });
});

test("map hover keeps its bounds and explicit expansion still works", async ({ page }) => {
  const mapTab = page.getByRole("tab", { name: "Map", exact: true });
  if (await mapTab.isVisible()) {
    await mapTab.click();
    await expect(page.locator("#map-expand-btn")).toBeHidden();
    return;
  }
  const panel = page.locator("#map-panel");
  await panel.hover();
  expect(await panel.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  const before = await panel.boundingBox();
  await page.locator("#map-expand-btn").click();
  await expect(page.locator("#map-expand-btn")).toHaveAttribute("aria-pressed", "true");
  const expanded = await panel.boundingBox();
  if (test.info().project.use.isMobile) {
    expect(expanded.width).toBeGreaterThanOrEqual(before.width);
  } else {
    expect(expanded.width).toBeGreaterThan(before.width + 100);
  }
  expect(await panel.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  await page.locator("#map-expand-btn").click();
  await expect(page.locator("#map-expand-btn")).toHaveAttribute("aria-pressed", "false");
});

test("all landscape and portrait photos fit fully inside their frame", async ({ page }) => {
  test.setTimeout(180000);
  for (const name of photoFilenames) {
    await page.evaluate(async (name) => { (await import("/js/ui.js")).setSceneImage(`/assets/photos/${name}`); }, name);
    await expect(page.locator("#scene-image")).toHaveAttribute("src", `/assets/photos/${name}`);
    await expect.poll(() => page.locator("#scene-image").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    const fit = await page.locator("#scene-image").evaluate((img) => {
      const photo = img.getBoundingClientRect();
      const frame = img.parentElement.getBoundingClientRect();
      return { width: photo.width, height: photo.height, left: photo.left - frame.left, top: photo.top - frame.top,
        right: photo.right - frame.right, bottom: photo.bottom - frame.bottom, fit: getComputedStyle(img).objectFit };
    });
    expect(fit.fit).toBe("contain");
    expect(fit.width).toBeGreaterThan(100);
    expect(fit.height).toBeGreaterThan(100);
    expect(fit.left).toBeGreaterThanOrEqual(0);
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.right).toBeLessThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(0);
  }
});

test("loading hides the old photo and uses the original cacheable URL", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route("**/assets/photos/held.webp*", async (route) => {
    await held;
    await route.fulfill(photoResponse("outdoors/EEEL-31st-terminal.webp"));
  });
  await page.evaluate(async () => { (await import("/js/ui.js")).setSceneImage("/assets/photos/held.webp"); });
  await expect(page.locator("#scene-image")).toBeHidden();
  await expect(page.locator("#scene-placeholder")).toBeVisible();
  await expect(page.locator("#scene-placeholder")).toHaveText("Image loading");
  await expect(page.locator("#scene-placeholder")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#scene-placeholder")).toHaveClass(/is-loading/);
  release();
  await expect(page.locator("#scene-image")).toHaveAttribute("src", "/assets/photos/held.webp");
  await expect(page.locator("#scene-image")).toBeVisible();
});

test("an outdated image load cannot replace the current photo", async ({ page }) => {
  let release;
  let started;
  const held = new Promise((resolve) => { release = resolve; });
  const requested = new Promise((resolve) => { started = resolve; });
  await page.route("**/assets/photos/slow.webp*", async (route) => {
    started();
    await held;
    await route.fulfill(photoResponse("outdoors/EEEL-31st-terminal.webp"));
  });
  await page.evaluate(async () => { (await import("/js/ui.js")).setSceneImage("/assets/photos/slow.webp"); });
  await requested;
  await page.evaluate(async () => { (await import("/js/ui.js")).setSceneImage("/assets/photos/outdoors/MH-south.webp"); });
  await expect(page.locator("#scene-image")).toHaveAttribute("src", /MH-south.webp/);
  const decoded = page.evaluate(async () => {
    const oldPhoto = new Image();
    oldPhoto.src = "/assets/photos/slow.webp";
    await oldPhoto.decode();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  release();
  await decoded;
  await expect(page.locator("#scene-image")).toHaveAttribute("src", /MH-south.webp/);
});

test("clearing an image cancels a pending load", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route("**/assets/photos/slow.webp*", async (route) => {
    await held;
    await route.fulfill(photoResponse("outdoors/EEEL-31st-terminal.webp"));
  });
  await page.evaluate(async () => {
    const ui = await import("/js/ui.js");
    ui.setSceneImage("/assets/photos/slow.webp");
    ui.setSceneImage("");
  });
  const decoded = page.evaluate(async () => {
    const image = new Image();
    image.src = "/assets/photos/slow.webp";
    await image.decode();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  release();
  await decoded;
  await expect(page.locator("#scene-image")).toBeHidden();
  await expect(page.locator("#scene-image")).not.toHaveAttribute("src");
});

test("a failed photo keeps the placeholder visible and reports the error", async ({ page }) => {
  await page.route("**/assets/photos/missing.webp*", (route) => route.fulfill({ status: 404 }));
  await page.evaluate(async () => { (await import("/js/ui.js")).setSceneImage("/assets/photos/missing.webp"); });
  await expect(page.locator("#result")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#scene-image")).toBeHidden();
  await expect(page.locator("#scene-placeholder")).toHaveText("No image available.");
});

test("random scoring, next image, final result, and restart are preserved", async ({ page }) => {
  const firstRound = await page.evaluate(async () => (await import("/js/gameState.js")).getCurrentRound());
  for (let index = 1; index <= 5; index++) {
    await expect(page.locator("#scene-image")).toBeVisible();
    await clickMap(page);
    await expect(page.locator("#result-primary")).toHaveText("Administration selected.");
    await page.locator("#make-guess-btn").click();
    await expect(page.locator("#result")).toHaveAttribute("data-state", "success");
    await expect(page.locator("#make-guess-btn")).toBeDisabled();
    if (index < 5) {
      await page.locator("#next-image-btn").click();
      await expect(page.locator("#round-title")).toHaveText(`Photo ${index + 1} of 5`);
    }
  }
  // A candidate can mix a previously seen photo with four fresh photos now
  // that the pool is larger. It must never become a four-photo round.
  const seen = new Set(firstRound.images.map(image => image.imagePath));
  const fresh = (photoFilenames.length ? photoFilenames : Array.from({ length: 4 }, (_, i) => `placeholder-${i}.webp`)).filter(name => !name.startsWith("weekly-images/")).map(name => `/assets/photos/${name}`).filter(imagePath => !seen.has(imagePath));
  const partialOverlap = {
    roundId: "partial-overlap-round", name: "Random Campus Round",
    images: [firstRound.images[0], ...fresh.slice(0, 4).map((imagePath, index) => ({ id: `fresh-${index}`, imagePath }))],
  };
  await page.route("**/api/rounds/random", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify(partialOverlap),
  }));
  await page.locator("#restart-btn").click();
  await expect(page.locator("#round-title")).toHaveText("Photo 1 of 5");
  await expect(page.locator("#score-summary")).toHaveText("0 / 25,000");
});

test("Daily play preserves the timer, single attempt, and leaderboard", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(page.locator("#daily-stopwatch")).toBeVisible();
  await clickMap(page);
  await expect(page.locator("#result-primary")).toHaveText("Administration selected.");
  await page.locator("#make-guess-btn").click();
  await expect(page.locator("#result")).toHaveAttribute("data-state", "success");
  await expect(page.locator("#make-guess-btn")).toBeDisabled();
  await clickMap(page);
  await expect(page.locator("#result")).toHaveAttribute("data-state", "success");
  await page.locator("#leaderboard-btn").click();
  await expect(page.locator("#leaderboard-dialog")).toBeVisible();
});
