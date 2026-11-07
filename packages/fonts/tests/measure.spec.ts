import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { textWidth, uniformFont, type FontMetrics } from '../src/index.ts';

/** fast-check settings, deepened with FUZZ_RUNS and replayed with FUZZ_SEED. */
const fuzz = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 200),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

/** A monospace face covering ASCII, like JetBrains Mono. */
const mono: FontMetrics = {
  id: 'test-mono',
  family: 'Test Mono',
  weight: 600,
  unitsPerEm: 1000,
  advances: [
    [0x20, 0x7e, 600],
    [0x2764, 0x2764, 600],
  ],
};

/** A proportional face with a few letters. */
const sans: FontMetrics = {
  id: 'test-sans',
  family: 'Test Sans',
  weight: 600,
  unitsPerEm: 2048,
  advances: [
    [0x41, [1400, 1300, 1350]],
    [0x61, 0x63, 1100],
  ],
};

describe('textWidth', () => {
  it('sums advances from the table, in em', () => {
    expect(textWidth('', mono)).toBe(0);
    expect(textWidth('42', mono)).toBe(1.2);
    expect(textWidth('ABC', sans)).toBe((1400 + 1300 + 1350) / 2048);
    expect(textWidth('abc', sans)).toBe(3300 / 2048);
  });

  it('is exact for ASCII in a monospace face, as the old 0.6 estimate was', () => {
    for (let n = 0; n <= 40; n++)
      expect(textWidth('7'.repeat(n), mono) * 20).toBe(n * 12);
  });

  it('gives combining marks, joiners and variation selectors no width', () => {
    expect(textWidth('é', mono)).toBe(0.6);
    expect(textWidth('a​b', mono)).toBe(1.2);
    expect(textWidth('a­b', mono)).toBe(1.2);
    expect(textWidth('a︎', mono)).toBe(0.6);
  });

  it('measures East Asian wide and fullwidth glyphs at 1 em', () => {
    expect(textWidth('数组', mono)).toBe(2);
    expect(textWidth('あア', mono)).toBe(2);
    expect(textWidth('한', mono)).toBe(1);
    expect(textWidth('Ａ１', mono)).toBe(2);
    expect(textWidth('，', mono)).toBe(1);
    expect(textWidth('𠀀', mono)).toBe(1);
  });

  it('measures emoji at 1.25 em, joined sequences and flags once', () => {
    expect(textWidth('😀', mono)).toBe(1.25);
    expect(textWidth('👨‍👩‍👧', mono)).toBe(1.25);
    expect(textWidth('👍🏽', mono)).toBe(1.25);
    expect(textWidth('🇨🇳', mono)).toBe(1.25);
    expect(textWidth('🏳️‍🌈', mono)).toBe(1.25);
  });

  it('treats a glyph followed by the emoji selector as an emoji', () => {
    expect(textWidth('❤', mono)).toBe(0.6);
    expect(textWidth('❤️', mono)).toBe(1.25);
    expect(textWidth('1️⃣', mono)).toBe(1.25);
  });

  it('measures anything else at 1 em', () => {
    expect(textWidth('Ж', mono)).toBe(1);
    expect(textWidth('ก', mono)).toBe(1);
    expect(textWidth('x', sans)).toBe(1);
  });

  it('uses the default advance, if any, for everything the table lacks', () => {
    const font = uniformFont(0.6);
    expect(textWidth('42', font)).toBe(1.2);
    expect(textWidth('数', font)).toBe(0.6);
    expect(textWidth('😀', font)).toBe(0.6);
    expect(textWidth('é', font)).toBe(0.6);
  });

  it('is never negative and never wider than the widest rule allows', () => {
    const widest = (font: FontMetrics) =>
      Math.max(
        1.25,
        ...font.advances.flatMap((run) =>
          typeof run[1] === 'number'
            ? [run[2]! / font.unitsPerEm]
            : run[1].map((w) => w / font.unitsPerEm),
        ),
      );
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary', maxLength: 30 }),
        fc.constantFrom(mono, sans),
        (text, font) => {
          const width = textWidth(text, font);
          expect(width).toBeGreaterThanOrEqual(0);
          expect(width).toBeLessThanOrEqual(
            [...text].length * widest(font) + 1e-9,
          );
        },
      ),
      fuzz,
    );
  });
});

describe('uniformFont', () => {
  it('describes a face whose every glyph has one width', () => {
    expect(uniformFont(0.6)).toMatchObject({
      unitsPerEm: 1000,
      advances: [],
      defaultAdvance: 600,
    });
  });

  it('rejects widths that are not positive and finite', () => {
    expect(() => uniformFont(0)).toThrow(RangeError);
    expect(() => uniformFont(Number.NaN)).toThrow(RangeError);
  });
});
