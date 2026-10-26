/**
 * Shared E2E helpers.
 *
 * - `test` fails any test whose page logs a console error or throws, unless
 *   the test declares the errors it expects with `expectedConsoleErrors`.
 * - `expectStageMatches` checks that what a player drew equals the scene the
 *   engine computes for its frame: the same items, at the same places, all
 *   fully visible, once animations have finished.
 */
import {
  bareLayoutOptions,
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
} from '@algoviz/core';
import { num, paintScene } from '@algoviz/svg';
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

export const test = base.extend<{
  expectedConsoleErrors: RegExp[];
  failOnConsoleErrors: void;
}>({
  expectedConsoleErrors: [[], { option: true }],
  failOnConsoleErrors: [
    async ({ page, expectedConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) =>
        errors.push(`pageerror: ${error.message}`),
      );
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use();
      const unexpected = errors.filter(
        (e) => !expectedConsoleErrors.some((re) => re.test(e)),
      );
      expect(unexpected, 'console errors and uncaught exceptions').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits until no animation runs in the player's shadow tree. */
export async function settle(player: Locator): Promise<void> {
  await player.evaluate(async (el) => {
    const root = el.shadowRoot!;
    for (let round = 0; round < 50; round++) {
      const running = root
        .getAnimations()
        .filter((a) => a.playState === 'running' || a.pending);
      if (running.length === 0) return;
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
    }
  });
}

interface Drawn {
  readonly key: string;
  readonly transform: string;
  readonly opacity: number;
}

const translateOf = (transform: string) => {
  const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(transform);
  return m === null ? null : `${num(Number(m[1]))},${num(Number(m[2]))}`;
};

/**
 * Checks the player's drawing against the engine's scene for its current
 * frame, after animations end.
 */
export async function expectStageMatches(
  player: Locator,
  document: unknown,
): Promise<void> {
  await settle(player);
  const { frame, mode, drawn } = await player.evaluate((el) => ({
    frame: Number(el.getAttribute('frame')),
    mode: el.getAttribute('mode') ?? 'interactive',
    drawn: [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('svg.scene g[data-key]'),
    ].map((g) => ({
      key: g.dataset['key']!,
      transform: g.style.transform,
      opacity: Number(getComputedStyle(g).opacity),
    })),
  }));
  const loaded = loadTrace(document);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const options = mode === 'display' ? bareLayoutOptions : defaultLayoutOptions;
  const scene = paintScene(layoutTrace(loaded.value, options).sceneAt(frame));
  const want = new Map(
    scene.items.map((i) => [i.key, `${num(i.x)},${num(i.y)}`]),
  );
  const got = new Map(drawn.map((d: Drawn) => [d.key, d]));
  expect([...got.keys()].sort(), `items drawn at frame ${frame}`).toEqual(
    [...want.keys()].sort(),
  );
  for (const [key, at] of want) {
    const d = got.get(key)!;
    expect(translateOf(d.transform), `${key} at frame ${frame}`).toBe(at);
    expect(d.opacity, `${key} opacity at frame ${frame}`).toBe(1);
  }
}

/** The document in the playground's editor. */
export async function editorDocument(page: Page): Promise<unknown> {
  return JSON.parse(await page.getByTestId('editor').inputValue()) as unknown;
}
