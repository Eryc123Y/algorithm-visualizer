import fc from 'fast-check';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Trace } from '@algoviz/core';

import {
  createTheme,
  exportFigures,
  lightTheme,
  renderSeries,
  renderSvg,
  type Figure,
} from '../src/index.ts';

// Two passes of a sort, as sections with named, narrated steps.
//            frame: 0   1                2              3                4
// selector:         0   pass-1/compare   pass-1/swap    pass-2/compare   pass-2/swap
const doc = {
  version: '0.2',
  title: 'Two passes',
  structures: { a: { kind: 'array', initial: [3, 1, 2] } },
  sections: [
    { id: 'pass-1', title: 'Pass 1', start: 0 },
    { id: 'pass-2', title: 'Pass 2', start: 2 },
  ],
  steps: [
    {
      actions: [{ target: 'a', type: 'compare', i: 0, j: 1 }],
      meta: { id: 'compare', narration: 'Compare 3 and 1.' },
    },
    {
      actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }],
      meta: { id: 'swap', narration: 'Swap them, since 1 < 3.' },
    },
    {
      actions: [{ target: 'a', type: 'compare', i: 1, j: 2 }],
      meta: { id: 'compare', narration: 'Compare 3 and 2.' },
    },
    {
      actions: [{ target: 'a', type: 'swap', i: 1, j: 2 }],
      meta: { id: 'swap', narration: 'Swap <them> & stop.' },
    },
  ],
};

function figuresOf(
  input: unknown,
  options?: Parameters<typeof exportFigures>[1],
): readonly Figure[] {
  const result = exportFigures(input, options);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.figures;
}

