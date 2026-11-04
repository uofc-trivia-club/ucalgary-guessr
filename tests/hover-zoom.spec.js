import { test, expect } from '@playwright/test';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.route('https://js.arcgis.com/5.1/', route => route.fulfill({
    path: path.resolve('tests/fixtures/arcgis.js'), contentType: 'text/javascript',
  }));
});

test('hovering a tile enlarges it and dims its neighbours without changing the grid', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Cursor hover interaction');
  await page.goto('/');
  const weekly = page.locator('.landing-option-weekly');
  const other = page.locator('.landing-option-play');
  const before = await weekly.boundingBox();
  const grid = await page.locator('.landing-options').boundingBox();
  await weekly.hover();
  await expect.poll(async () => (await weekly.boundingBox()).width).toBeGreaterThan(before.width * 1.02);
  await expect.poll(() => other.evaluate(node => Number(getComputedStyle(node).opacity))).toBeLessThan(1);
  expect(await other.evaluate(node => getComputedStyle(node).filter)).not.toBe('none');
  expect(await page.locator('.landing-options').boundingBox()).toEqual(grid);
  await page.mouse.move(0, 0);
  await expect.poll(() => other.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1);
  await expect.poll(async () => Math.abs((await weekly.boundingBox()).width - before.width)).toBeLessThan(1);
});

test('reduced motion keeps tile emphasis without an enlarging animation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Cursor hover interaction');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const weekly = page.locator('.landing-option-weekly');
  const before = await weekly.boundingBox();
  await weekly.hover();
  expect((await weekly.boundingBox()).width).toBe(before.width);
  await expect.poll(() => page.locator('.landing-option-play').evaluate(node => Number(getComputedStyle(node).opacity))).toBeLessThan(1);
});

for (const mode of ['play', 'daily', 'weekly']) {
  test(`${mode} wheel zoom stays clipped, has limits, and resets for the next photo`, async ({ page }) => {
    await page.goto('/' + mode);
    const image = page.locator('#scene-image');
    const frame = page.locator('.scene-frame');
    await expect(image).toBeVisible();
    const before = await image.boundingBox();
    const fixedFrame = await frame.boundingBox();
    await page.mouse.move(fixedFrame.x + fixedFrame.width / 2, fixedFrame.y + fixedFrame.height / 2);
    await page.mouse.wheel(0, -500);
    await expect.poll(async () => (await image.boundingBox()).width).toBeGreaterThan(before.width * 1.2);
    expect(await frame.boundingBox()).toEqual(fixedFrame);
    expect(await frame.evaluate(node => getComputedStyle(node).overflow)).toBe('hidden');
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -500);
    await expect.poll(() => image.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).a)).toBe(4);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 500);
    await expect.poll(() => image.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).a)).toBe(1);
    await page.mouse.wheel(0, -500);
    await expect.poll(async () => (await image.boundingBox()).width).toBeGreaterThan(before.width * 1.2);
    await page.evaluate(async () => (await import('/js/ui.js')).setSceneImage('/assets/photos/outdoors/MH-south.webp'));
    await expect(image).toHaveAttribute('src', '/assets/photos/outdoors/MH-south.webp');
    await expect(image).toBeVisible();
    expect(await image.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).a)).toBe(1);
    expect(await frame.boundingBox()).toEqual(fixedFrame);
    expect(await image.evaluate(node => node.draggable)).toBe(false);
    expect(await image.evaluate(node => {
      const event = new Event('contextmenu', { bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(true);
  });
}

for (const mode of ['play', 'daily', 'weekly']) {
  test(mode + ' lets a held pointer pan zoomed photos in every direction within fixed bounds', async ({ page }) => {
    await page.goto('/' + mode);
    const image = page.locator('#scene-image');
    const frame = page.locator('.scene-frame');
    await expect(image).toBeVisible();
    await page.evaluate(async () => (await import('/js/ui.js')).setSceneImage('/assets/photos/outdoors/EEEL-31st-terminal.webp'));
    await expect(image).toHaveAttribute('src', '/assets/photos/outdoors/EEEL-31st-terminal.webp');
    const fixed = await frame.boundingBox();
    const center = { x: fixed.x + fixed.width / 2, y: fixed.y + fixed.height / 2 };
    const initial = await image.boundingBox();
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 35, center.y + 30);
    await page.mouse.up();
    expect(await image.boundingBox()).toEqual(initial);
    await page.mouse.move(center.x, center.y);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -500);
    await expect.poll(() => image.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).a)).toBe(4);
    await expect(frame).toHaveCSS('cursor', 'grab');
    const zoomed = await image.boundingBox();
    for (const [dx, dy] of [[40, 30], [-40, -30]]) {
      await page.mouse.move(center.x, center.y);
      const before = await image.boundingBox();
      await page.mouse.down();
      await expect(frame).toHaveCSS('cursor', 'grabbing');
      await page.mouse.move(center.x + dx, center.y + dy, { steps: 3 });
      const after = await image.boundingBox();
      expect(after.x - before.x).toBeCloseTo(dx, 0);
      expect(after.y - before.y).toBeCloseTo(dy, 0);
      await page.mouse.up();
      await expect(frame).toHaveCSS('cursor', 'grab');
      await page.mouse.move(center.x + 65, center.y + 65);
      expect(await image.boundingBox()).toEqual(after);
    }
    expect(await image.boundingBox()).toEqual(zoomed);
    // Captured drags continue outside the frame, stop on release, and clamp at photo edges.
    for (const direction of [1, -1]) {
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.mouse.move(center.x + 4000 * direction, center.y + 4000 * direction);
      const edge = await image.boundingBox();
      expect(edge.x).toBeLessThanOrEqual(fixed.x + 1);
      expect(edge.y).toBeLessThanOrEqual(fixed.y + 1);
      expect(edge.x + edge.width).toBeGreaterThanOrEqual(fixed.x + fixed.width - 1);
      expect(edge.y + edge.height).toBeGreaterThanOrEqual(fixed.y + fixed.height - 1);
      expect(await frame.boundingBox()).toEqual(fixed);
      await page.mouse.up();
      await page.mouse.move(center.x, center.y);
      expect(await image.boundingBox()).toEqual(edge);
    }
    // A cancelled pointer cannot leave the photo stuck to the cursor.
    await page.mouse.down();
    await frame.evaluate(node => node.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
    await expect(frame).toHaveCSS('cursor', 'grab');
    const cancelled = await image.boundingBox();
    await page.mouse.move(center.x + 40, center.y + 30);
    expect(await image.boundingBox()).toEqual(cancelled);
    await page.mouse.up();
    await page.mouse.move(center.x, center.y);
    // Replacing the photo during a drag cancels that interaction and resets the view.
    await page.mouse.down();
    await page.evaluate(async () => (await import('/js/ui.js')).setSceneImage('/assets/photos/outdoors/EEEL-31st-terminal.webp'));
    await expect(image).toBeVisible();
    await page.mouse.move(center.x + 40, center.y + 30);
    await page.mouse.up();
    expect(await image.boundingBox()).toEqual(initial);
    await expect(frame).not.toHaveCSS('cursor', 'grabbing');
  });
}
