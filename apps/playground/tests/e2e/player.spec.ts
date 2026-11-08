/**
 * The interactive player in the playground: every example drawn correctly
 * at any frame, however it is reached, and every control.
 */
import type { AlgoPlayer } from '@algoviz/elements';
import { themeNames } from '@algoviz/svg';

import { examples } from '../../src/samples/examples';
import {
  editorDocument,
  expect,
  expectStageMatches,
  settle,
  test,
} from './fixtures';

test.describe('every example', () => {
  for (const { label } of examples)
    test(label, async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('example').selectOption(label);
      const player = page.getByTestId('player');
      const doc = await editorDocument(page);
      await expect(player.locator('.errors')).toHaveCount(0);
      await expect(player).toHaveAttribute('frame', '0');
      await expectStageMatches(player, doc);

      const length = await player.evaluate((el: AlgoPlayer) => el.length);
      expect(length).toBeGreaterThan(0);

      // Steps clicked faster than the animations run.
      const next = player.getByRole('button', { name: 'Next step' });
      for (let k = 0; k < Math.min(3, length); k++) await next.click();
      await expect(player).toHaveAttribute(
        'frame',
        String(Math.min(3, length)),
      );
      await expectStageMatches(player, doc);

      // Jumps across the trace, both ways.
      await player.focus();
      await page.keyboard.press('End');
      await expect(player).toHaveAttribute('frame', String(length));
      await expectStageMatches(player, doc);
      await player.evaluate((el: AlgoPlayer) =>
        el.seek(Math.floor(el.length / 2)),
      );
      await page.keyboard.press('ArrowLeft');
      await expect(player).toHaveAttribute(
        'frame',
        String(Math.max(0, Math.floor(length / 2) - 1)),
      );
      await expectStageMatches(player, doc);
      await page.keyboard.press('Home');
      await expect(player).toHaveAttribute('frame', '0');
      await expectStageMatches(player, doc);
    });
});

test('play runs to the end, then replays from the start', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('example').selectOption('Binary search');
  const player = page.getByTestId('player');
  await player.evaluate((el: AlgoPlayer) => {
    el.speed = 60;
  });
  const length = await player.evaluate((el: AlgoPlayer) => el.length);
  const counter = player.locator('.counter');
  await expect(counter).toHaveText(`0 / ${length}`);

  await player.getByRole('button', { name: 'Play' }).click();
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(counter).toHaveText(`${length} / ${length}`);
  await expect(player.getByRole('button', { name: 'Replay' })).toBeVisible();
  await expect(
    player.getByRole('button', { name: 'Next step' }),
  ).toBeDisabled();
  await expectStageMatches(player, await editorDocument(page));

  await player.getByRole('button', { name: 'Replay' }).click();
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  await player.getByRole('button', { name: 'Pause' }).click();
  const paused = await player.getAttribute('frame');
  expect(Number(paused)).toBeLessThan(length);
  await page.waitForTimeout(300);
  await expect(player).toHaveAttribute('frame', paused!);
});

test('the previous button is disabled at the start', async ({ page }) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  await expect(
    player.getByRole('button', { name: 'Previous step' }),
  ).toBeDisabled();
  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(
    player.getByRole('button', { name: 'Previous step' }),
  ).toBeEnabled();
});

test('the timeline slider seeks, and keeps its own arrow keys', async ({
  page,
}) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  const slider = player.getByRole('slider', { name: 'Timeline' });
  await slider.fill('7');
  await expect(player).toHaveAttribute('frame', '7');
  await expectStageMatches(player, await editorDocument(page));
  // On the slider, arrows move the slider by one (not the player twice).
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(player).toHaveAttribute('frame', '8');
});

