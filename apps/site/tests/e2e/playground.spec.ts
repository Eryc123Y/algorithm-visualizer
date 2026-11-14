/**
 * The home page's playground in a browser (roadmap 5.1): the player and
 * every output's snippet follow the algorithm and input chosen, an input
 * that does not run shows its error and keeps the last run, the address
 * and the share page keep the run, and without script the page shows the
 * default run alone.
 */
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

const player = (page: Page) => page.locator('main algo-player').first();
const field = (page: Page) => page.getByLabel('Input', { exact: true });
const snippet = (page: Page, id: string) =>
  page.locator(`#panel-${id} .snippet code`);

test('the player and the snippets follow the algorithm and input chosen', async ({
  page,
}) => {
  await page.goto('/');
  await expect(player(page).getByText('Initial state.')).toBeVisible();

  await page
    .getByLabel('Algorithm', { exact: true })
    .selectOption('insertion-sort');
  await expect(page).toHaveURL(/\/\?algorithm=insertion-sort$/);
  await expect(field(page)).toHaveValue('5 3 8 1 9 2 7');
  await expect(player(page).locator('.code-panel')).toContainText(
    /insertion-sort/i,
  );
  await expect(snippet(page, 'web')).toContainText(
    'algorithm="insertion-sort" input="5 3 8 1 9 2 7"',
  );
  await expect(snippet(page, 'typst')).toContainText('"insertion-sort"');
  await expect(snippet(page, 'slides')).toContainText(
    '\\algomotion[steps]{insertion-sort}{5 3 8 1 9 2 7}',
  );
  await expect(page.locator('.pg-caption')).toHaveText(
    'Insertion sort on 5 3 8 1 9 2 7.',
  );

  await field(page).fill('4 1 3');
  await expect(snippet(page, 'cli')).toHaveText(
    "algomotion export insertion-sort --input '4 1 3' --out figures",
  );
  await expect(page).toHaveURL(/\?algorithm=insertion-sort&input=4\+1\+3$/);
});

test('an input that does not run shows its error and keeps the last run', async ({
  page,
}) => {
  await page.goto('/?algorithm=insertion-sort&input=4+1+3');
  await expect(field(page)).toHaveValue('4 1 3');
  await expect(snippet(page, 'web')).toContainText('input="4 1 3"');

  // Typed with the keyboard; Enter runs without waiting for the pause.
  await field(page).focus();
  await field(page).evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(el.value.length, el.value.length),
  );
  await field(page).pressSequentially(' x');
  await field(page).press('Enter');
  const error = page.locator('.pg-error');
  await expect(error).toContainText('This input does not run.');
  await expect(error).toContainText('Expected a number, not "x"');
  await expect(error.locator('mark')).toHaveText('x');
  await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(field(page)).toHaveAttribute('aria-describedby', 'pg-error');
  await expect(snippet(page, 'web')).toContainText('input="4 1 3"');
  await expect(player(page).locator('.code-panel')).toContainText(
    /insertion-sort/i,
  );
  await expect(page).toHaveURL(/input=4\+1\+3$/);

  await page.getByRole('button', { name: 'Use example' }).click();
  await expect(field(page)).toHaveValue('5 3 8 1 9 2 7');
  await expect(error).toBeEmpty();
  await expect(field(page)).toHaveAttribute('aria-invalid', 'false');
  await expect(field(page)).not.toHaveAttribute('aria-describedby');
});

test('the share page opens the same run', async ({ page }) => {
  await page.goto('/?algorithm=bfs&input=A-B%2C+B-C%2C+A-D');
  await expect(snippet(page, 'web')).toContainText('algorithm="bfs"');
  const share = page.getByRole('link', { name: 'Open in the share page' });
  await expect(share).toHaveAttribute(
    'href',
    (await snippet(page, 'link').textContent())!,
  );
  await share.click();
  await expect(page).toHaveURL(/\/play\/#/);
  await expect(page).toHaveTitle('bfs · algomotion');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
});

test('a smaller figure does not pull the page up', async ({ page }) => {
  await page.goto('/');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
  const stage = page.locator('.pg-stage');
  const before = (await stage.boundingBox())!.height;
  await page
    .getByLabel('Algorithm', { exact: true })
    .selectOption('binary-search');
  await expect(player(page).locator('.code-panel')).toContainText(
    /binary-search/i,
  );
  expect((await stage.boundingBox())!.height).toBeGreaterThanOrEqual(before);
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the default run and hides the controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pg-controls')).toBeHidden();
    await expect(page.locator('.pg-caption')).toHaveText(
      'Dijkstra’s algorithm on A-B 4, B-C 1, A-C 7, C-D 2.',
    );
    await expect(
      page.getByRole('link', { name: 'Open in the share page' }),
    ).toHaveAttribute('href', /^play\/#/);
  });
});
