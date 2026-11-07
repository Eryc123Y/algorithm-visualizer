/**
 * The MCP App end to end: a real MCP client calls algoviz_show and reads
 * the player page from the server, and a minimal host (AppBridge) shows
 * the page in a sandboxed iframe, as a chat client would.
 */
import { readFileSync } from 'node:fs';

import { createServer, PLAYER_URI } from '@algoviz/mcp';
import { bubbleSort, dijkstra, ops } from '@algoviz/recipes';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { Page } from '@playwright/test';

import { HOST_SCRIPT } from './build-bundle';
import { expect, expectStageMatches, test } from './fixtures';
import type { TestHost } from './mcp-host';

const ORIGIN = 'http://host.test';
const sort = bubbleSort([3, 1, 2]);

const client = new Client({ name: 'e2e host', version: '0.0.0' });
let html = '';

test.beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
  const page = await client.readResource({ uri: PLAYER_URI });
  html = (page.contents[0] as { text: string }).text;
});
test.afterAll(() => client.close());

const callShow = async (args: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify(
      await client.callTool({ name: 'algoviz_show', arguments: args }),
    ),
  ) as Record<string, unknown>;

/** Opens the host page with the player page loaded and initialized. */
async function openHost(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.route(`${ORIGIN}/**`, (route) =>
    new URL(route.request().url()).pathname === '/mcp-host.js'
      ? route.fulfill({
          contentType: 'text/javascript',
          body: readFileSync(HOST_SCRIPT),
        })
      : route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>host</title><script type="module" src="/mcp-host.js"></script>',
        }),
  );
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'host' in window);
  await page.evaluate(
    ([view, t]) =>
      (window as unknown as { host: TestHost }).host.open(view, { theme: t }),
    [html, theme] as const,
  );
  const view = page.frameLocator('iframe[title="MCP App"]');
  return { view, player: view.locator('algo-player') };
}

const host = (page: Page) => ({
  result: (result: unknown) =>
    page.evaluate(
      (r) =>
        (window as unknown as { host: TestHost }).host.sendToolResult(
          r as Record<string, unknown>,
        ),
      result,
    ),
  read: () =>
    page.evaluate(() => {
      const { contexts, heights } = (window as unknown as { host: TestHost })
        .host;
      return { contexts: [...contexts], heights: [...heights] };
    }),
});

test('waits for the tool result, then plays the document at its frame', async ({
  page,
}) => {
  const { view, player } = await openHost(page);
  await expect(view.getByRole('status')).toHaveText(
    'Waiting for the visualization…',
  );
  await expect(player).toBeHidden();

  const result = await callShow({ document: sort, frame: 2 });
  expect(result['isError']).toBeUndefined();
  await host(page).result(result);

  await expect(player).toBeVisible();
  await expect(view.getByRole('status')).toBeHidden();
  await expect(player).toHaveAttribute('frame', '2');
  await expectStageMatches(player, sort);
  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(player).toHaveAttribute('frame', '3');
  await expectStageMatches(player, sort);
});

test('a second result replaces the document and opens at its frame', async ({
  page,
}) => {
  const { player } = await openHost(page);
  await host(page).result(await callShow({ document: sort, frame: 1 }));
  await expect(player).toHaveAttribute('frame', '1');
  const other = bubbleSort([5, 4, 3, 2, 1]);
  await host(page).result(await callShow({ document: other, frame: 4 }));
  await expect(player).toHaveAttribute('frame', '4');
  await expect(player.locator('.counter')).toHaveText(
    `4 / ${other.steps.length}`,
  );
  await expectStageMatches(player, other);
});

test('an error result replaces an earlier document', async ({ page }) => {
  const { view, player } = await openHost(page);
  await host(page).result(await callShow({ document: sort }));
  await expect(player).toBeVisible();
  // A step, then an error before the context update is sent.
  await player.getByRole('button', { name: 'Next step' }).click();
  await host(page).result(
    await callShow({ document: sort, frame: sort.steps.length + 1 }),
  );
  await expect(view.getByRole('alert')).toContainText('OUT_OF_RANGE');
  await expect(player).toBeHidden();
  await page.waitForTimeout(600);
  expect((await host(page).read()).contexts).toEqual([]);
});