test('space and k toggle playback; typing in the editor does not', async ({
  page,
}) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  await player.focus();
  await page.keyboard.press(' ');
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('k');
  await expect(player.getByRole('button', { name: 'Play' })).toBeVisible();

  const frame = await player.getAttribute('frame');
  const editor = page.getByTestId('editor');
  await editor.focus();
  await page.keyboard.press('End');
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowLeft');
  await expect(player).toHaveAttribute('frame', frame!);
  await expect(player.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('shows the current source line and variables', async ({ page }) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(player.locator('.line.current')).toHaveCount(1);
  await expect(player.getByRole('list', { name: 'Variables' })).toContainText(
    'j = 0',
  );
});

test('switches the code between pseudocode and Python, keeping the frame', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('example').selectOption('Binary search tree');
  const player = page.getByTestId('player');
  const next = player.getByRole('button', { name: 'Next step' });
  await next.click();
  await next.click();
  const languages = player.getByRole('combobox', { name: 'Code language' });
  await expect(languages).toHaveValue('pseudocode');
  await expect(
    player.getByRole('region', { name: 'Source code, Pseudocode' }),
  ).toBeVisible();
  await expect(player.locator('.line.current')).toContainText(
    'if key < node.key',
  );
  const frame = await player.getAttribute('frame');

  // From the menu, the left and right arrows still step the player, and
  // leave the language alone.
  await languages.focus();
  await page.keyboard.press('ArrowRight');
  await expect(player).toHaveAttribute('frame', String(Number(frame) + 1));
  await page.keyboard.press('ArrowLeft');
  await expect(player).toHaveAttribute('frame', frame!);
  await expect(languages).toHaveValue('pseudocode');
  await languages.selectOption('python');
  await expect(languages).toHaveValue('python');
  await expect(player).toHaveAttribute('frame', frame!);
  await expect(player.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(
    player.getByRole('region', { name: 'Source code, Python' }),
  ).toBeVisible();
  await expect(player.locator('.line.current')).toHaveText(
    /^\s*if key < node.key:$/,
  );

  // And by choosing an option.
  await languages.selectOption('pseudocode');
  await expect(
    player.getByRole('region', { name: 'Source code, Pseudocode' }),
  ).toBeVisible();
  await languages.selectOption({ label: 'Python' });

  // Remembered on this site.
  await page.reload();
  await page.getByTestId('example').selectOption('Binary search tree');
  await expect(
    page.getByTestId('player').getByRole('combobox', { name: 'Code language' }),
  ).toHaveValue('python');
});

test('keeps the current line in view of the code panel', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('example').selectOption('Binary search tree');
  const player = page.getByTestId('player');
  for (const frame of [1, 4, 7]) {
    await player.evaluate((el: AlgoPlayer, f) => el.seek(f), frame);
    // The line's middle is inside the panel's visible height.
    await expect
      .poll(() =>
        player.evaluate((el) => {
          const code = el.shadowRoot!.querySelector('.code')!;
          const line = code.querySelector('.line.current')!;
          const c = code.getBoundingClientRect();
          const l = line.getBoundingClientRect();
          const middle = l.top + l.height / 2 - c.top;
          return middle > 0 && middle < code.clientHeight;
        }),
      )
      .toBe(true);
  }
});

test.describe('themes', () => {
  test('the theme menu switches the scene colours', async ({ page }) => {
    await page.goto('/');
    const player = page.getByTestId('player');
    // The scene has no background of its own: the player's container
    // provides it, and the theme colours the items.
    const colours = () =>
      player.evaluate((el: AlgoPlayer) => {
        const root = el.shadowRoot!;
        const container = root.querySelector('.player')!;
        const svg = root.querySelector('svg.scene')!;
        return {
          background: getComputedStyle(container).backgroundColor,
          fills: [...svg.querySelectorAll('[fill]')]
            .map((n) => n.getAttribute('fill'))
            .join(),
        };
      });
    await page.getByTestId('theme').selectOption('light');
    await expect(player).toHaveAttribute('data-resolved-theme', 'light');
    const light = await colours();
    await page.getByTestId('theme').selectOption('dark');
    await expect(player).toHaveAttribute('data-resolved-theme', 'dark');
    const dark = await colours();
    expect(dark.background).not.toBe(light.background);
    expect(dark.fills).not.toBe(light.fills);
    await page.getByTestId('theme').selectOption('print');
    await expect(player).toHaveAttribute('data-resolved-theme', 'print');
  });

  test('the theme menu lists every built-in theme', async ({ page }) => {
    await page.goto('/');
    const values = await page
      .getByTestId('theme')
      .locator('option')
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      );
    for (const name of themeNames) expect(values).toContain(name);
    await page.getByTestId('theme').selectOption('answer-sheet');
    await expect(page.getByTestId('player')).toHaveAttribute(
      'data-resolved-theme',
      'answer-sheet',
    );
  });

  test('auto follows the system, also when it changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const player = page.getByTestId('player');
    await expect(player).toHaveAttribute('data-resolved-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(player).toHaveAttribute('data-resolved-theme', 'light');
    for (const display of await page.getByTestId('display').all())
      await expect(display).toHaveAttribute('data-resolved-theme', 'light');
  });
});

test('reduced motion draws each frame without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const player = page.getByTestId('player');
  await player.getByRole('button', { name: 'Next step' }).click();
  await player.getByRole('button', { name: 'Next step' }).click();
  const running = await player.evaluate(
    (el) =>
      el.shadowRoot!.getAnimations().filter((a) => a.playState === 'running')
        .length,
  );
  expect(running).toBe(0);
  await expectStageMatches(player, await editorDocument(page));
});

test('the editor recovers from broken JSON and invalid documents', async ({
  page,
}) => {
  await page.goto('/');
  const editor = page.getByTestId('editor');
  const player = page.getByTestId('player');
  const good = await editor.inputValue();

  await editor.fill('{ "version": ');
  await expect(page.getByTestId('json-error')).toBeVisible();
  // The last valid document stays on screen while the text is broken.
  await expect(player.locator('.errors')).toHaveCount(0);

  await editor.fill(good.replace('"version": "0.1"', '"version": "9"'));
  await expect(page.getByTestId('json-error')).toHaveCount(0);
  await expect(player.getByRole('alert')).toContainText('UNSUPPORTED_VERSION');
  await expect(player.locator('.controls')).toBeHidden();

  await editor.fill(good);
  await expect(player.getByRole('alert')).toHaveCount(0);
  await expect(player).toHaveAttribute('frame', '0');
  await expectStageMatches(player, JSON.parse(good));
});

