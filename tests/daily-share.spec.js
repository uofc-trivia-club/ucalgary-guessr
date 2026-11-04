import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("https://js.arcgis.com/5.1/", route => route.fulfill({
    path: path.resolve("tests/fixtures/arcgis.js"), contentType: "text/javascript",
  }));
});

async function submitGuess(page) {
  const mapTab = page.getByRole("tab", { name: "Map", exact: true });
  if (await mapTab.isVisible()) await mapTab.click();
  await page.locator("#map").click();
  await page.getByRole("button", { name: "Submit guess", exact: true }).click();
  await expect(page.locator("#result")).toHaveAttribute("data-state", "success");
}

async function readClipboard(page) {
  // Windows clipboard text uses CRLF even when writeText receives LF.
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
}

test("completed Daily sharing copies all score tiers and their exact boundaries", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await page.evaluate(async () => (await import('/js/ui.js')).setGamePageMode('daily', '2026-10-22'));
  // Exercise the restored/legacy completion renderer, including a zero score.
  const cases = [
    [0, "0", "🟡🟡🟡🟡🟡"],
    [999, "999", "🟡🟡🟡🟡🟡"],
    [1000, "1,000", "🔴🟡🟡🟡🟡"],
    [1999, "1,999", "🔴🟡🟡🟡🟡"],
    [2000, "2,000", "🔴🔴🟡🟡🟡"],
    [2999, "2,999", "🔴🔴🟡🟡🟡"],
    [3000, "3,000", "🔴🔴🔴🟡🟡"],
    [3999, "3,999", "🔴🔴🔴🟡🟡"],
    [4000, "4,000", "🔴🔴🔴🔴🟡"],
    [4250, "4,250", "🔴🔴🔴🔴🟡"],
    [4999, "4,999", "🔴🔴🔴🔴🟡"],
    [5000, "5,000", "🔴🔴🔴🔴🔴"],
  ];
  for (const [score, text, emojis] of cases) {
    await page.evaluate(async score => {
      (await import("/js/ui.js")).showCompletedDaily({ score, saved: false });
    }, score);
    await page.getByRole("button", { name: "Share Result", exact: true }).click();
    await expect(page.locator("#daily-share-status")).toHaveText("Score copied!");
    expect(await readClipboard(page))
      .toBe(`UCalgaryGuessr Oct 22\n${text} / 5,000 ${emojis}\nucalgaryguessr.ca`);
  }
});

test("Daily Share appears after submission and copies the same result after reload", async ({ page }, testInfo) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  const share = page.getByRole("button", { name: "Share Result", exact: true });
  await expect(share).toBeHidden();
  const response = page.waitForResponse(response => response.url().endsWith("/api/daily/guess"));
  await submitGuess(page);
  const result = await (await response).json();
  await share.click();
  await expect(page.locator("#daily-share-status")).toHaveText("Score copied!");
  const copied = await readClipboard(page);
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(result.date + 'T00:00:00Z'));
  expect(copied.split("\n")[0]).toBe('UCalgaryGuessr ' + date);
  expect(copied.split("\n")[1]).toMatch(new RegExp('^' + result.score.toLocaleString('en-US') + ' / 5,000 (?:🔴|🟡){5}$', 'u'));
  expect(copied.split("\n")[2]).toBe('ucalgaryguessr.ca');
  expect(copied.split("\n")).toHaveLength(3);
  await page.reload();
  await expect(page.locator("#result-kicker")).toContainText("Daily Challenge");
  await share.click();
  await expect(page.locator("#daily-share-status")).toHaveText("Score copied!");
  expect(await readClipboard(page)).toBe(copied);
  await page.screenshot({ path: testInfo.outputPath("daily-share.png") });
});

test("regular rounds never offer Daily sharing, including the final result", async ({ page }) => {
  await page.goto("/play");
  for (let index = 1; index <= 5; index++) {
    await expect(page.locator("#scene-image")).toBeVisible();
    await submitGuess(page);
    await expect(page.getByRole("button", { name: "Share Result", exact: true })).toBeHidden();
    if (index < 5) await page.getByRole("button", { name: "Next image", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "New random round", exact: true })).toBeVisible();
});

test("a denied clipboard exposes selected score text for manual copying and allows retry", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.locator("#scene-image")).toBeVisible();
  await page.evaluate(async () => {
    const ui = await import('/js/ui.js');
    ui.setGamePageMode('daily', '2026-10-22');
    ui.showCompletedDaily({ score: 5000, saved: false });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new DOMException("Permission denied", "NotAllowedError"); },
    } });
  });
  await page.getByRole("button", { name: "Share Result", exact: true }).click();
  await expect(page.locator("#daily-share-status")).toHaveText("Couldn't copy automatically. Select and copy your score below.");
  const text = page.getByRole("textbox", { name: "Score to copy", exact: true });
  await expect(text).toBeVisible();
  await expect(text).toHaveValue("UCalgaryGuessr Oct 22\n5,000 / 5,000 🔴🔴🔴🔴🔴\nucalgaryguessr.ca");
  await expect(text).toBeFocused();
  expect(await text.evaluate(node => node.value.substring(node.selectionStart, node.selectionEnd)))
    .toBe("UCalgaryGuessr Oct 22\n5,000 / 5,000 🔴🔴🔴🔴🔴\nucalgaryguessr.ca");
  await page.evaluate(() => { delete navigator.clipboard; });
  await page.getByRole("button", { name: "Share Result", exact: true }).click();
  await expect(page.locator("#daily-share-status")).toHaveText("Score copied!");
  await expect(text).toBeHidden();
});
test('Weekly sharing keeps its period in the three-line result format', async ({ page }) => {
  await page.goto('/weekly');
  await expect(page.locator('#scene-image')).toBeVisible();
  await page.evaluate(async () => {
    const ui = await import('/js/ui.js');
    ui.setGamePageMode('weekly', '2026-10-25', '2026-11-01');
    ui.showCompletedDaily({ score: 4250, saved: false });
  });
  await page.getByRole('button', { name: 'Share Result', exact: true }).click();
  await expect(page.locator('#daily-share-status')).toHaveText('Score copied!');
  expect(await readClipboard(page)).toBe('UCalgaryGuessr Weekly Oct 25 – Nov 1\n4,250 / 5,000 🔴🔴🔴🔴🟡\nucalgaryguessr.ca');
});
