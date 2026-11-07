/**
 * Embedding the standalone bundle in a plain page, as the README shows:
 * every way to give a document, the attributes, events and methods, and
 * failures. Pages are served from a made-up origin by request routing, so
 * nothing here depends on the playground.
 */
import { readFileSync } from 'node:fs';

import { selectFrame } from '@algoviz/core';
import { runAlgorithm } from '@algoviz/recipes';
import type { AlgoPlayer } from '@algoviz/elements';
import type { Page } from '@playwright/test';

import { expect, expectStageMatches, test } from './fixtures';

/** The document of a registry module's run, which must succeed. */
function documentOf(id: string, input: unknown) {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(run.error.map((e) => e.message).join('; '));
  return run.value.document;
}

const ORIGIN = 'http://embed.test';
const bundle = () =>
  readFileSync(
    new URL(
      '../../../../packages/elements/dist/cdn/algoviz-player.js',
      import.meta.url,
    ),
  );

const sort = documentOf('bubble-sort', { values: [4, 2, 3, 1] });
const graph = documentOf('dijkstra', {
  graph: {
    nodes: ['A', 'B', 'C'],
    edges: [
      ['A', 'B', 2],
      ['B', 'C', 1],
      ['A', 'C', 5],
    ],
  },
  source: 'A',
});

// Two operations, each a section of named steps (ADR 0020).
const bst = documentOf('bst', {
  from: [8, 3, 10, 1, 6, 14, 4, 7, 13],
  ops: [
    { op: 'search', key: 7 },
    { op: 'insert', key: 5 },
  ],
});
const frameOf = (selector: string) => {
  const frame = selectFrame(bst, selector);
  if (!frame.ok) throw new Error(frame.error.message);
  return frame.value;
};
const insertStart = bst.sections![1]!.start;

// Passed into the page as plain JSON; the full document type is too deep
// for Playwright's argument types.
const sortJson: unknown = sort;
const graphJson: unknown = graph;

