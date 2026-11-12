/**
 * The share page in a browser (ADR 0040): it plays documents and
 * algorithms from the fragment, reports links it cannot read, and runs
 * no markup or script that a crafted link carries. Every test fails on a
 * console error, a page error, a dialog or a Content Security Policy
 * violation, so the page's own code must also live within its policy.
 */
import AxeBuilder from '@axe-core/playwright';
import { shareFragment, type ShareContent } from '@algoviz/spec';
import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ watch: void }>({
  watch: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      page.on('dialog', (d) => {
        problems.push(`dialog: ${d.message()}`);
        void d.dismiss();
      });
      await page.addInitScript(() => {
        addEventListener('securitypolicyviolation', (e) =>
          console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});

async function linkTo(content: ShareContent): Promise<string> {
  const fragment = await shareFragment(content);
  if (!fragment.ok) throw new Error(JSON.stringify(fragment.error));
  return `/play/#${fragment.value}`;
}

const player = (page: Page) => page.locator('algo-player');

/** Elements no document may add, in the page or the player's shadow root. */
const injected = (page: Page) =>
  page.evaluate(() => {
    const roots: (Document | ShadowRoot)[] = [document];
    for (const el of document.querySelectorAll('*'))
      if (el.shadowRoot) roots.push(el.shadowRoot);
    const bad = 'img, iframe, object, embed, foreignObject, script:not([src])';
    return {
      elements: roots.flatMap((r) =>
        [...r.querySelectorAll(bad)].map((e) => e.outerHTML),
      ),
      ran: (window as { pwned?: unknown }).pwned ?? null,
    };
  });

/** Markup that would run if it were ever parsed. */
const attack = (n: number) =>
  `<img src=x onerror="window.pwned=${n}"><script>window.pwned=${n}</script>`;

test('explains itself without a link, and plays its example', async ({
  page,
}) => {
  await page.goto('/play/');
  await expect(
    page.getByRole('heading', { name: 'Play a visualization from a link' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Try Dijkstra/ }).click();
  await expect(page).toHaveTitle('dijkstra · algoviz');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
  await expect(page.locator('#intro')).toBeHidden();
});

test('opens a document link at its frame', async ({ page }) => {
  const document = {
    version: '0.1',
    title: 'Two pushes',
    structures: { s: { kind: 'stack', initial: [] } },
    steps: [
      {
        actions: [{ target: 's', type: 'push', element: 1 }],
        meta: { narration: 'Push 1.' },
      },
      {
        actions: [{ target: 's', type: 'push', element: 2 }],
        meta: { narration: 'Push 2.' },
      },
    ],
  };
  await page.goto(await linkTo({ document, frame: 1 }));
  await expect(page).toHaveTitle('Two pushes · algoviz');
  await expect(player(page).getByText('Push 1.')).toBeVisible();
  await expect(player(page)).toHaveAttribute('frame', '1');
});

test('opens an algorithm link at a named step, in its theme', async ({
  page,
}) => {
  await page.goto(
    await linkTo({
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7, C-D 2',
      frame: 'improve#3',
      theme: 'textbook',
    }),
  );
  await expect(
    player(page).getByText('4 + 1 = 5 < 7: C improves to 5, through B.'),
  ).toBeVisible();
  await expect(player(page)).toHaveAttribute('frame', '7');
  expect(
    await player(page).evaluate((el) => (el as { theme?: string }).theme),
  ).toBe('textbook');
});

test('plays the next link when the fragment changes', async ({ page }) => {
  await page.goto('/play/#v=1&alg=insertion-sort&in=3%201%202');
  await expect(page).toHaveTitle('insertion-sort · algoviz');
  await page.evaluate(() => {
    location.hash = '#v=1&alg=bfs';
  });
  await expect(page).toHaveTitle('bfs · algoviz');
  await expect(player(page)).toHaveCount(1);
});

test('reports a link it cannot read, as text', async ({ page }) => {
  await page.goto(`/play/#v=2&alg=bfs&x=${encodeURIComponent(attack(1))}`);
  const problem = page.getByRole('alert');
  await expect(problem).toContainText('This link cannot be opened');
  await expect(problem).toContainText('made by a newer algoviz');
  await expect(player(page)).toHaveCount(0);

  // A key this page does not know is skipped, markup and all (ADR 0041).
  await page.goto(`/play/#v=1&alg=bfs&${encodeURIComponent(attack(8))}`);
  await expect(page).toHaveTitle('bfs · algoviz');
  expect(await injected(page)).toEqual({ elements: [], ran: null });
  // The version error quotes the decoded value.
  await page.goto(
    `/play/#v=${encodeURIComponent('<img src=x onerror="window.pwned=2">')}&alg=bfs`,
  );
  await expect(page.getByRole('alert')).toContainText(
    'not "<img src=x onerror=\\"window.pwned=2\\">"',
  );
  expect(await injected(page)).toEqual({ elements: [], ran: null });

  await page.goto(`/play/#v=1&doc=${'A'.repeat(40)}`);
  await expect(page.getByRole('alert')).toContainText('raw DEFLATE');
  expect(await injected(page)).toEqual({ elements: [], ran: null });
});

test('draws a crafted document’s text as text and runs none of it', async ({
  page,
}) => {
  const document = {
    version: '0.1',
    title: `Title ${attack(1)}`,
    structures: {
      a: {
        kind: 'array',
        label: `</text>${attack(2)}`,
        initial: [attack(3), `"><svg onload="window.pwned=4">`],
      },
    },
    steps: [
      {
        actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }],
        meta: {
          narration: `Swap ${attack(5)} <iframe srcdoc="<script>parent.pwned=6</script>">`,
        },
      },
    ],
  };
  await page.goto(await linkTo({ document, frame: 1 }));
  await expect(page).toHaveTitle(`Title ${attack(1)} · algoviz`);
  await expect(
    player(page).getByText(`Swap ${attack(5)}`, { exact: false }),
  ).toBeVisible();
  await expect(player(page).getByText(attack(3))).toBeVisible();
  await expect(player(page).getByText(`</text>${attack(2)}`)).toBeVisible();
  expect(await injected(page)).toEqual({ elements: [], ran: null });
});

test('shows a crafted input’s error as text', async ({ page }) => {
  await page.goto(
    `/play/#v=1&alg=insertion-sort&in=${encodeURIComponent(attack(7))}`,
  );
  await expect(
    player(page).getByText(/INVALID_JSON|INVALID_NOTATION/),
  ).toBeVisible();
  expect(await injected(page)).toEqual({ elements: [], ran: null });
});

test('fits a phone’s width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/play/#v=1&alg=dijkstra');
  await expect(player(page).getByText('Initial state.')).toBeVisible();
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
});

for (const colorScheme of ['light', 'dark'] as const)
  test(`has no serious accessibility violations (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const path of ['/play/', '/play/#v=1&alg=bfs', '/play/#v=9&alg=x']) {
      await page.goto(path);
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLElement>('#intro')!.hidden ||
          !document.querySelector<HTMLElement>('#problem')!.hidden ||
          document
            .querySelector('algo-player')
            ?.shadowRoot?.querySelector('svg'),
      );
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${path} ${v.id}: ${v.help}`),
      ).toEqual([]);
    }
  });
