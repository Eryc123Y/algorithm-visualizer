/**
 * Pages hold still while they load: the player has its room before it
 * draws, so nothing below it moves (Cumulative Layout Shift under 0.1,
 * "good" in Core Web Vitals), and the catalogue's first thumbnails come
 * with the page, a quiet placeholder standing in until each arrives.
 */
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

/** Counts layout shifts not caused by input, from the start. */
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

/**
 * The browser's default font size, as a reader sets it, before the page
 * loads: rem follows it, the player's pixels do not. Both projects run
 * Chromium, which takes it through the DevTools protocol.
 */
const defaultFont = async (page: Page, percent: number) => {
  if (percent === 100) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', {
    fontSizes: { standard: (16 * percent) / 100 },
  });
};

const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { shift: number }).shift);

for (const path of ['/', '/dijkstra/'])
  test(`${path} holds still while its player loads`, async ({ page }) => {
    await watchShifts(page);
    await page.goto(path);
    await expect(
      page.locator('main algo-player').first().getByText('Initial state.'),
    ).toBeVisible();
    await page.waitForTimeout(500);
    expect(await shift(page)).toBeLessThan(0.1);
  });

for (const font of [100, 150])
  test(`the hero’s reserve is never taller than its player (font ${font}%)`, async ({
    page,
  }) => {
    await defaultFont(page, font);
    // At 900px the hero has one column and the player its code beside
    // the figure, the shortest it gets.
    if (font === 100) await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/');
    const player = page.locator('.pg-stage algo-player');
    await expect(player.getByText('Initial state.')).toBeVisible();
    const [stage, drawn] = await Promise.all([
      page
        .locator('.pg-stage')
        .evaluate((el) => el.getBoundingClientRect().height),
      player.evaluate((el) => el.getBoundingClientRect().height),
    ]);
    expect(stage - drawn).toBeLessThan(1);
  });

// The smallest players of the registry, at a desktop's and a phone's width,
// and with a reader's default font at 150%, which the player ignores.
for (const [id, font] of [
  ['bubble-sort', 100],
  ['random-permutation', 100],
  ['fibonacci-heap.delete', 100],
  ['activity-selection', 100],
  ['bubble-sort', 150],
] as const)
  test(`${id}'s page reserves no more than its player (font ${font}%)`, async ({
    page,
  }) => {
    await defaultFont(page, font);
    await page.goto(`/${id.split('.').join('/')}/`);
    const player = page.locator('main > algo-player');
    await expect(player.getByText('Initial state.')).toBeVisible();
    const [reserve, drawn] = await player.evaluate((el) => [
      parseFloat(getComputedStyle(el).minBlockSize),
      el.shadowRoot!.firstElementChild!.getBoundingClientRect().height,
    ]);
    expect(reserve).toBeGreaterThan(0);
    expect(drawn).toBeGreaterThanOrEqual(reserve);
  });

test('the catalogue’s first thumbnails come with the page, without empty cells', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/algorithms/');
  const thumbs = page.locator('#catalog .thumb img');
  await expect(thumbs.nth(0)).toHaveAttribute('loading', 'eager');
  await expect(thumbs.nth(8)).toHaveAttribute('loading', 'lazy');
  await page.waitForLoadState('load');
  for (let k = 0; k < 4; k++)
    expect(
      await thumbs.nth(k).evaluate((el: HTMLImageElement) => el.naturalWidth),
    ).toBeGreaterThan(0);
  // A placeholder stays only on frames whose figure has not arrived.
  await expect(
    page.locator('#catalog .thumb.pending').first(),
  ).not.toBeInViewport();
});
