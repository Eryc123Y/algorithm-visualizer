import { describe, expect, it } from 'vitest';

import { prepareFigures } from '@algoviz/svg';

import {
  exportTikzFigures,
  prepareTikzFigures,
  type TikzFigure,
} from '../src/index.ts';

// Two passes of a sort, as in the SVG painter's series tests.
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
      actions: [{ target: 'a', type: 'insert', index: 3, element: 9 }],
      meta: { id: 'grow', narration: 'A wider array, so a larger canvas.' },
    },
  ],
};

function figures(steps?: (string | number)[]): readonly TikzFigure[] {
  const result = exportTikzFigures(doc, steps === undefined ? {} : { steps });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.figures;
}

describe('exportTikzFigures', () => {
  it('exports every frame, each with its selector and narration', () => {
    const all = figures();
    expect(all.map((f) => [f.frame, f.selector, f.narration])).toEqual([
      [0, '0', undefined],
      [1, 'pass-1/compare', 'Compare 3 and 1.'],
      [2, 'pass-1/swap', 'Swap them, since 1 < 3.'],
      [3, 'pass-2/compare', 'Compare 3 and 2.'],
      [4, 'pass-2/grow', 'A wider array, so a larger canvas.'],
    ]);
    expect(all[2]!.tikz).toContain(
      '% Frame 2, pass-1/swap.\n% Swap them, since 1 < 3.\n',
    );
  });

  it('puts every figure on the canvas of the SVG figures', () => {
    const svg = prepareFigures(doc);
    if (!svg.ok) throw new Error('svg');
    const sizes = svg.value.figures();
    if (!sizes.ok) throw new Error('sizes');
    const all = figures();
    expect(all.map((f) => [f.width, f.height])).toEqual(
      sizes.value.map((f) => [f.width, f.height]),
    );
    // The last frame is the widest, and frame 0 shares its canvas.
    const head = /\\algoviz@figure\{2\}\{([\d.]+)\}\{([\d.]+)\}/;
    expect(head.exec(all[0]!.tikz)!.slice(1)).toEqual(
      head.exec(all[4]!.tikz)!.slice(1),
    );
  });

  it('draws a frame the same whatever is exported with it', () => {
    const all = figures();
    expect(figures(['pass-1/swap'])).toEqual([all[2]]);
    expect(figures(['pass-2', 0])).toEqual([all[0], all[2], all[3], all[4]]);
  });

  it('reports the theme, the document and the selector', () => {
    expect(exportTikzFigures(doc, { theme: 'neon' as never })).toMatchObject({
      ok: false,
      error: [{ code: 'UNKNOWN_THEME', path: '$.theme' }],
    });
    expect(exportTikzFigures({ version: '0.2', structures: {} }).ok).toBe(
      false,
    );
    expect(exportTikzFigures(doc, { steps: ['relax'] })).toMatchObject({
      ok: false,
      error: [{ code: 'NO_MATCH', path: '$' }],
    });
  });
});

describe('prepareTikzFigures', () => {
  it('draws one frame for a selector of one frame', () => {
    const prepared = prepareTikzFigures(doc, { theme: 'print' });
    if (!prepared.ok) throw new Error('prepared');
    expect(prepared.value.frames).toBe(5);
    expect(prepared.value.figure(-1)).toMatchObject({
      ok: true,
      value: { frame: 4, selector: 'pass-2/grow' },
    });
    expect(prepared.value.figure('pass-2')).toMatchObject({
      ok: false,
      error: [{ code: 'INVALID_SELECTOR' }],
    });
    const printed = prepared.value.figure(1);
    const light = prepareTikzFigures(doc);
    if (!printed.ok || !light.ok) throw new Error('figures');
    const lit = light.value.figure(1);
    expect(lit.ok && lit.value.tikz).not.toBe(printed.value.tikz);
  });
});
