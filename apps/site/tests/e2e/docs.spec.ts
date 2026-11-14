/**
 * The documentation site in a browser (roadmap 3.4): the home page and its
 * catalogue, an algorithm's page with its player and snippets, a
 * structure's operations, and the themes, on a desktop and a phone.
 */
import AxeBuilder from '@axe-core/playwright';
import { algorithms } from '@algomotion/recipes';
import type { Page } from '@playwright/test';

import { GUIDES } from '../../src/docs/guides/index.ts';

import { expect, test } from './fixtures.ts';

const player = (page: Page) => page.locator('main algo-player').first();

const noSideScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test('the algorithms page lists every module, and filters them', async ({
  page,
}) => {
  await page.goto('/algorithms/');
  await expect(page).toHaveTitle('Algorithms and data structures · algomotion');
  const catalog = page.locator('#catalog');
  for (const a of algorithms)
    await expect(
      catalog.locator(`a[href="../${a.id.split('.').join('/')}/"]`),
      a.id,
    ).toHaveCount(1);

  await page.getByLabel('Filter').fill('fibonacci');
  await expect(
    catalog.getByRole('link', { name: 'Fibonacci heap', exact: true }),
  ).toBeVisible();
  await expect(
    catalog.getByRole('link', { name: 'Insertion sort' }),
  ).toBeHidden();
  await page.getByLabel('Filter').fill('extract-min');
  await expect(
    catalog.getByRole('link', { name: 'extract-min' }),
  ).toBeVisible();
  await page.getByLabel('Filter').fill('no such thing');
  await expect(page.locator('.filter-status')).toHaveText(
    'Nothing matches; try fewer words.',
  );
  expect(await noSideScroll(page)).toBe(true);
});

test('an algorithm’s page plays it, names its steps and gives every snippet', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto('/algorithms/');
  await page
    .locator('#catalog')
    .getByRole('link', { name: 'Dijkstra’s algorithm' })
    .click();
  await expect(page).toHaveURL(/\/dijkstra\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dijkstra’s algorithm' }),
  ).toBeVisible();
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link').first()).toHaveAttribute('href', '../');
  await expect(crumbs.getByRole('link').nth(1)).toHaveAttribute(
    'href',
    '../algorithms/#topic-graphs',
  );

  await player(page).getByRole('button', { name: 'Next step' }).click();
  await expect(player(page).getByText('Initial state.')).toBeHidden();

  await expect(page.locator('.steps')).toContainText('extract');
  for (const label of [
    'On a web page',
    'In Typst',
    'In LaTeX',
    'On the command line',
    'To a model, through MCP',
    'As a share link',
  ])
    await expect(
      page.getByRole('heading', { level: 3, name: label }),
    ).toBeVisible();

  const cli = page.locator('[data-snippet="cli"] pre');
  await expect(cli).toContainText("algomotion export dijkstra --input '");
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page
      .getByRole('button', { name: 'Copy: On the command line' })
      .click();
    await expect(page.locator('p.visually-hidden[role="status"]')).toHaveText(
      'Copied',
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await cli.textContent(),
    );
  }
  expect(await noSideScroll(page)).toBe(true);

  // The share link opens the same run in the share page.
  await page
    .getByRole('link', { name: 'Open this run in the share page' })
    .click();
  await expect(page).toHaveURL(/\/play\/#v=1&alg=dijkstra&in=/);
  await expect(page).toHaveTitle('dijkstra · algomotion');
  await expect(
    page.locator('algo-player').getByText('Initial state.'),
  ).toBeVisible();
});

test('a structure lists its operations, and an operation leads back', async ({
  page,
}) => {
  await page.goto('/bst/');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Operations' }),
  ).toBeVisible();
  await page.locator('.cards').getByRole('link', { name: 'delete' }).click();
  await expect(page).toHaveURL(/\/bst\/delete\/$/);
  await expect(player(page)).toHaveAttribute('algorithm', 'bst.delete');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link').first()).toHaveAttribute(
    'href',
    '../../',
  );
  await expect(crumbs.getByRole('link').nth(1)).toHaveAttribute(
    'href',
    '../../algorithms/#topic-trees',
  );
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Binary search tree' })
    .click();
  await expect(page).toHaveURL(/\/bst\/$/);
});

test('the home page links to the catalogue and switches output panels', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('algomotion: step-by-step algorithms');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
  for (const selector of ['.bar', '.hero', '.teaser'])
    await expect(
      page.locator(`${selector} a[href="algorithms/"]`).first(),
    ).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(7);
  for (const tab of await tabs.all()) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const id = await tab.getAttribute('id');
    await expect(
      page.locator(`[role="tabpanel"][aria-labelledby="${id}"]`),
    ).not.toHaveAttribute('hidden');
    await expect(
      page.locator('[role="tabpanel"][hidden="until-found"]'),
    ).toHaveCount(6);
    await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
  }
  expect(await noSideScroll(page)).toBe(true);
});

for (const guide of GUIDES)
  test(`guide ${guide.slug || 'start'} loads at 375px without errors or side scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/guide/${guide.slug === '' ? '' : `${guide.slug}/`}`);
    await expect(
      page.getByRole('heading', { level: 1, name: guide.title }),
    ).toBeVisible();
    for (const img of await page.locator('.guide-figure img').all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
    expect(await noSideScroll(page)).toBe(true);
  });

test('the themes page shows a figure in every theme', async ({ page }) => {
  await page.goto('/themes/');
  const images = page.locator('.themes img');
  await expect(images).toHaveCount(9);
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  expect(await noSideScroll(page)).toBe(true);
});