test('a second result at the same frame number opens there', async ({
  page,
}) => {
  const { player } = await openHost(page);
  await host(page).result(await callShow({ document: sort, frame: 2 }));
  await expect(player).toHaveAttribute('frame', '2');
  const other = bubbleSort([5, 4, 3, 2, 1]);
  await host(page).result(await callShow({ document: other, frame: 2 }));
  await expect(player.locator('.counter')).toHaveText(
    `2 / ${other.steps.length}`,
  );
  await expectStageMatches(player, other);
});

test('a new result cancels a context update about the old document', async ({
  page,
}) => {
  const { player } = await openHost(page);
  await host(page).result(await callShow({ document: sort, frame: 1 }));
  await expect(player).toHaveAttribute('frame', '1');
  // The user goes back to frame 0, and within the update's delay another
  // document arrives, also at frame 0.
  await player.getByRole('button', { name: 'Previous step' }).click();
  const other = dijkstra({ nodes: ['A', 'B'], edges: [['A', 'B', 1]] }, 'A');
  await host(page).result(await callShow({ document: other }));
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(1);
  await page.waitForTimeout(800);
  const { contexts } = await host(page).read();
  expect(contexts.filter((c) => c.includes(sort.title!))).toEqual([]);
});

test('tells the model which frame the user stopped on', async ({ page }) => {
  const { player } = await openHost(page);
  await host(page).result(await callShow({ document: sort }));
  await player.getByRole('button', { name: 'Next step' }).click();
  const n = sort.steps.length;
  const narration = sort.steps[0]!.meta!.narration!;
  await expect
    .poll(async () => (await host(page).read()).contexts.at(-1))
    .toBe(
      `The user is looking at frame 1 of ${n} of "${sort.title}": ${narration}`,
    );
});

test('names the step and section the user stopped on', async ({ page }) => {
  const bst = ops.bst.run({
    from: [8, 3, 10],
    ops: [
      { op: 'search', key: 10 },
      { op: 'insert', key: 5 },
    ],
  }).document;
  const { player } = await openHost(page);
  // The tool resolves the selector; the page opens at that frame.
  await host(page).result(
    await callShow({ document: bst, frame: 'insert-5/go' }),
  );
  const frame = bst.sections![1]!.start + 1;
  await expect(player).toHaveAttribute('frame', String(frame));
  const narration = bst.steps[frame - 1]!.meta!.narration!;
  await expect
    .poll(async () => (await host(page).read()).contexts.at(-1))
    .toBe(
      `The user is looking at frame ${frame} of ${bst.steps.length} of "${bst.title}", step "go" in section "Insert 5": ${narration}`,
    );
});

test('follows the host theme', async ({ page }) => {
  const { player } = await openHost(page, 'dark');
  await host(page).result(await callShow({ document: sort }));
  await expect(player).toHaveAttribute('data-resolved-theme', 'dark');
  await page.evaluate(() =>
    (window as unknown as { host: TestHost }).host.setTheme('light'),
  );
  await expect(player).toHaveAttribute('data-resolved-theme', 'light');
});

test('asks the host for the height it needs', async ({ page }) => {
  const { player } = await openHost(page);
  await host(page).result(await callShow({ document: sort }));
  await expect(player).toBeVisible();
  await expect
    .poll(async () => (await host(page).read()).heights.at(-1) ?? 0)
    .toBeGreaterThan(300);
  await expect
    .poll(async () => (await page.locator('iframe').boundingBox())!.height)
    .toBe((await host(page).read()).heights.at(-1));
});

test('shows the errors of an invalid document', async ({ page }) => {
  const { view, player } = await openHost(page);
  const result = await callShow({
    document: {
      ...sort,
      steps: [{ actions: [{ target: 'nope', type: 'swap' }] }],
    },
  });
  expect(result['isError']).toBe(true);
  await host(page).result(result);
  await expect(view.getByRole('alert')).toContainText('Invalid: ');
  await expect(player).toBeHidden();
});
