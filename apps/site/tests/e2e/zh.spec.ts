/**
 * The site in Chinese (roadmap 5.7, 5.8) in a browser: every page under
 * /zh/ loads without errors or side scroll, passes axe in light and dark,
 * the language switch keeps the page both ways, what the script writes is
 * in Chinese, and so are the module pages and their runs.
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
  '/zh/dijkstra/',
  '/zh/bst/',
  '/zh/bst/delete/',
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
    // Images in hidden tab panels load lazily, when their tab opens; the
    // story's pinned sheet is hidden on a phone, where each step shows its
    // own figure instead.
    for (const img of await page
      .locator(
        'main img:not([role="tabpanel"][hidden] img):not(.story-figure img)',
      )
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
  // A module page keeps its module.
  await page.goto('/bst/delete/');
  await page.locator('.lang-switch a').click();
  await expect(page).toHaveURL(/\/zh\/bst\/delete\/$/);
  await page.locator('.lang-switch a').click();
  await expect(page).toHaveURL(/\/bst\/delete\/$/);
  await expect(page).not.toHaveURL(/\/zh\//);
});

test('the Chinese pages draw their runs in Chinese', async ({
  page,
  request,
}) => {
  // The home page's story tells the run in Chinese, beside Chinese figures.
  await page.goto('/zh/');
  await expect(page.locator('.story-text').first()).toContainText(
    '每个顶点的距离都是 ∞',
  );
  const figures = [
    page.locator('.story-frame img').first(),
    page.locator('#catalog .thumb img, .guide-figure img').first(),
  ];
  expect(await figures[0]!.getAttribute('src')).toMatch(/^\.\.\/zh\/art\//);
  // Figures elsewhere are drawn from runs in Chinese too: a label the
  // layout writes, such as the call stack's, is Chinese.
  for (const path of [
    '/zh/algorithms/thumbs/merge-sort-light.svg',
    '/zh/themes/dijkstra-light.svg',
  ]) {
    const svg = await (await request.get(path)).text();
    expect(svg, path).toMatch(/[一-鿿]/u);
  }
  // The run's own labels and the layout's own words: the call stack and
  // its top, the priority queue's minimum. Latin text is outlined, but
  // Chinese stays text, which the reader's fonts draw.
  const svg = async (path: string) => (await request.get(path)).text();
  const quicksort = await svg('/zh/algorithms/thumbs/quicksort-light.svg');
  expect(quicksort).toContain('调用栈');
  expect(quicksort).toContain('栈顶');
  const themed = await svg('/zh/themes/dijkstra-light.svg');
  expect(themed).toContain('最小');
  await page.goto('/zh/algorithms/');
  expect(await figures[1]!.getAttribute('src')).toMatch(/^thumbs\//);
});

test('a module page in Chinese runs in Chinese, and its share link does too', async ({
  page,
}) => {
  await page.goto('/zh/dijkstra/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dijkstra 算法' }),
  ).toBeVisible();
  const player = page.locator('main algo-player').first();
  await expect(player.getByText('初始状态。')).toBeVisible();
  await player.getByRole('button', { name: '下一步' }).click();
  await expect(player.getByText(/每个顶点的距离都是 ∞/u)).toBeVisible();
  await expect(page.locator('.snippet[data-snippet="cli"] code')).toContainText(
    '--lang zh',
  );
  await page.getByRole('link', { name: '在分享页面中打开这次运行' }).click();
  await expect(page).toHaveURL(/\/play\/#v=1&alg=dijkstra&in=.*&lang=zh$/);
  await expect(
    page.locator('algo-player').getByText('初始状态。'),
  ).toBeVisible();
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
  // A module is found by its English name too, and its page is Chinese.
  await page.getByLabel('筛选').fill('binary search tree');
  await expect(
    page
      .locator('#catalog')
      .getByRole('link', { name: '二叉搜索树', exact: true }),
  ).toBeVisible();
  await page.getByLabel('筛选').fill('');
  await page
    .locator('#catalog')
    .getByRole('link', { name: 'Dijkstra 算法' })
    .click();
  await expect(page).toHaveURL(/\/zh\/dijkstra\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
});

test('a missing address under /zh/ gets the Chinese 404 page', async ({
  page,
}) => {
  await page.goto('/zh/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '页面不存在',
  );
});
