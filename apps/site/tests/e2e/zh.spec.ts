/**
 * The site in Chinese (roadmap 5.7) in a browser: every page under /zh/
 * loads without errors or side scroll, passes axe in light and dark, the
 * language switch keeps the page both ways, and what the script writes is
 * in Chinese.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { GUIDES } from '../../src/docs/guides/index.ts';

import { expect, test } from './fixtures.ts';

const PAGES = [
  '/zh/',
  '/zh/why/',
  ...GUIDES.map((g) => `/zh/guide/${g.slug === '' ? '' : `${g.slug}/`}`),
  '/zh/algorithms/',
  '/zh/themes/',
  '/zh/changelog/',
  '/zh/roadmap/',
  '/zh/contributing/',
];

const noSideScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

for (const path of PAGES)
  test(`${path} is Chinese, and loads at 375px without errors or side scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    expect(await h1.textContent()).toMatch(/[一-鿿]/u);
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveCount(1);
    // Images in hidden tab panels load lazily, when their tab opens.
    for (const img of await page
      .locator('main img:not([role="tabpanel"][hidden] img)')
      .all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
    expect(await noSideScroll(page)).toBe(true);
  });

for (const colorScheme of ['light', 'dark'] as const)
  test(`the Chinese pages have no serious accessibility violations (${colorScheme})`, async ({
    page,
  }) => {
    test.slow();
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map(
            (v) =>
              `${path} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
          ),
      ).toEqual([]);
    }
  });

test('the language switch keeps the page, both ways', async ({ page }) => {
  await page.goto('/guide/typst/');
  await page.locator('.lang-switch a').click();
  await expect(page).toHaveURL(/\/zh\/guide\/typst\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await page.locator('.lang-switch a').click();
  await expect(page).toHaveURL(/\/guide\/typst\/$/);
  await expect(page).not.toHaveURL(/\/zh\//);
  // A module page has no Chinese version: the switch leads to the
  // Chinese home page.
  await page.goto('/dijkstra/');
  await page.locator('.lang-switch a').click();
  await expect(page).toHaveURL(/\/zh\/$/);
});

test('the playground, tabs and copy buttons speak Chinese', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto('/zh/');
  await expect(page.locator('.pg-reset')).toHaveText('用示例');
  await expect(page.locator('#panel-web button.copy')).toHaveText('复制');
  await page.locator('#pg-input').fill('A-B 4, B-C x');
  await expect(page.locator('#pg-error')).toContainText('这个输入无法运行。');
  await expect(page.locator('#pg-error')).toContainText(
    '播放器保留上一次能运行的输入。',
  );
  await page.locator('.pg-reset').click();
  await expect(page.locator('#pg-error')).toBeEmpty();
  await expect(page.locator('.pg-caption')).toContainText('，输入为 ');
  // The share link leads to the share page at the site's root.
  await expect(page.locator('.pg-share')).toHaveAttribute(
    'href',
    /^\.\.\/play\/#/,
  );
  await page.getByRole('tab', { name: '命令行' }).click();
  await expect(page.locator('#panel-cli')).toBeVisible();
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#panel-cli button.copy').click();
    await expect(page.locator('#panel-cli button.copy')).toHaveText('已复制');
  }
});

test('the Chinese catalogue filters, and says so in Chinese', async ({
  page,
}) => {
  await page.goto('/zh/algorithms/');
  await expect(
    page.getByRole('heading', { level: 2, name: '图' }),
  ).toBeVisible();
  await page.getByLabel('筛选').fill('dijkstra');
  await expect(page.locator('.filter-status')).toContainText('显示');
  await page.getByLabel('筛选').fill('没有这种算法');
  await expect(page.locator('.filter-status')).toHaveText(
    '没有匹配项，试试少输几个词。',
  );
  // Module pages stay English, at the site's root.
  await page.getByLabel('筛选').fill('');
  await page
    .locator('#catalog')
    .getByRole('link', { name: 'Dijkstra’s algorithm' })
    .click();
  await expect(page).toHaveURL(/\/dijkstra\/$/);
  await expect(page).not.toHaveURL(/\/zh\//);
});

test('a missing address under /zh/ gets the Chinese 404 page', async ({
  page,
}) => {
  await page.goto('/zh/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '页面不存在',
  );
});
