import { test, expect } from "@playwright/test";
import path from "node:path";

const administration = { type: "building", buildingName: "Administration", latitude: 51.07818792, longitude: -114.12710165 };
const result = {
  score: 5000, distanceMetres: 0, elapsedMs: 359000, saved: false, rank: null,
  exactBuilding: true, answer: administration, guess: administration,
};

async function daily(page, { completed = false, saved = false, ...overrides } = {}) {
  let done = completed;
  const scored = { ...result, saved, ...overrides };
  await page.route("https://js.arcgis.com/5.1/", route => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
  await page.route("**/api/daily", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
    date: "2026-10-19", image: { id: "atrium-01", imagePath: "/assets/photos/admins/general/AD-atrium.webp" },
    completed: done, saved, startedAt: Date.now() - 359000, elapsedMs: done ? 359000 : null,
    ...(done ? { result: scored, score: scored.score, rank: scored.rank } : {}),
  }) }));
  await page.route("**/api/daily/guess", route => {
    done = true;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(scored) });
  });
  await page.goto("/daily");
  await expect(page.locator(completed ? "#status-panel" : "#scene-image")).toBeVisible();
}

async function submit(page) {
  const tab = page.getByRole("tab", { name: "Map", exact: true });
  if (await tab.isVisible()) await tab.click();
  await page.locator("#map").click();
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
}

test("a perfect Daily has one clear achievement, compact details and useful actions", async ({ page }, testInfo) => {
  await daily(page);
  await submit(page);
  await expect(page.locator("#result-primary")).toHaveText("5,000 / 5,000");
  await expect(page.locator("#result-feedback")).toHaveText("Perfect guess!");
  await expect(page.locator("#result-feedback-detail")).toHaveText("You know campus well :)");
  await expect(page.locator("#result-guess-row")).toBeHidden();
  await expect(page.locator("#result-answer-label")).toHaveText("Exact match");
  await expect(page.locator("#result-answer")).toHaveText("Administration");
  await expect(page.locator("#result-distance")).toHaveText("0 m away");
  await expect(page.locator("#result-time")).toHaveText("05:59");
  await expect(page.locator("#result-ranking")).toHaveText("Guest · Unranked");
  await expect(page.locator("#controls")).toBeHidden();
  await expect(page.locator(".score-row")).toBeHidden();
  await expect(page.locator("#daily-stopwatch")).toBeHidden();
  await expect(page.locator("#game-page-title")).toHaveText("Daily Challenge · October 19");
  const share = page.getByRole("button", { name: "Share Result", exact: true });
  await expect(share).toBeVisible();
  await page.getByRole("button", { name: "View Leaderboard", exact: true }).click();
  await expect(page.locator("#leaderboard-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close leaderboard", exact: true }).click();
  await expect(page.locator("#daily-guest-note")).toContainText("future Daily challenges");
  await page.getByRole("button", { name: "Sign in for future Dailies", exact: true }).click();
  await expect(page.locator("#auth-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("perfect-daily.png") });
  await page.locator("#status-panel").screenshot({ path: testInfo.outputPath("daily-result-card.png") });
});

test("perfect reveals celebrate once and respect reduced motion", async ({ page }) => {
  await daily(page);
  await submit(page);
  await expect(page.locator("#result")).toHaveAttribute("data-celebrate", "true");
  await page.reload();
  await expect(page.locator("#result-primary")).toHaveText("5,000 / 5,000");
  await expect(page.locator("#result")).toHaveAttribute("data-celebrate", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    (await import("/js/ui.js")).showGuessResult({ score: 5000, daily: true, isFinal: true, animate: true });
  });
  await expect(page.locator("#result")).toHaveAttribute("data-celebrate", "false");
});

test("incorrect results retain both locations with an optional compact map key", async ({ page }, testInfo) => {
  await daily(page, { completed: true, score: 3200, exactBuilding: false, distanceMetres: 140,
    guess: { type: "building", buildingName: "Science A", latitude: 51.07913657, longitude: -114.12818583 } });
  await expect(page.locator("#result-feedback")).toHaveText("Good attempt!");
  await expect(page.locator("#result-guess-row")).toBeVisible();
  await expect(page.locator("#result-guess")).toHaveText("Science A");
  await expect(page.locator("#result-answer")).toHaveText("Administration");
  await expect(page.locator("#map-result-distance")).toHaveText("140 m apart");
  await expect(page.locator("#map-result-legend")).toBeHidden();
  await page.getByRole("button", { name: "Map key", exact: true }).click();
  await expect(page.locator("#map-result-legend")).toBeVisible();
  await page.getByRole("button", { name: "Map key", exact: true }).click();
  await expect(page.locator("#map-result-legend")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("incorrect-daily.png") });
});

test("ranked and legacy results show honest status without guest sign-in prompts", async ({ page }) => {
  await daily(page, { completed: true, saved: true, rank: 3, guess: null, exactBuilding: false });
  await expect(page.locator("#result-ranking")).toHaveText("#3 · Score saved");
  await expect(page.locator("#result-guess")).toHaveText("Not recorded");
  await expect(page.locator("#result-feedback")).toHaveText("Perfect score!");
  await expect(page.locator("#result-feedback-detail")).toHaveText("");
  await expect(page.locator("#daily-guest-note")).toBeHidden();
  await expect(page.locator("#result-secondary")).toContainText("not recorded");
});

test("signed-in unranked results explain the next Daily without asking for another sign-in", async ({ page }) => {
  await page.route("**/api/auth/me", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ user: { id: 1, username: "player" } }),
  }));
  await daily(page, { completed: true });
  await expect(page.locator("#result-ranking")).toHaveText("Unranked");
  await expect(page.locator("#daily-guest-message")).toHaveText("This attempt stays unranked. Your next Daily can count toward the leaderboard.");
  await expect(page.getByRole("button", { name: "Sign in for future Dailies", exact: true })).toBeHidden();
});

test("Daily results and actions fit narrow and short screens without clipping the map", async ({ page }) => {
  await daily(page, { completed: true });
  for (const viewport of [{ width: 320, height: 568 }, { width: 740, height: 360 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    const map = await page.locator("#map-panel").boundingBox();
    expect(map.height).toBeGreaterThan(60);
    const actions = page.locator("#daily-result-actions");
    await actions.scrollIntoViewIfNeeded();
    const bounds = await actions.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "View Leaderboard", exact: true }).click();
    await expect(page.locator("#leaderboard-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close leaderboard", exact: true }).click();
  }
});
