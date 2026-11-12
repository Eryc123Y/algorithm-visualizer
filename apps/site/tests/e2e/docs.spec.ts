/**
 * The documentation site in a browser (roadmap 3.4): the home page and its
 * catalogue, an algorithm's page with its player and snippets, a
 * structure's operations, and the themes, on a desktop and a phone.
 */
import AxeBuilder from '@axe-core/playwright';
import { algorithms } from '@algoviz/recipes';
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

const player = (page: Page) => page.locator('main algo-player').first();

const noSideScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test('the home page lists every module, and filters them', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('algoviz: step-by-step algorithms');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
  const catalog = page.locator('#catalog');
  for (const a of algorithms)
    await expect(
      catalog.locator(`a[href="${a.id.split('.').join('/')}/"]`),
      a.id,
    ).toHaveCount(1);

  await page.getByLabel('Filter').fill('fibonacci');
  await expect(
    catalog.getByRole('link', { name: 'Fibonacci heap', exact: true }),
  ).toBeVisible();
  await expect(
    catalog.getByRole('link', { name: 'Insertion sort' }),
  ).toBeHidden();
  await page.getByLabel('Filter').fill('no such thing');
  await expect(page.getByText('Nothing matches')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test('an algorithm’s page plays it, names its steps and gives every snippet', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto('/');
  await page
    .locator('#catalog')
    .getByRole('link', { name: 'Dijkstra’s algorithm' })
    .click();
  await expect(page).toHaveURL(/\/dijkstra\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dijkstra’s algorithm' }),
  ).toBeVisible();

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
  await expect(cli).toContainText("algoviz export dijkstra --input '");
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page
      .getByRole('button', { name: 'Copy: On the command line' })
      .click();
    await expect(page.getByRole('status')).toHaveText('Copied');
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
  await expect(page).toHaveTitle('dijkstra · algoviz');
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
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Binary search tree' })
    .click();
  await expect(page).toHaveURL(/\/bst\/$/);
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
    for (const path of ['/', '/dijkstra/', '/bst/delete/', '/themes/']) {
      await page.goto(path);
      if (path !== '/themes/')
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