test('a new document resets the player to its first frame', async ({
  page,
}) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  await player.focus();
  await page.keyboard.press('End');
  await page.getByTestId('example').selectOption('Kruskal’s algorithm');
  await expect(player).toHaveAttribute('frame', '0');
  await expectStageMatches(player, await editorDocument(page));
});

test('places side structures beside or below with the layout attribute', async ({
  page,
}) => {
  await page.goto('/');
  // An array with a call stack in the side panel (ADR 0029).
  const sided = {
    version: '0.4',
    structures: {
      a: { kind: 'array', initial: [3, 1, 2] },
      calls: { kind: 'stack', initial: ['sort a[0..2]'], place: 'side' },
    },
    steps: [{ actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }] }],
  };
  await page.getByTestId('editor').fill(JSON.stringify(sided));
  const player = page.getByTestId('player');
  await expect(player.getByRole('alert')).toHaveCount(0);
  const size = () =>
    player.evaluate((el) => {
      const svg = el.shadowRoot!.querySelector('svg.scene')!;
      return [
        Number(svg.getAttribute('width')),
        Number(svg.getAttribute('height')),
      ];
    });
  await expectStageMatches(player, sided);
  const [wideWidth, wideHeight] = await size();
  await player.evaluate((el) => el.setAttribute('layout', 'narrow'));
  await expectStageMatches(player, sided);
  const [narrowWidth, narrowHeight] = await size();
  expect(narrowWidth).toBeLessThan(wideWidth!);
  expect(narrowHeight).toBeGreaterThan(wideHeight!);
});

test.describe('display mode', () => {
  test('pauses while off screen and resumes when scrolled back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 500 });
    await page.goto('/');
    const display = page.getByTestId('display').first();
    // Off screen at the bottom of the page: it must not advance.
    const before = await display.getAttribute('frame');
    await page.waitForTimeout(1500);
    await expect(display).toHaveAttribute('frame', before!);

    await display.scrollIntoViewIfNeeded();
    await expect(display).not.toHaveAttribute('frame', before!, {
      timeout: 5000,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const left = await display.getAttribute('frame');
    await page.waitForTimeout(1500);
    await expect(display).toHaveAttribute('frame', left!);
  });

  test('ignores the keyboard and is not focusable', async ({ page }) => {
    await page.goto('/');
    const display = page.getByTestId('display').first();
    expect(await display.getAttribute('tabindex')).toBeNull();
  });

  test('draws its frames with the bare layout', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('example').selectOption('Disjoint-set forest');
    await page.getByTestId('mode').selectOption('display');
    const player = page.getByTestId('player');
    await player.evaluate((el: AlgoPlayer) => el.pause());
    await player.evaluate((el: AlgoPlayer) => el.seek(2));
    await expectStageMatches(player, await editorDocument(page));
  });
});

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  for (const label of ['Dijkstra’s algorithm', 'Floyd–Warshall', 'Trie']) {
    await page.getByTestId('example').selectOption(label);
    await settle(page.getByTestId('player'));
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, label).toBeLessThanOrEqual(0);
  }
});

test.describe('random interaction', () => {
  // Deterministic pseudo-random sequences, so a failure can be replayed.
  for (const [label, seed] of [
    ['Bubble sort', 1],
    ['AVL tree', 2],
    ['Dijkstra’s algorithm', 3],
    ['Reverse a linked list', 4],
    ['Longest common subsequence', 5],
  ] as const)
    test(`${label} (seed ${seed})`, async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('example').selectOption(label);
      const player = page.getByTestId('player');
      const doc = await editorDocument(page);
      await player.evaluate((el: AlgoPlayer) => {
        el.speed = 120;
      });
      let state = seed;
      const random = (n: number) => {
        state = (state * 1103515245 + 12345) % 2 ** 31;
        return state % n;
      };
      for (let k = 0; k < 40; k++) {
        const action = random(6);
        if (action === 0) await player.evaluate((el: AlgoPlayer) => el.next());
        else if (action === 1)
          await player.evaluate((el: AlgoPlayer) => el.prev());
        else if (action === 2) {
          const to = random(1000);
          await player.evaluate(
            (el: AlgoPlayer, to) => el.seek(to % (el.length + 1)),
            to,
          );
        } else if (action === 3)
          await player.evaluate((el: AlgoPlayer) => el.play());
        else if (action === 4)
          await player.evaluate((el: AlgoPlayer) => el.pause());
        else await page.waitForTimeout(random(150));
        if (k % 10 === 9) {
          await player.evaluate((el: AlgoPlayer) => el.pause());
          await expectStageMatches(player, doc);
        }
      }
    });
});