function traceOf(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function parse(svg: string): Document {
  const window = new Window();
  return new window.DOMParser().parseFromString(
    svg,
    'image/svg+xml',
  ) as unknown as Document;
}

describe('exportFigures', () => {
  it('exports every frame without steps, each with its selector', () => {
    const result = exportFigures(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frames).toBe(5);
    expect(
      result.value.figures.map(({ frame, selector }) => [frame, selector]),
    ).toEqual([
      [0, '0'],
      [1, 'pass-1/compare'],
      [2, 'pass-1/swap'],
      [3, 'pass-2/compare'],
      [4, 'pass-2/swap'],
    ]);
  });

  it('exports the frames that ADR 0020 selectors name, in timeline order', () => {
    const frames = (...steps: (string | number)[]) =>
      figuresOf(doc, { steps }).map((f) => f.frame);
    expect(frames('pass-2')).toEqual([2, 3, 4]);
    expect(frames('swap#2', 'compare')).toEqual([1, 4]);
    expect(frames(-1, '0..1', 1)).toEqual([0, 1, 4]);
  });

  it('gives every figure of a document the same size', () => {
    const figures = figuresOf(doc);
    const scene = layoutTrace(traceOf(doc), {
      fonts: lightTheme.fontMetrics,
    }).sceneAt(0);
    for (const f of figures) {
      expect([f.width, f.height]).toEqual([scene.width, scene.height]);
      expect(f.svg).toContain(
        `width="${scene.width}" height="${scene.height}"`,
      );
    }
  });

  it('draws a frame the same whatever is exported with it', () => {
    const all = figuresOf(doc);
    const alone = figuresOf(doc, { steps: ['compare#2'] });
    expect(alone).toEqual([all[3]]);
  });

  it('draws text as outlines, without animation keys', () => {
    const [figure] = figuresOf(doc, { steps: [1] });
    expect(figure!.svg).not.toContain('<text');
    expect(figure!.svg).not.toContain('data-key');
    expect(figure!.svg).toContain('aria-label="3"');
  });

  it("describes each figure with its step's narration", () => {
    const figures = figuresOf(doc);
    const desc = (k: number) =>
      parse(figures[k]!.svg).querySelector('desc')?.textContent;
    expect(desc(0)).toBeUndefined();
    expect(desc(1)).toBe('Compare 3 and 1.');
    expect(desc(4)).toBe('Swap <them> & stop.');
    expect(parse(figures[4]!.svg).querySelector('parsererror')).toBeNull();
  });

  it('takes a theme by name or as an object', () => {
    const light = figuresOf(doc, { steps: [1] })[0]!.svg;
    const dark = figuresOf(doc, { steps: [1], theme: 'dark' })[0]!.svg;
    const custom = figuresOf(doc, {
      steps: [1],
      theme: createTheme('light', { title: '#123456' }),
    })[0]!.svg;
    expect(dark).not.toBe(light);
    expect(custom).toContain('#123456');
    expect(light).not.toContain('#123456');
  });

  it('reports an unknown theme name, as other languages may pass one', () => {
    expect(exportFigures(doc, { theme: 'neon' as never })).toEqual({
      ok: false,
      error: [
        {
          code: 'UNKNOWN_THEME',
          path: '$.theme',
          message: 'No theme named "neon"',
          hint: 'Themes: light, dark, print.',
        },
      ],
    });
  });

  it("reports the document's errors", () => {
    const result = exportFigures({ version: '0.2', structures: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error[0]!.code).toBe('INVALID_SHAPE');
  });

  it('reports a selector that matches nothing, listing what there is', () => {
    const result = exportFigures(doc, { steps: ['compare', 'relax#3'] });
    expect(result).toMatchObject({
      ok: false,
      error: [
        {
          code: 'NO_MATCH',
          path: '$',
          message: 'No step is named "relax"',
          hint: 'Sections: pass-1, pass-2. Step names: compare, swap.',
        },
      ],
    });
    expect(exportFigures(doc, { steps: [9] })).toMatchObject({
      ok: false,
      error: [{ code: 'OUT_OF_RANGE' }],
    });
  });
});

describe('renderSeries', () => {
  it('puts every frame on the largest canvas of the trace', () => {
    // A trace whose first frame lacks a structure, so its scene is smaller.
    const two = traceOf({
      version: '0.1',
      structures: {
        a: { kind: 'array', initial: [1, 2] },
        b: { kind: 'stack', initial: [7] },
      },
      steps: [{ actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }] }],
    });
    const withoutB = Object.fromEntries(
      Object.entries(two.frame(0).state).filter(([name]) => name !== 'b'),
    );
    const uneven: Trace = {
      visualization: two.visualization,
      length: two.length,
      frame: (i) =>
        i === 0 ? { ...two.frame(0), state: withoutB } : two.frame(i),
    };
    const layout = layoutTrace(uneven, { fonts: lightTheme.fontMetrics });
    const small = layout.sceneAt(0);
    const large = layout.sceneAt(1);
    expect(small.height).toBeLessThan(large.height);

    const [first, second] = renderSeries(uneven, [0, 1]);
    expect([first!.width, first!.height]).toEqual([large.width, large.height]);
    expect([second!.width, second!.height]).toEqual([
      large.width,
      large.height,
    ]);
    expect(first!.svg).toContain(
      `viewBox="0 0 ${large.width} ${large.height}"`,
    );
    // Alone, the small frame still gets the large canvas.
    expect(renderSeries(uneven, [0])).toEqual([first]);
  });

  it('gives nothing for no frames', () => {
    expect(renderSeries(traceOf(doc), [])).toEqual([]);
  });

  it('throws on a frame outside the trace', () => {
    expect(() => renderSeries(traceOf(doc), [5])).toThrow(RangeError);
    expect(() => renderSeries(traceOf(doc), [-1])).toThrow(RangeError);
    expect(() => renderSeries(traceOf(doc), [1.5])).toThrow(RangeError);
  });
});

describe('renderSvg description', () => {
  const scene = layoutTrace(traceOf(doc)).sceneAt(1);

  it('is written as an escaped <desc> after the title', () => {
    const svg = renderSvg(scene, { description: 'a < b & "c"' });
    expect(svg).toContain(
      '<title>Two passes</title><desc>a &#60; b &#38; &#34;c&#34;</desc>',
    );
  });

  it('is left out when empty', () => {
    expect(renderSvg(scene, { description: '' })).not.toContain('<desc');
    expect(renderSvg(scene)).not.toContain('<desc');
  });
});

const params = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 60),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

describe('series of generated selections', () => {
  const all = figuresOf(doc);
  const selector = fc.oneof(
    fc.constantFrom('pass-1', 'pass-2', 'compare', 'swap#2', 'pass-2/swap'),
    fc.integer({ min: -5, max: 4 }),
  );

  it('are the matching figures of the whole document', () => {
    fc.assert(
      fc.property(fc.array(selector, { maxLength: 4 }), (steps) => {
        const figures = figuresOf(doc, { steps });
        for (const f of figures) expect(f).toEqual(all[f.frame]);
        const frames = figures.map((f) => f.frame);
        expect(frames).toEqual([...new Set(frames)].toSorted((a, b) => a - b));
      }),
      params,
    );
  });
});