for (const colorScheme of ['light', 'dark'] as const)
  test(`has no serious accessibility violations (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const path of [
      '/',
      '/algorithms/',
      '/dijkstra/',
      '/bst/delete/',
      '/themes/',
      '/why/',
      '/roadmap/',
      '/changelog/',
      '/contributing/',
    ]) {
      await page.goto(path);
      if (['/', '/dijkstra/', '/bst/delete/'].includes(path))
        await expect(player(page).getByText('Initial state.')).toBeVisible();
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

for (const path of ['changelog', 'roadmap', 'contributing'])
  test(`the ${path} page loads at 375px without errors or side scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page
      .locator('footer')
      .getByRole('link', {
        name: path[0]!.toUpperCase() + path.slice(1),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}/$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const details of await page.locator('details').all()) {
      await details.locator('summary').click();
      await expect(details).toHaveAttribute('open');
    }
    expect(await noSideScroll(page)).toBe(true);
  });

test('the roadmap shows each phase’s progress and what waits for the owner', async ({
  page,
}) => {
  await page.goto('/roadmap/');
  const bars = page.locator('.phases-progress progress');
  expect(await bars.count()).toBeGreaterThanOrEqual(6);
  await expect(bars.first()).toHaveAccessibleName(
    /Phase 0: foundations: \d+ of \d+ done/,
  );
  await expect(page.locator('#owner-items')).toContainText('4.3 Publish');
  await page
    .locator('#next-items')
    .getByRole('link', { name: 'Phase 5: a site worth visiting' })
    .click();
  await expect(page).toHaveURL(/#phase-5-a-site-worth-visiting$/);
});

test('the footer names the version and the commit the site was built from', async ({
  page,
}) => {
  await page.goto('/');
  const build = page.locator('footer .build');
  await expect(build).toContainText(/Version \d+\.\d+\.\d+/);
  await expect(build.locator('a[href*="/commit/"]')).toHaveText(
    /^[0-9a-f]{7}$/,
  );
});

test('the home page leads to Why algomotion, which loads at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Why algomotion, compared' }).click();
  await expect(page).toHaveURL(/\/why\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Why algomotion' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Site' })
      .getByRole('link', { name: 'Why' }),
  ).toHaveAttribute('aria-current', 'page');
  for (const img of await page.locator('main img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  // The comparison scrolls inside its own region, not the page.
  await expect(
    page.getByRole('region', { name: 'The comparison table' }),
  ).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test('the home page’s output tabs show the real scenes', async ({ page }) => {
  await page.goto('/');
  for (const [tab, scene] of [
    ['Typst', 'notes'],
    ['Slides', 'beamer'],
    ['Command line', 'terminal'],
    ['AI assistants', 'chat'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    const figure = page.locator(
      `[role="tabpanel"]:not([hidden]) .scene-${scene}`,
    );
    await expect(figure).toBeVisible();
    for (const img of await figure.locator('img').all())
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
  }
  expect(await noSideScroll(page)).toBe(true);
});

test('in the looping slides, only the page on show can be clicked or focused', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Slides' }).click();
  const list = page.locator('#panel-slides .overlays');
  await expect(list).toHaveClass(/looping/);
  await list.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Pause' }).click();
  const state = () =>
    list.locator(':scope > li').evaluateAll((items) =>
      items.map((li) => ({
        on: li.classList.contains('on'),
        visible: getComputedStyle(li).visibility === 'visible',
        href: li.querySelector('a')!.getAttribute('href'),
      })),
    );
  // Pages that are not on show finish fading, then hide.
  await expect
    .poll(async () => (await state()).every((p) => p.on === p.visible))
    .toBe(true);
  const shown = (await state()).find((p) => p.on)!;
  // The link under the pointer is the page on show.
  const box = (await list.boundingBox())!;
  const href = await page.evaluate(
    ([x, y]) =>
      document.elementFromPoint(x!, y!)?.closest('a')?.getAttribute('href'),
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(href).toBe(shown.href);
});

test('in dark mode, figures in a fixed theme sit on their own paper', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const papers = (path: string) =>
    page.goto(path).then(() =>
      page.locator('.sheet').evaluateAll((sheets) =>
        sheets.map((s) => ({
          theme: [...s.classList].find((c) => c.startsWith('sheet-'))!,
          paper: getComputedStyle(s).backgroundColor,
        })),
      ),
    );
  const white = 'rgb(255, 255, 255)';
  const light = [
    'sheet-light',
    'sheet-print',
    'sheet-textbook',
    'sheet-blocks',
    'sheet-answer-sheet',
  ];
  for (const path of [
    '/',
    '/why/',
    '/themes/',
    '/guide/typst/',
    '/guide/latex/',
    '/guide/cli/',
  ]) {
    const sheets = await papers(path);
    expect(sheets.length, path).toBeGreaterThan(0);
    for (const s of sheets)
      if (light.includes(s.theme))
        expect(s.paper, `${path} ${s.theme}`).toBe(white);
      else expect(s.paper, `${path} ${s.theme}`).not.toBe(white);
  }
  // Every theme on the themes page, and the three places on /why/.
  expect(
    await page
      .goto('/themes/')
      .then(() => page.locator('.themes .sheet').count()),
  ).toBe(9);
  await page.goto('/why/');
  await expect(page.locator('.triptych .sheet')).toHaveCount(3);
  await expect(page.locator('.triptych .sheet-dark')).toHaveCSS(
    'background-color',
    'rgb(18, 18, 20)',
  );
});
