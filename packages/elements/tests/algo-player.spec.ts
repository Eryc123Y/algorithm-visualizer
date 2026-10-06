import { afterEach, describe, expect, it } from 'vitest';

import '../src/define.ts';
import type { AlgoPlayer } from '../src/index.ts';

const doc = {
  version: '0.1',
  source: { code: 'compare(a, b)\nswap(a, b)' },
  structures: { arr: { kind: 'array', initial: [2, 1] } },
  steps: [
    {
      actions: [{ target: 'arr', type: 'compare', i: 0, j: 1 }],
      meta: { line: 1, narration: 'Compare 2 and 1.', vars: { i: 0 } },
    },
    {
      actions: [{ target: 'arr', type: 'swap', i: 0, j: 1 }],
      meta: { line: 2, narration: 'Swap them.' },
    },
  ],
};

async function mount(setup: (el: AlgoPlayer) => void): Promise<AlgoPlayer> {
  const el = document.createElement('algo-player');
  setup(el);
  document.body.append(el);
  await el.updateComplete;
  await el.updateComplete;
  return el;
}

const shadow = (el: AlgoPlayer) => el.shadowRoot!;
const text = (el: AlgoPlayer, selector: string) =>
  shadow(el).querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

afterEach(() => {
  document.body.replaceChildren();
});

describe('<algo-player>', () => {
  it('loads a document from the visualization property', async () => {
    const loads: number[] = [];
    const el = await mount((e) => {
      e.addEventListener('algo-load', (event) =>
        loads.push(event.detail.length),
      );
      e.visualization = doc;
    });
    expect(loads).toEqual([2]);
    expect(el.length).toBe(2);
    expect(text(el, '.narration')).toBe('Initial state.');
    expect(shadow(el).querySelectorAll('[data-role]')).toHaveLength(2);
  });

  it('steps forward with narration, variables and the current code line', async () => {
    const frames: number[] = [];
    const el = await mount((e) => {
      e.addEventListener('algo-frame', (event) =>
        frames.push(event.detail.index),
      );
      e.visualization = doc;
    });
    el.next();
    await el.updateComplete;
    expect(el.frame).toBe(1);
    expect(el.getAttribute('frame')).toBe('1');
    expect(text(el, '.narration')).toBe('Compare 2 and 1.');
    expect(text(el, '.vars')).toBe('i = 0');
    expect(text(el, '.line.current')).toBe('compare(a, b)');
    expect(shadow(el).querySelectorAll('[data-role="compare"]')).toHaveLength(
      2,
    );
    expect(frames).toEqual([1]);
  });

  it('reads inline JSON from a script child', async () => {
    const el = await mount((e) => {
      const script = document.createElement('script');
      script.type = 'application/json';
      script.textContent = JSON.stringify(doc);
      e.append(script);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.length).toBe(2);
  });

  it('shows validation errors instead of a scene', async () => {
    const errors: string[] = [];
    const el = await mount((e) => {
      e.addEventListener('algo-error', (event) =>
        errors.push(...event.detail.errors.map((x) => x.code)),
      );
      e.visualization = {
        ...doc,
        steps: [{ actions: [{ target: 'nope', type: 'swap', i: 0, j: 1 }] }],
      };
    });
    expect(errors).toEqual(['UNKNOWN_TARGET']);
    expect(text(el, '.errors')).toContain(
      'UNKNOWN_TARGET at $.steps[0].actions[0].target',
    );
    expect(shadow(el).querySelector('.controls')?.hasAttribute('hidden')).toBe(
      true,
    );
  });

  it('honours a frame set before the document loads', async () => {
    const el = await mount((e) => {
      e.setAttribute('frame', '2');
      e.visualization = doc;
    });
    expect(el.frame).toBe(2);
    expect(text(el, '.narration')).toBe('Swap them.');
  });

  it('responds to the keyboard', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    await el.updateComplete;
    expect(el.frame).toBe(2);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await el.updateComplete;
    expect(el.frame).toBe(1);
  });
});
