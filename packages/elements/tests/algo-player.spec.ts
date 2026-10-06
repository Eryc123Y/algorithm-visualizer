import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('keeps a valid frame when the frame attribute is not a number', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    el.next();
    await el.updateComplete;
    el.setAttribute('frame', 'abc');
    await el.updateComplete;
    await el.updateComplete;
    expect(el.frame).toBe(1);
    expect(text(el, '.narration')).toBe('Compare 2 and 1.');
  });

  it('ignores malformed inline JSON when the visualization property is set', async () => {
    const errors: unknown[] = [];
    const el = await mount((e) => {
      e.addEventListener('algo-error', (event) => errors.push(event.detail));
      const script = document.createElement('script');
      script.type = 'application/json';
      script.textContent = '{ not json';
      e.append(script);
      e.visualization = doc;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(errors).toEqual([]);
    expect(el.length).toBe(2);
    expect(shadow(el).querySelector('.errors')).toBeNull();
  });

  it('pauses when removed from the page and resumes when re-inserted', async () => {
    const el = await mount((e) => {
      e.speed = 5000;
      e.visualization = doc;
    });
    const playing = () =>
      (el as unknown as { playback: { playing: boolean } }).playback.playing;
    el.play();
    expect(playing()).toBe(true);
    el.remove();
    expect(playing()).toBe(false);
    await el.updateComplete;
    expect(
      shadow(el).querySelector('button.primary')?.getAttribute('aria-label'),
    ).toBe('Play');
    document.body.append(el);
    expect(playing()).toBe(true);
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

  describe('display mode', () => {
    it('shows only the animation: no chrome, titles or indices', async () => {
      const el = await mount((e) => {
        e.mode = 'display';
        e.visualization = doc;
      });
      expect(el.getAttribute('mode')).toBe('display');
      for (const part of ['.caption', '.controls'])
        expect(shadow(el).querySelector(part)?.hasAttribute('hidden')).toBe(
          true,
        );
      expect(shadow(el).querySelector('.code')).toBeNull();
      const keys = [...shadow(el).querySelectorAll('[data-key]')].map((n) =>
        n.getAttribute('data-key'),
      );
      expect(
        keys.some((k) => k?.includes('/title') || k?.includes('/index/')),
      ).toBe(false);
      expect(keys.filter((k) => k?.includes('/element/'))).toHaveLength(2);
    });

    it('plays and loops on its own, and ignores input', async () => {
      const frames: number[] = [];
      const el = await mount((e) => {
        e.setAttribute('mode', 'display');
        e.speed = 20;
        e.addEventListener('algo-frame', (event) =>
          frames.push(event.detail.index),
        );
        e.visualization = doc;
      });
      expect(el.hasAttribute('tabindex')).toBe(false);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      // Starts playing at 0, two steps, a 1.5 s hold, then back to the start.
      await new Promise((resolve) => setTimeout(resolve, 1700));
      expect(frames.slice(0, 4)).toEqual([0, 1, 2, 0]);
    });

    it('can play once instead of looping', async () => {
      const el = await mount((e) => {
        e.mode = 'display';
        e.once = true;
        e.speed = 20;
        e.visualization = doc;
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(el.frame).toBe(2);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(el.frame).toBe(2);
    });

    it('waits until it is on screen before playing', async () => {
      let report: (visible: boolean) => void = () => {};
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(
            callback: (entries: { isIntersecting: boolean }[]) => void,
          ) {
            report = (visible) => callback([{ isIntersecting: visible }]);
          }
          observe() {}
          disconnect() {}
        },
      );
      try {
        const el = await mount((e) => {
          e.mode = 'display';
        });
        report(false);
        el.visualization = doc;
        await el.updateComplete;
        expect(shadow(el).host.getAttribute('frame')).toBe('0');
        const playing = () =>
          (el as unknown as { playback: { playing: boolean } }).playback
            .playing;
        expect(playing()).toBe(false);
        report(true);
        expect(playing()).toBe(true);
        report(false);
        expect(playing()).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('keeps playing after being moved in the document', async () => {
      const frames: number[] = [];
      const el = await mount((e) => {
        e.mode = 'display';
        e.speed = 20;
        e.visualization = doc;
      });
      el.remove();
      document.body.append(el);
      el.addEventListener('algo-frame', (event) =>
        frames.push(event.detail.index),
      );
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(frames.length).toBeGreaterThan(0);
    });

    it('becomes interactive again when the mode changes back', async () => {
      const el = await mount((e) => {
        e.mode = 'display';
        e.visualization = doc;
      });
      el.mode = 'interactive';
      await el.updateComplete;
      expect(el.tabIndex).toBe(0);
      expect(
        shadow(el).querySelector('.controls')?.hasAttribute('hidden'),
      ).toBe(false);
      expect(shadow(el).querySelector('[data-key="arr/title"]')).not.toBeNull();
    });
  });
});
