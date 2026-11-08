/** A player that takes an algorithm and its input (ADR 0032). */
import { afterEach, describe, expect, it } from 'vitest';

import { runAlgorithm } from '@algoviz/recipes';

import '../src/define.ts';
import type { AlgoPlayer } from '../src/index.ts';

afterEach(() => {
  document.body.replaceChildren();
});

/** Mounts a player and waits until it has loaded or failed. */
async function mount(html: string): Promise<AlgoPlayer> {
  document.body.innerHTML = html;
  const el = document.querySelector('algo-player')!;
  await settled(el);
  return el;
}

/** Waits for the next algo-load or algo-error. */
const settled = (el: AlgoPlayer) =>
  new Promise<void>((resolve) => {
    el.addEventListener('algo-load', () => resolve(), { once: true });
    el.addEventListener('algo-error', () => resolve(), { once: true });
  });

const lengthOf = (id: string, input?: unknown) => {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  return run.value.document.steps.length;
};

const errorsOf = (el: AlgoPlayer) =>
  el.shadowRoot!.querySelector('.errors pre')?.textContent ?? '';

describe('<algo-player algorithm>', () => {
  it('runs the algorithm on the input attribute, in a notation', async () => {
    const el = await mount(
      '<algo-player algorithm="insertion-sort" input="5 2 4 6 1 3"></algo-player>',
    );
    expect(el.length).toBe(
      lengthOf('insertion-sort', { values: [5, 2, 4, 6, 1, 3] }),
    );
    expect(errorsOf(el)).toBe('');
  });

  it('reads the input attribute as JSON or as an object without braces', async () => {
    const json = await mount(
      `<algo-player algorithm="dijkstra" input='{"graph": "A-B 2, B-C 1", "source": "B"}'></algo-player>`,
    );
    const expected = lengthOf('dijkstra', {
      graph: 'A-B 2, B-C 1',
      source: 'B',
    });
    expect(json.length).toBe(expected);
    const bare = await mount(
      `<algo-player algorithm="dijkstra" input='"graph": "A-B 2, B-C 1", "source": "B"'></algo-player>`,
    );
    expect(bare.length).toBe(expected);
  });

  it('runs the first example without an input', async () => {
    const el = await mount('<algo-player algorithm="bfs"></algo-player>');
    expect(el.length).toBe(lengthOf('bfs'));
  });

  it('takes the input from inline JSON', async () => {
    const el = await mount(
      '<algo-player algorithm="merge-sort"><script type="application/json">{"values": [3, 1, 2]}</script></algo-player>',
    );
    expect(el.length).toBe(lengthOf('merge-sort', { values: [3, 1, 2] }));
  });

  it('takes any value as the input property, and runs again when it changes', async () => {
    const el = await mount(
      '<algo-player algorithm="bubble-sort"></algo-player>',
    );
    const changed = settled(el);
    el.input = { values: [2, 1] };
    await changed;
    expect(el.length).toBe(lengthOf('bubble-sort', { values: [2, 1] }));
    const again = settled(el);
    el.input = '4 3 2 1';
    await again;
    expect(el.length).toBe(lengthOf('bubble-sort', { values: [4, 3, 2, 1] }));
  });

  it('runs again when the algorithm changes', async () => {
    const el = await mount(
      '<algo-player algorithm="bubble-sort" input="3 1 2"></algo-player>',
    );
    const changed = settled(el);
    el.algorithm = 'selection-sort';
    await changed;
    expect(el.length).toBe(lengthOf('selection-sort', { values: [3, 1, 2] }));
  });

  it('shows an input error with its token, and fires algo-error', async () => {
    document.body.innerHTML =
      '<algo-player algorithm="dijkstra" input="A-B 4, B-C x"></algo-player>';
    const el = document.querySelector('algo-player')!;
    const error = new Promise<CustomEvent>((resolve) =>
      el.addEventListener('algo-error', (e) => resolve(e), { once: true }),
    );
    const { detail } = await error;
    expect(detail.errors[0]).toMatchObject({
      code: 'INVALID_NOTATION',
      path: '$.input',
    });
    await el.updateComplete;
    expect(errorsOf(el)).toContain('"x" (character 12)');
  });

  it('shows an unknown algorithm and broken JSON', async () => {
    expect(
      errorsOf(await mount('<algo-player algorithm="nope"></algo-player>')),
    ).toContain('UNKNOWN_ALGORITHM');
    expect(
      errorsOf(
        await mount(
          `<algo-player algorithm="bfs" input='{"graph": '></algo-player>`,
        ),
      ),
    ).toContain('INVALID_JSON');
  });

  it('keeps the error of broken inline JSON, without running the example', async () => {
    const el = await mount(
      '<algo-player algorithm="bfs"><script type="application/json">{"graph": </script></algo-player>',
    );
    // Give a stale load of the first example time to finish.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.updateComplete;
    expect(errorsOf(el)).toContain('INVALID_JSON');
    expect(el.length).toBe(0);
  });

  it('runs the first example once the input attribute is removed', async () => {
    const el = await mount(
      '<algo-player algorithm="bfs" input="A-B"></algo-player>',
    );
    const changed = settled(el);
    el.removeAttribute('input');
    await changed;
    expect(errorsOf(el)).toBe('');
    expect(el.length).toBe(lengthOf('bfs'));
  });

  it('lets the visualization property win over the algorithm', async () => {
    const el = document.createElement('algo-player');
    el.algorithm = 'bfs';
    el.visualization = {
      version: '0.1',
      structures: { s: { kind: 'stack', initial: [] } },
      steps: [{ actions: [{ target: 's', type: 'push', element: 1 }] }],
    };
    const loaded = settled(el);
    document.body.append(el);
    await loaded;
    expect(el.length).toBe(1);
  });
});
