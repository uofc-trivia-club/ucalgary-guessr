import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile gameplay layout");
  await page.route("https://js.arcgis.com/5.1/", (route) => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
  await page.goto("/play");
  await expect(page.locator("#scene-image")).toBeVisible();
});

async function selectBuilding(page) {
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page.locator("#map").tap();
  await expect(page.locator("#selected-location")).toContainText("Administration");
}

async function expectWithinViewport(page, selector) {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

test("mobile tabs keep the guess and submission available on either panel", async ({ page }) => {
  const photo = page.getByRole("tab", { name: "Photo", exact: true });
  await expect(photo).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#map-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "Submit guess", exact: true })).toBeDisabled();
  await selectBuilding(page);
  await photo.click();
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(page.locator("#map-panel")).toBeHidden();
  await expect(page.locator("#selected-location")).toContainText("Administration");
  await expectWithinViewport(page, "#controls");
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
  await expect(page.locator("#result")).toHaveAttribute("data-state", "success");
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#map-panel")).toBeVisible();
  await page.getByRole("button", { name: "Next image", exact: true }).click();
  await expect(photo).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#selected-location")).toContainText("No location selected");
  await expect(page.locator("#make-guess-btn")).toBeDisabled();
});

test("mobile layout fits narrow, short, and tablet viewports without page scrolling", async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 740, height: 360 }, { width: 820, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const panel of ["Photo", "Map"]) {
      await page.getByRole("tab", { name: panel, exact: true }).click();
      await expectWithinViewport(page, "#controls");
      await expectWithinViewport(page, panel === "Photo" ? ".scene-frame" : "#map-panel");
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("tabs support keyboard navigation and restore both panels on desktop", async ({ page }) => {
  const photo = page.getByRole("tab", { name: "Photo", exact: true });
  const map = page.getByRole("tab", { name: "Map", exact: true });
  await photo.focus();
  await page.keyboard.press("ArrowRight");
  await expect(map).toBeFocused();
  await expect(map).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(photo).toBeFocused();
  await selectBuilding(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("#mobile-game-tabs")).toBeHidden();
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(page.locator("#map-panel")).toBeVisible();
  await page.setViewportSize({ width: 393, height: 727 });
  await expect(map).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#selected-location")).toContainText("Administration");
});

test("Daily submission keeps the single-attempt result and leaderboard accessible", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await expect(page.locator("#daily-stopwatch")).toBeVisible();
  await selectBuilding(page);
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
  await expect(page.locator("#result")).toHaveAttribute("data-state", "success");
  await expect(page.locator("#controls")).toBeHidden();
  await expectWithinViewport(page, "#daily-result-actions");
  await page.getByRole("tab", { name: "Photo", exact: true }).click();
  await expect(page.locator("#make-guess-btn")).toBeDisabled();
  await page.locator("#leaderboard-btn").click();
  await expect(page.locator("#leaderboard-dialog")).toBeVisible();
});
