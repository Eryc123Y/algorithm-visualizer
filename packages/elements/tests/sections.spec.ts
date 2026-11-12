/**
 * Step names and sections in the player (ADR 0020): the `frame` attribute
 * takes a selector, the timeline shows sections, and page scripts can read
 * the current step's name and section.
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../src/define.ts';
import type { AlgoFrameDetail, AlgoPlayer } from '../src/index.ts';

// Steps 0–1 are the first pass and steps 2–4 the second, so frames 1–2
// show the first pass and frames 3–5 the second.
const doc = {
  version: '1.0',
  structures: { arr: { kind: 'array', initial: [3, 2, 1] } },
  steps: [
    {
      actions: [{ target: 'arr', type: 'compare', i: 0, j: 1 }],
      meta: { id: 'compare', narration: 'Compare 3 and 2.' },
    },
    {
      actions: [{ target: 'arr', type: 'swap', i: 0, j: 1 }],
      meta: { id: 'swap', narration: 'Swap them.' },
    },
    {
      actions: [{ target: 'arr', type: 'compare', i: 1, j: 2 }],
      meta: { id: 'compare', narration: 'Compare 3 and 1.' },
    },
    {
      actions: [{ target: 'arr', type: 'swap', i: 1, j: 2 }],
      meta: { id: 'swap', narration: 'Swap them.' },
    },
    {
      actions: [{ target: 'arr', type: 'settle', index: 2 }],
      meta: { id: 'settle', narration: '3 is in place.' },
    },
  ],
  sections: [
    { id: 'first-pass', title: 'First pass', start: 0 },
    { id: 'second-pass', title: 'Second pass', start: 2 },
  ],
};

async function mount(setup: (el: AlgoPlayer) => void): Promise<AlgoPlayer> {
  const el = document.createElement('algo-player');
  setup(el);
  document.body.append(el);
  await settle(el);
  return el;
}

async function settle(el: AlgoPlayer): Promise<void> {
  await el.updateComplete;
  await el.updateComplete;
}

const shadow = (el: AlgoPlayer) => el.shadowRoot!;
const text = (el: AlgoPlayer, selector: string) =>
  shadow(el).querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
const segments = (el: AlgoPlayer) => [
  ...shadow(el).querySelectorAll<HTMLElement>('.sections .section'),
];

afterEach(() => {
  document.body.replaceChildren();
});

describe('the frame attribute', () => {
  it.each([
    ['second-pass/swap', 4],
    ['swap#2', 4],
    ['compare', 1],
    ['-1', 5],
    ['0..2', 0],
    ['3', 3],
  ])('opens %j at frame %i', async (selector, frame) => {
    const el = await mount((e) => {
      e.setAttribute('frame', selector);
      e.visualization = doc;
    });
    expect(el.frame).toBe(frame);
    expect(el.getAttribute('frame')).toBe(String(frame));
  });

  it('opens a section at its first step', async () => {
    // Frame 2, the frame before the section's first step, still shows the
    // first pass, so the player opens one frame later.
    const el = await mount((e) => {
      e.setAttribute('frame', 'second-pass');
      e.visualization = doc;
    });
    expect(el.frame).toBe(3);
    expect(text(el, '.narration')).toBe('Compare 3 and 1.');
  });

  it('takes a selector after the document has loaded', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    el.setAttribute('frame', 'compare#2');
    await settle(el);
    expect(el.frame).toBe(3);
    el.frame = 'first-pass/swap';
    await settle(el);
    expect(el.frame).toBe(2);
    expect(text(el, '.narration')).toBe('Swap them.');
  });

  it('keeps the frame and says why when a selector matches nothing', async () => {
    const el = await mount((e) => {
      e.setAttribute('frame', 'swap');
      e.visualization = doc;
    });
    el.setAttribute('frame', 'relax#2');
    await settle(el);
    expect(el.frame).toBe(2);
    expect(text(el, '.narration')).toBe('Swap them.');
    const alert = text(el, '.frame-error');
    expect(alert).toContain('No step is named "relax"');
    expect(alert).toContain('Sections: first-pass, second-pass.');
    // The document is still shown, and a good selector clears the message.
    expect(shadow(el).querySelector('.body')?.hasAttribute('hidden')).toBe(
      false,
    );
    el.setAttribute('frame', 'settle');
    await settle(el);
    expect(el.frame).toBe(5);
    expect(shadow(el).querySelector('.frame-error')).toBeNull();
  });

  it('drops the message once the frame moves', async () => {
    const el = await mount((e) => {
      e.setAttribute('frame', 'nope');
      e.visualization = doc;
    });
    expect(shadow(el).querySelector('.frame-error')).not.toBeNull();
    el.next();
    await settle(el);
    expect(shadow(el).querySelector('.frame-error')).toBeNull();
  });
});

describe('step names and sections for page scripts', () => {
  it('are properties of the player and of algo-frame events', async () => {
    const details: AlgoFrameDetail[] = [];
    const el = await mount((e) => {
      e.addEventListener('algo-frame', (event) => details.push(event.detail));
      e.visualization = doc;
    });
    expect(el.stepName).toBeUndefined();
    expect(el.section).toBeUndefined();
    el.seek(4);
    await settle(el);
    expect(el.stepName).toBe('swap');
    expect(el.section).toEqual({
      id: 'second-pass',
      title: 'Second pass',
      start: 2,
    });
    expect(details.at(-1)).toEqual({
      index: 4,
      length: 5,
      playing: false,
      stepName: 'swap',
      sectionId: 'second-pass',
    });
  });

  it('leave the event as it was for documents without names', async () => {
    const details: AlgoFrameDetail[] = [];
    const plain = {
      ...doc,
      version: '1.0',
      steps: doc.steps.map(({ actions }) => ({ actions })),
      sections: undefined,
    };
    const el = await mount((e) => {
      e.addEventListener('algo-frame', (event) => details.push(event.detail));
      e.visualization = plain;
    });
    el.next();
    await settle(el);
    expect(details.at(-1)).toEqual({ index: 1, length: 5, playing: false });
  });
});

describe('sections on the timeline', () => {
  it('shows each section with its title, over its frames', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    const shown = segments(el);
    expect(shown.map((s) => s.textContent?.trim())).toEqual([
      'First pass',
      'Second pass',
    ]);
    // From frame 0 to 2 and from 2 to 5, of frames 0 to 5.
    expect(shown.map((s) => [s.style.left, s.style.width])).toEqual([
      ['0%', '40%'],
      ['40%', '60%'],
    ]);
    expect(
      shadow(el).querySelector('.sections')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('moves the sections for a new document', async () => {
    // Placed through CSSOM, which a strict CSP allows; the share page's
    // E2E tests check that in a browser (ADR 0040).
    const el = await mount((e) => {
      e.visualization = doc;
    });
    el.visualization = { ...doc, sections: [doc.sections[0]] };
    await settle(el);
    expect(segments(el).map((s) => [s.style.left, s.style.width])).toEqual([
      ['0%', '100%'],
    ]);
  });

  it('marks the section of the current step', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    const current = () =>
      segments(el)
        .filter((s) => s.classList.contains('current'))
        .map((s) => s.textContent?.trim());
    expect(current()).toEqual([]);
    el.seek(2);
    await settle(el);
    expect(current()).toEqual(['First pass']);
    expect(text(el, '.section-title')).toBe('First pass');
    el.seek(3);
    await settle(el);
    expect(current()).toEqual(['Second pass']);
    expect(text(el, '.section-title')).toBe('Second pass');
    const slider = shadow(el).querySelector('input[type="range"]');
    expect(slider?.getAttribute('aria-valuetext')).toBe(
      'Frame 3 of 5, Second pass',
    );
  });

  it('jumps to a section’s first step when clicked', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    segments(el)[1]!.click();
    await settle(el);
    expect(el.frame).toBe(3);
  });

  it('moves between sections with Page Up and Page Down', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    const press = async (key: string) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await settle(el);
      return el.frame;
    };
    expect(await press('PageDown')).toBe(1);
    expect(await press('PageDown')).toBe(3);
    expect(await press('PageDown')).toBe(5);
    expect(await press('PageUp')).toBe(3);
    expect(await press('PageUp')).toBe(1);
    expect(await press('PageUp')).toBe(0);
  });

  it('jumps between sections from the slider, which keeps its other keys', async () => {
    const el = await mount((e) => {
      e.visualization = doc;
    });
    const slider = shadow(el).querySelector('input[type="range"]')!;
    const press = async (key: string) => {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      slider.dispatchEvent(event);
      await settle(el);
      return event.defaultPrevented;
    };
    expect(await press('PageDown')).toBe(true);
    expect(el.frame).toBe(1);
    expect(await press('ArrowRight')).toBe(false);
    expect(el.frame).toBe(1);
  });

  it('leaves a focused code panel its keys for scrolling', async () => {
    const el = await mount((e) => {
      e.visualization = { ...doc, source: { code: 'a\nb' } };
    });
    const code = shadow(el).querySelector('.code')!;
    expect(code.getAttribute('tabindex')).toBe('0');
    for (const key of ['ArrowRight', ' ', 'End', 'PageDown']) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      code.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    await settle(el);
    expect(el.frame).toBe(0);
  });

  it('is absent without sections, and in display mode', async () => {
    const plain = { ...doc, version: '1.0', sections: undefined };
    const steps = plain.steps.map(({ actions }) => ({ actions }));
    const el = await mount((e) => {
      e.visualization = { ...plain, steps };
    });
    expect(shadow(el).querySelector('.sections')).toBeNull();
    expect(
      shadow(el)
        .querySelector('input[type="range"]')
        ?.hasAttribute('aria-valuetext'),
    ).toBe(false);
    const display = await mount((e) => {
      e.mode = 'display';
      e.visualization = doc;
    });
    expect(shadow(display).querySelector('.sections')).toBeNull();
  });
});
