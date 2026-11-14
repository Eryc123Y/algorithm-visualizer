/**
 * The site's polish in a browser (roadmap 5.6): code coloured at build
 * time and again when the playground changes it, the slide's overlays as
 * a loop that can be paused and that stays still for readers who ask for
 * less motion, fonts that do not move the page, and the share page's bar.
 */
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

/** Layout shifts since the page started, as Core Web Vitals count them. */
const watchShifts = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { shift: number };
    w.shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!e.hadRecentInput) w.shift += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });

test('code is coloured, and stays coloured when the playground changes it', async ({
  page,
}) => {
  await page.goto('/dijkstra/');
  const web = page.locator('.snippet[data-snippet="web"] code');
  await expect(web.locator('.tok-name').first()).toHaveText('script');
  await expect(web.locator('.tok-string').first()).toHaveText('"module"');
  await expect(
    page.locator('.snippet[data-snippet="link"] code span'),
  ).toHaveCount(0);

  await page.goto('/');
  await page.getByLabel('Algorithm', { exact: true }).selectOption('bfs');
  const home = page.locator('#panel-web .snippet code');
  await expect(home).toContainText('algorithm="bfs"');
  await expect(home.locator('.tok-key').first()).toHaveText('type');
});

test('the slide’s overlays play in one frame, and pause', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Slides' }).click();
  const list = page.locator('.overlays');
  await expect(list).toHaveClass(/looping/);
  // It plays only while on screen.
  await list.scrollIntoViewIfNeeded();
  const on = () =>
    list
      .locator('li')
      .evaluateAll((items) =>
        items.findIndex((li) => li.classList.contains('on')),
      );
  const first = await on();
  await expect.poll(on, { timeout: 6000 }).not.toBe(first);
  const pause = page.locator('button.overlays-pause');
  await expect(pause).toHaveText('Pause');
  await pause.click();
  await expect(pause).toHaveText('Play');
  const held = await on();
  await page.waitForTimeout(3000);
  expect(await on()).toBe(held);
});

test('readers who ask for less motion see the overlays side by side', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Slides' }).click();
  await expect(page.locator('.overlays')).not.toHaveClass(/looping/);
  await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
  await expect(page.locator('.overlays li')).toHaveCount(3);
});

// Pages without a player: the player's own loading moves a page as it
// draws, which is the element's, not the fonts'.
for (const path of ['/algorithms/', '/guide/', '/themes/'])
  test(`${path} does not move as its fonts load`, async ({ page }) => {
    await watchShifts(page);
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => (window as unknown as { shift: number }).shift),
    ).toBeLessThan(0.01);
  });

test('every output tab’s Copy button can be clicked', async ({ page }) => {
  await page.goto('/');
  for (const tab of await page.getByRole('tab').all()) {
    await tab.click();
    const id = (await tab.getAttribute('id'))!.replace('tab-', '');
    await page.locator(`#panel-${id} button.copy`).click({ trial: true });
  }
});

test('the share page has the site’s bar', async ({ page }) => {
  await page.goto('/play/');
  const bar = page.locator('header.bar');
  await expect(bar.getByRole('link', { name: 'algomotion' })).toHaveAttribute(
    'href',
    '../',
  );
  for (const name of ['Guide', 'Algorithms', 'Themes'])
    await expect(bar.getByRole('link', { name })).toBeVisible();
  await expect(page.locator('#intro')).toHaveCSS('border-top-style', 'solid');
});
