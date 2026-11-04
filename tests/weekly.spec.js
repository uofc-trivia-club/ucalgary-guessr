import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("https://js.arcgis.com/5.1/", route => route.fulfill({ path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript" }));
});

test("Weekly card sits between Play and Daily and opens the new game", async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-option')).toHaveCount(3);
  expect(await page.locator('.landing-option').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(['/play', '/weekly', '/daily']);
  expect(await page.locator('.landing-option-weekly').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('weekly-card.jpg');
  await page.locator('.landing-option-weekly').click();
  await expect(page).toHaveURL(url => url.pathname === '/weekly');
  await expect(page.locator('#scene-image')).toBeVisible();
  await expect(page.locator('#game-page-title')).toContainText('Weekly Challenge');
  await expect(page.locator('#daily-stopwatch')).toBeVisible();
});

test("Weekly uses its date range, timer, result restoration, and own leaderboard", async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('/weekly');
  await expect(page.locator('#scene-image')).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page.locator('#stopwatch-value')).toHaveText('00:03');
  await page.goto('/daily');
  await expect(page.locator('#scene-image')).toBeVisible();
  await page.clock.runFor(10000);
  await page.goto('/weekly');
  await expect(page.locator('#scene-image')).toBeVisible();
  await expect(page.locator('#stopwatch-value')).toHaveText('00:03');
  const tab = page.getByRole('tab', { name: 'Map', exact: true });
  if (await tab.isVisible()) await tab.click();
  await page.locator('#map').click();
  await page.getByRole('button', { name: 'Submit guess', exact: true }).click();
  await expect(page.locator('#result')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#result-kicker')).toContainText('Weekly Challenge');
  await expect(page.locator('#daily-share')).toBeVisible();
  await expect(page.locator('#daily-guest-message')).toContainText('Weekly');
  await page.reload();
  await expect(page.locator('#result')).toHaveAttribute('data-state', 'success');
  const leaderboard = page.waitForResponse(response => response.url().includes('/api/weekly/leaderboard'));
  await page.locator('#result-leaderboard-btn').click();
  await leaderboard;
  await expect(page.locator('#leaderboard-title')).toHaveText('Weekly leaderboard');
  await page.screenshot({ path: testInfo.outputPath('weekly-result.png') });
});

test("Weekly formats the upcoming example period without changing Daily's date format", async ({ page }) => {
  await page.route('**/api/weekly', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    date: '2026-10-25', endDate: '2026-11-01', image: { id: 'atrium-01', imagePath: '/assets/photos/weekly-images/BI-hallway.webp' }, completed: false, startedAt: Date.now()
  }) }));
  await page.goto('/weekly');
  await expect(page.locator('#game-page-title')).toHaveText('Weekly Challenge · Oct 25 – Nov 1');
});
