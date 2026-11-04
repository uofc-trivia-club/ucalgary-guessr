import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("https://js.arcgis.com/5.1/", (route) => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
  await page.goto("/play");
  await expect(page.locator("#scene-image")).toBeVisible();
});

async function selectBuilding(page) {
  const tab = page.getByRole("tab", { name: "Map", exact: true });
  if (await tab.isVisible()) await tab.click();
  await page.locator("#map").click();
}

test("desktop submission stays beside the map when expanded and can advance the game", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop map footer");
  await selectBuilding(page);
  const workspace = page.locator("#map-workspace");
  await expect(workspace.locator("#selected-location")).toContainText("Administration");
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  const submit = workspace.getByRole("button", { name: "Submit guess", exact: true });
  await expect(submit).toBeVisible();
  const mapBox = await page.locator("#map-panel").boundingBox();
  const footerBox = await page.locator("#controls").boundingBox();
  expect(footerBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height - 1);
  expect(Math.abs(footerBox.x - mapBox.x)).toBeLessThanOrEqual(1);
  expect(mapBox.width).toBeGreaterThan(page.viewportSize().width * 0.8);
  await submit.click();
  await expect(workspace.locator("#result-details")).toBeVisible();
  await workspace.getByRole("button", { name: "Next image", exact: true }).click();
  await expect(page.locator("#round-title")).toHaveText("Photo 2 of 5");
  await expect(page.locator("#result-details")).toBeHidden();
});

test("result reveal separates the guess, answer, distance, and points", async ({ page }) => {
  await selectBuilding(page);
  const responsePromise = page.waitForResponse(response => /\/api\/rounds\/[^/]+\/guess$/.test(response.url()));
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
  const result = await (await responsePromise).json();
  await expect(page.locator("#result-details")).toBeVisible();
  await expect(page.locator("#result-guess")).toHaveText("Administration");
  await expect(page.locator("#result-answer")).toHaveText(result.answer.buildingName);
  await expect(page.locator("#result-distance")).toHaveText(`${Math.round(result.distanceMetres).toLocaleString()} m away`);
  await expect(page.locator("#result-primary")).toHaveText(`${result.score.toLocaleString()} pts`);
  const pointsSize = await page.locator("#result-primary").evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  expect(pointsSize).toBeGreaterThanOrEqual(28);
  await expect(page.getByRole("button", { name: "Next image", exact: true })).toBeVisible();
  await expect(page.locator("#result-primary")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Next image", exact: true })).toBeFocused();
});

test("gameplay header keeps photo progress, total score, help and leaderboard together", async ({ page }) => {
  const header = page.locator(".site-header");
  await expect(header.locator("#round-title")).toHaveText("Photo 1 of 5");
  await expect(header.locator("#score-summary")).toHaveText("0 / 25,000");
  await expect(header.getByRole("button", { name: "Leaderboard", exact: true })).toBeVisible();
  await header.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "How to play", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close help", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "How to play", exact: true })).toBeHidden();
});

test("submission failure preserves selection and allows retry from the map footer", async ({ page }) => {
  await selectBuilding(page);
  await page.route("**/api/rounds/*/guess", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Please try again." }),
  }), { times: 1 });
  const submit = page.getByRole("button", { name: "Submit guess", exact: true });
  await submit.click();
  await expect(page.locator("#result")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#result-details")).toBeHidden();
  await expect(page.locator("#selected-location")).toContainText("Administration");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator("#result-details")).toBeVisible();
});

test("pin guesses have a readable result and keep controls on screen at small sizes", async ({ page }, testInfo) => {
  await page.locator("#map").evaluate(map => { map.features = []; });
  await selectBuilding(page);
  await expect(page.locator("#selected-location")).toHaveText("Map location selected");
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
  await expect(page.locator("#result-guess")).toHaveText("Map pin");
  if (testInfo.project.name !== "mobile") return;
  for (const viewport of [{ width: 320, height: 568 }, { width: 740, height: 360 }]) {
    await page.setViewportSize(viewport);
    const controls = await page.locator("#controls").boundingBox();
    const panel = await page.locator("#map-panel").boundingBox();
    expect(controls.y + controls.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(panel.height).toBeGreaterThan(60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("a completed Daily reload restores the guess, answer, distance, and result map", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await selectBuilding(page);
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
  await expect(page.locator("#result-details")).toBeVisible();
  const original = await page.locator("#result-details").innerText();
  await page.reload();
  await expect(page.locator("#result-kicker")).toContainText("Daily Challenge");
  await expect(page.locator("#status-panel")).toBeVisible();
  await expect(page.locator("#result-details")).toBeVisible();
  await expect.poll(() => page.locator("#result-details").innerText()).toBe(original);
  const exact = await page.locator("#result-guess-row").isHidden();
  await expect(page.locator("#map-result-summary"))[exact ? "toBeHidden" : "toBeVisible"]();
  await expect(page.locator("#map-result-guess")).toHaveText("Administration");
  const graphics = await page.locator("#map").evaluate(map => map.graphics.items);
  expect(graphics.some(graphic => graphic.attributes?.resultRole === "guess")).toBe(!exact);
  expect(graphics.some(graphic => graphic.attributes?.resultRole === "answer")).toBe(true);
  await expect(page.locator("#make-guess-btn")).toBeDisabled();
  await expect(page.locator(".site-header #daily-stopwatch")).toBeHidden();
});
