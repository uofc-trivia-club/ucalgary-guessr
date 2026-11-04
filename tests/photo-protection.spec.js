import { test, expect } from '@playwright/test';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.route('https://js.arcgis.com/5.1/', route => route.fulfill({
    path: path.resolve('tests/fixtures/arcgis.js'), contentType: 'text/javascript',
  }));
});

for (const mode of ['play', 'daily', 'weekly']) {
  test(`${mode} blocks photo context menus, dragging, and copying without blocking the game`, async ({ page }) => {
    await page.goto('/' + mode);
    const image = page.locator('#scene-image');
    await expect(image).toBeVisible();
    await page.evaluate(() => {
      window.photoContextMenu = null;
      document.addEventListener('contextmenu', event => {
        window.photoContextMenu = { prevented: event.defaultPrevented, imageTarget: event.target.id === 'scene-image' };
      }, { once: true });
    });
    await page.locator('.scene-frame').click({ button: 'right' });
    expect(await page.evaluate(() => window.photoContextMenu)).toEqual({ prevented: true, imageTarget: false });
    expect(await image.evaluate(img => img.draggable)).toBe(false);
    expect(await image.evaluate(img => getComputedStyle(img).pointerEvents)).toBe('none');
    expect(await image.evaluate(img => ['contextmenu', 'dragstart', 'copy'].map(type => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      return event.defaultPrevented;
    }))).toEqual([true, true, true]);
    // Scope the restriction to the photo; normal copying elsewhere remains available.
    expect(await page.locator('#game-page-title').evaluate(node => {
      const event = new Event('copy', { bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(false);
    const tab = page.getByRole('tab', { name: 'Map', exact: true });
    if (await tab.isVisible()) await tab.click();
    await page.locator('#map').click();
    await page.getByRole('button', { name: 'Submit guess', exact: true }).click();
    await expect(page.locator('#result')).toHaveAttribute('data-state', 'success');
    if (mode === 'play') {
      await page.getByRole('button', { name: 'Next image', exact: true }).click();
      await expect(image).toBeVisible();
      expect(await image.evaluate(img => {
        const event = new Event('contextmenu', { bubbles: true, cancelable: true });
        img.dispatchEvent(event);
        return event.defaultPrevented;
      })).toBe(true);
    }
  });
}