/** Serves `body` as a page that loads the bundle, plus JSON files. */
async function open(
  page: Page,
  body: string,
  files: Record<string, unknown> = {},
): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><title>embed</title>
<script type="module" src="/algoviz-player.js"></script>
<body style="margin:0">${body}</body>`,
      });
    if (path === '/algoviz-player.js')
      return route.fulfill({ contentType: 'text/javascript', body: bundle() });
    const file = files[path];
    if (file !== undefined)
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(file),
      });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(
    () => customElements.get('algo-player') !== undefined,
  );
}

const inline = (doc: unknown, attrs = '') =>
  `<algo-player id="p" ${attrs}><script type="application/json">${JSON.stringify(doc)}</script></algo-player>`;

test('renders an inline document', async ({ page }) => {
  await open(page, inline(sort));
  const player = page.locator('#p');
  await expect(player.locator('.narration')).toHaveText('Initial state.');
  await expectStageMatches(player, sort);
  await player.getByRole('button', { name: 'Next step' }).click();
  await expectStageMatches(player, sort);
});

test('loads a document from src and reports it', async ({ page }) => {
  await open(page, '<algo-player id="p" src="/graph.json"></algo-player>', {
    '/graph.json': graph,
  });
  const player = page.locator('#p');
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(1);
  expect(await player.evaluate((el: AlgoPlayer) => el.length)).toBe(
    graph.steps.length,
  );
  await expectStageMatches(player, graph);
});

test('fires algo-load, algo-frame and algo-error', async ({ page }) => {
  await open(page, '<algo-player id="p"></algo-player>');
  const events = await page.evaluate(async (doc: unknown) => {
    const el = document.querySelector('algo-player')!;
    const seen: string[] = [];
    el.addEventListener('algo-load', (e) =>
      seen.push(`load ${e.detail.length}`),
    );
    el.addEventListener('algo-frame', (e) =>
      seen.push(
        `frame ${e.detail.index}/${e.detail.length} ${e.detail.playing}`,
      ),
    );
    el.addEventListener('algo-error', (e) =>
      seen.push(`error ${e.detail.errors[0]!.code}`),
    );
    el.visualization = doc;
    await new Promise((r) => setTimeout(r, 50));
    el.next();
    el.next();
    el.prev();
    el.visualization = { version: '0.1' };
    await new Promise((r) => setTimeout(r, 50));
    return seen;
  }, sort as unknown);
  const n = sort.steps.length;
  expect(events).toEqual([
    `load ${n}`,
    `frame 1/${n} false`,
    `frame 2/${n} false`,
    `frame 1/${n} false`,
    `frame 0/0 false`,
    'error INVALID_SHAPE',
  ]);
});

test.describe('failures', () => {
  test.use({ expectedConsoleErrors: [/404/] });

  test('a missing src shows LOAD_FAILED', async ({ page }) => {
    await open(page, '<algo-player id="p" src="/missing.json"></algo-player>');
    const alert = page.locator('#p').getByRole('alert');
    await expect(alert).toContainText('LOAD_FAILED');
    await expect(alert).toContainText('HTTP 404');
  });
});

test('broken inline JSON shows INVALID_JSON', async ({ page }) => {
  await open(
    page,
    '<algo-player id="p"><script type="application/json">{ "version": </script></algo-player>',
  );
  await expect(page.locator('#p').getByRole('alert')).toContainText(
    'INVALID_JSON',
  );
});

test('an invalid document lists its errors, then recovers', async ({
  page,
}) => {
  await open(page, '<algo-player id="p"></algo-player>');
  const player = page.locator('#p');
  const bad = JSON.parse(JSON.stringify(sort)) as {
    steps: { actions: { type: string }[] }[];
  };
  bad.steps[0]!.actions[0]!.type = 'swop';
  await player.evaluate((el: AlgoPlayer, doc: unknown) => {
    el.visualization = doc;
  }, bad);
  await expect(player.getByRole('alert')).toContainText(
    'UNKNOWN_ACTION at $.steps[0].actions[0].type',
  );
  await player.evaluate((el: AlgoPlayer, doc: unknown) => {
    el.visualization = doc;
  }, sortJson);
  await expect(player.getByRole('alert')).toHaveCount(0);
  await expectStageMatches(player, sort);
});

test('the visualization property wins over src and inline JSON', async ({
  page,
}) => {
  await open(page, inline(sort, 'src="/graph.json"'), { '/graph.json': graph });
  const player = page.locator('#p');
  // src wins over the inline document.
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(1);
  await player.evaluate((el: AlgoPlayer, doc: unknown) => {
    el.visualization = doc;
  }, sortJson);
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(0);
  await expectStageMatches(player, sort);
});

test('changing src loads the new document', async ({ page }) => {
  await open(page, '<algo-player id="p" src="/a.json"></algo-player>', {
    '/a.json': sort,
    '/b.json': graph,
  });
  const player = page.locator('#p');
  await expect(
    player.locator('[data-key="arr/title"], [data-key="a/title"]'),
  ).not.toHaveCount(0);
  await player.evaluate((el: AlgoPlayer) => el.setAttribute('src', '/b.json'));
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(1);
  await expectStageMatches(player, graph);
});

test.describe('attributes', () => {
  test('frame starts at a given step', async ({ page }) => {
    await open(page, inline(sort, 'frame="3"'));
    const player = page.locator('#p');
    await expect(player).toHaveAttribute('frame', '3');
    await expect(player.locator('.counter')).toHaveText(
      `3 / ${sort.steps.length}`,
    );
    await expectStageMatches(player, sort);
  });

  test('language picks the code shown first; the reader’s choice wins and is shared', async ({
    page,
  }) => {
    // Two players: one asks for Python, the other has no preference.
    await open(
      page,
      `${inline(bst, 'language="python" frame="go"')}${inline(bst, 'frame="go"').replace('id="p"', 'id="q"')}`,
    );
    const [p, q] = [page.locator('#p'), page.locator('#q')];
    const python = (player: typeof p) =>
      player.getByRole('button', { name: 'Python' });
    await expect(python(p)).toHaveAttribute('aria-pressed', 'true');
    await expect(p.locator('.line.current')).toContainText(
      'node = node.left if key < node.key else node.right',
    );
    await expect(q.locator('.line.current')).toContainText(
      'elseif key < node.key',
    );
    await expect(q.locator('.tok-procedure').first()).toHaveText('TREE-SEARCH');
    // The reader picks pseudocode in the first: both show it, and it is
    // remembered over the attribute after a reload.
    await p.getByRole('button', { name: 'Pseudocode' }).click();
    await expect(p.locator('.line.current')).toContainText(
      'elseif key < node.key',
    );
    await q.getByRole('button', { name: 'Python' }).click();
    await expect(python(p)).toHaveAttribute('aria-pressed', 'true');
    await expect(p).toHaveAttribute('frame', String(frameOf('go')));
    await page.reload();
    await page.waitForFunction(
      () => customElements.get('algo-player') !== undefined,
    );
    await expect(python(q)).toHaveAttribute('aria-pressed', 'true');
  });

  test('hide-controls and hide-code', async ({ page }) => {
    await open(page, inline(sort, 'hide-controls hide-code'));
    const player = page.locator('#p');
    await expect(player.locator('.narration')).toBeVisible();
    await expect(player.locator('.controls')).toBeHidden();
    await expect(player.locator('.code')).toHaveCount(0);
  });

  test('hidden hides the player', async ({ page }) => {
    await open(page, inline(sort, 'hidden'));
    const player = page.locator('#p');
    await expect(player).toBeHidden();
    await player.evaluate((el: AlgoPlayer) => (el.hidden = false));
    await expect(player).toBeVisible();
    await expectStageMatches(player, sort);
  });

  test('theme="dark" and the CSS custom properties', async ({ page }) => {
    await open(
      page,
      `<style>algo-player { --algo-accent: rgb(1, 2, 3); }</style>${inline(sort, 'theme="dark"')}`,
    );
    const player = page.locator('#p');
    await expect(player).toHaveAttribute('data-resolved-theme', 'dark');
    const accent = await player.evaluate(
      (el) =>
        getComputedStyle(el.shadowRoot!.querySelector('button.primary')!)
          .backgroundColor,
    );
    expect(accent).toBe('rgb(1, 2, 3)');
  });

  test('autoplay plays to the end and stops; loop starts over', async ({
    page,
  }) => {
    await open(
      page,
      inline(sort, 'speed="40" autoplay') +
        inline(sort, 'speed="40" autoplay loop').replace('id="p"', 'id="q"'),
    );
    const n = String(sort.steps.length);
    const once = page.locator('#p');
    await expect(once).toHaveAttribute('frame', n);
    await page.waitForTimeout(400);
    await expect(once).toHaveAttribute('frame', n);
    await expect(once.getByRole('button', { name: 'Replay' })).toBeVisible();

    const looping = page.locator('#q');
    const frames = await looping.evaluate(
      (el: AlgoPlayer) =>
        new Promise<number[]>((resolve) => {
          const seen: number[] = [];
          el.addEventListener('algo-frame', (e) => {
            seen.push(e.detail.index);
            if (seen.length > 2 * el.length) resolve(seen);
          });
        }),
    );
    expect(frames).toContain(0);
    expect(frames).toContain(sort.steps.length);
  });

  test('display mode with once plays a single time', async ({ page }) => {
    await open(page, inline(sort, 'mode="display" once speed="40"'));
    const player = page.locator('#p');
    await expect(player).toHaveAttribute('frame', String(sort.steps.length));
    await page.waitForTimeout(2000);
    await expect(player).toHaveAttribute('frame', String(sort.steps.length));
    await expect(player.locator('.controls')).toBeHidden();
    await expectStageMatches(player, sort);
  });
});

test('methods: next, prev, seek, play, pause and length', async ({ page }) => {
  await open(page, inline(sort, 'speed="50"'));
  const player = page.locator('#p');
  const n = sort.steps.length;
  expect(await player.evaluate((el: AlgoPlayer) => el.length)).toBe(n);
  await player.evaluate((el: AlgoPlayer) => {
    el.next();
    el.next();
  });
  await expect(player).toHaveAttribute('frame', '2');
  await player.evaluate((el: AlgoPlayer) => el.prev());
  await expect(player).toHaveAttribute('frame', '1');
  await player.evaluate((el: AlgoPlayer) => el.seek(1_000));
  await expect(player).toHaveAttribute('frame', String(n));
  await player.evaluate((el: AlgoPlayer) => el.seek(-5));
  await expect(player).toHaveAttribute('frame', '0');
  await player.evaluate((el: AlgoPlayer) => el.play());
  await expect(player).not.toHaveAttribute('frame', '0');
  await player.evaluate((el: AlgoPlayer) => el.pause());
  const at = await player.getAttribute('frame');
  await page.waitForTimeout(300);
  await expect(player).toHaveAttribute('frame', at!);
  await expectStageMatches(player, sort);
});

test('setting the frame attribute seeks', async ({ page }) => {
  await open(page, inline(sort));
  const player = page.locator('#p');
  await player.evaluate((el: AlgoPlayer) => el.setAttribute('frame', '4'));
  await expect(player.locator('.counter')).toHaveText(
    `4 / ${sort.steps.length}`,
  );
  await expectStageMatches(player, sort);
});

test('a new document and a frame set together open at that frame', async ({
  page,
}) => {
  await open(page, inline(sort, 'frame="1"'));
  const player = page.locator('#p');
  await expect(player).toHaveAttribute('frame', '1');
  await player.evaluate((el: AlgoPlayer, doc: unknown) => {
    el.visualization = doc;
    el.frame = 2;
  }, graphJson);
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(1);
  await expect(player).toHaveAttribute('frame', '2');
  await expectStageMatches(player, graph);
});

test('a player moved in the page keeps its frame and resumes playing', async ({
  page,
}) => {
  await open(page, `${inline(sort, 'speed="80"')}<div id="box"></div>`);
  const player = page.locator('#p');
  await player.evaluate((el: AlgoPlayer) => {
    el.seek(2);
    el.play();
    document.querySelector('#box')!.append(el);
  });
  await expect(page.locator('#box > algo-player')).toHaveCount(1);
  await expect(player).toHaveAttribute('frame', String(sort.steps.length));
  await expectStageMatches(player, sort);
});

test('several players on a page are independent', async ({ page }) => {
  await open(page, inline(sort) + inline(graph).replace('id="p"', 'id="q"'));
  await page.locator('#p').getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('#p')).toHaveAttribute('frame', '1');
  await expect(page.locator('#q')).toHaveAttribute('frame', '0');
  await expectStageMatches(page.locator('#p'), sort);
  await expectStageMatches(page.locator('#q'), graph);
});

test('opens at a selector in the frame attribute', async ({ page }) => {
  await open(page, inline(bst, 'frame="insert-5/go#2"'));
  const player = page.locator('#p');
  await expect(player).toHaveAttribute(
    'frame',
    String(frameOf('insert-5/go#2')),
  );
  await expectStageMatches(player, bst);
  expect(
    await player.evaluate((el: AlgoPlayer) => [el.stepName, el.section?.id]),
  ).toEqual(['go', 'insert-5']);
  // A section opens at its first step.
  await player.evaluate((el: AlgoPlayer) =>
    el.setAttribute('frame', 'insert-5'),
  );
  await expect(player).toHaveAttribute('frame', String(insertStart + 1));
  await expect(player.locator('.section-title')).toHaveText('Insert 5');
});

test('a selector that matches nothing keeps the frame and says why', async ({
  page,
}) => {
  await open(page, inline(bst, 'frame="found"'));
  const player = page.locator('#p');
  await expect(player).toHaveAttribute('frame', String(frameOf('found')));
  await player.evaluate((el: AlgoPlayer) => el.setAttribute('frame', 'relax'));
  const alert = player.getByRole('alert');
  await expect(alert).toContainText('Cannot open frame "relax".');
  await expect(alert).toContainText('Sections: search-7, insert-5.');
  await expect(player).toHaveAttribute('frame', String(frameOf('found')));
  await expect(player.locator('svg.scene')).toBeVisible();
});

test('the timeline shows sections, and moves between them', async ({
  page,
}) => {
  await open(page, inline(bst));
  const player = page.locator('#p');
  const sections = player.locator('.sections .section');
  await expect(sections).toHaveText(['Search 7', 'Insert 5']);
  await expect(player.locator('.sections .current')).toHaveCount(0);

  // Clicking a section goes to its first step.
  await sections.nth(1).click();
  await expect(player).toHaveAttribute('frame', String(insertStart + 1));
  await expect(sections.nth(1)).toHaveClass(/current/);
  await expect(
    player.getByRole('slider', { name: 'Timeline' }),
  ).toHaveAttribute(
    'aria-valuetext',
    `Frame ${insertStart + 1} of ${bst.steps.length}, Insert 5`,
  );

  // Page Up and Page Down move between sections from the keyboard.
  await player.focus();
  await page.keyboard.press('PageUp');
  await expect(player).toHaveAttribute('frame', '1');
  await expect(sections.nth(0)).toHaveClass(/current/);
  await page.keyboard.press('PageDown');
  await expect(player).toHaveAttribute('frame', String(insertStart + 1));
  await page.keyboard.press('PageDown');
  await expect(player).toHaveAttribute('frame', String(bst.steps.length));
  await expectStageMatches(player, bst);
  // Also from the slider, where screen readers hear the section's name.
  const slider = player.getByRole('slider', { name: 'Timeline' });
  await slider.focus();
  await page.keyboard.press('PageUp');
  await expect(player).toHaveAttribute('frame', String(insertStart + 1));

  // Each section starts under the slider where its first frame is.
  const geometry = await player.evaluate((el) => {
    const root = el.shadowRoot!;
    const box = (s: string) => root.querySelector(s)!.getBoundingClientRect();
    return {
      slider: box('input[type="range"]'),
      track: box('.sections .track'),
      second: box('.sections .section:nth-child(2)'),
    };
  });
  expect(geometry.track.left).toBeGreaterThan(geometry.slider.left);
  expect(geometry.track.right).toBeLessThan(geometry.slider.right);
  const at = (frame: number) =>
    geometry.track.left + (geometry.track.width * frame) / bst.steps.length;
  expect(Math.abs(geometry.second.left - at(insertStart))).toBeLessThan(1);
});

test('algo-frame names the step and its section', async ({ page }) => {
  await open(page, inline(bst));
  const detail = await page.evaluate(async () => {
    const el = document.querySelector('algo-player')!;
    const next = new Promise<unknown>((resolve) =>
      el.addEventListener('algo-frame', (e) => resolve(e.detail), {
        once: true,
      }),
    );
    el.next();
    return next;
  });
  expect(detail).toEqual({
    index: 1,
    length: bst.steps.length,
    playing: false,
    stepName: 'go',
    sectionId: 'search-7',
  });
});
