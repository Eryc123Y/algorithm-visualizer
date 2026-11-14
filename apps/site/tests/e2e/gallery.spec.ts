/**
 * The catalogue's gallery in a browser (roadmap 5.2): every algorithm and
 * structure has a thumbnail drawn at build time, loaded only as it nears
 * the screen, in a frame that keeps the page still while it loads; the
 * filter hides whole cards.
 */
import { expect, test } from './fixtures.ts';

test('thumbnails load lazily, in the reader’s colour scheme, without moving the page', async ({
  page,
}) => {
  const requested = new Set<string>();
  page.on('request', (r) => {
    if (r.url().includes('/algorithms/thumbs/')) requested.add(r.url());
  });
  await page.addInitScript(() => {
    (window as unknown as { shift: number }).shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!e.hadRecentInput)
          (window as unknown as { shift: number }).shift += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/algorithms/');
  const thumbs = page.locator('#catalog .thumb img');
  const count = await thumbs.count();
  expect(count).toBeGreaterThan(60);
  await page.waitForLoadState('load');
  // Only those near the first screen are fetched, and only the dark ones.
  expect(requested.size).toBeGreaterThan(0);
  expect(requested.size).toBeLessThan(count / 2);
  for (const url of requested) expect(url).toMatch(/-dark\.svg$/);

  // From here on: the web fonts' swap is not the thumbnails' doing.
  await page.evaluate(async () => {
    await document.fonts.ready;
    (window as unknown as { shift: number }).shift = 0;
  });
  const first = thumbs.first();
  await expect
    .poll(() => first.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  const last = thumbs.last();
  await last.scrollIntoViewIfNeeded();
  await expect
    .poll(() => last.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  // Each frame has the same shape, whatever its figure's size.
  const ratios = await page.locator('#catalog .thumb').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return Math.round((r.width / r.height) * 100);
    }),
  );
  expect(new Set(ratios).size).toBe(1);
  expect(
    await page.evaluate(() => (window as unknown as { shift: number }).shift),
  ).toBeLessThan(0.01);
});

test('the filter hides whole cards, and the topics left say so', async ({
  page,
}) => {
  await page.goto('/algorithms/');
  await page.getByLabel('Filter').fill('red-black');
  const shown = page.locator('#catalog .card:visible');
  await expect(shown).toHaveCount(1);
  await expect(shown.locator('.thumb img')).toBeVisible();
  await expect(shown.locator('.card-title')).toHaveText(/^Red.black tree$/);
  await expect(page.locator('#catalog .topic:visible')).toHaveCount(1);
});
