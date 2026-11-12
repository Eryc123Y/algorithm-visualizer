/**
 * The suffix array against sorting the suffixes directly, and the LCP
 * array against comparing each suffix with the one before it character
 * by character. Prefix doubling takes at most ⌈lg n⌉ rounds.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** The starts of the suffixes in sorted order; no two suffixes are equal. */
const sorted = (t: string) =>
  [...t].map((_, i) => i).sort((x, y) => (t.slice(x) < t.slice(y) ? -1 : 1));

const common = (a: string, b: string) => {
  let h = 0;
  while (h < a.length && h < b.length && a[h] === b[h]) h++;
  return h;
};

const texts = fc.string({
  unit: fc.constantFrom('a', 'b', 'c', 'd', 'n', '1', 'Z'),
  minLength: 1,
  maxLength: 16,
});

describe('suffix-array', () => {
  it('sorts the suffixes of banana', () => {
    const { document, results } = runOk('suffix-array', { text: 'banana' });
    expect(results).toEqual([5, 3, 1, 0, 4, 2]);
    const rows = stateOf(replay(document), 'S', 'table').data;
    expect(rows.map((r) => r[4])).toEqual(['–', 1, 3, 0, 0, 2]);
  });

  it('agrees with sorting the suffixes, in at most ⌈lg n⌉ rounds', () => {
    fc.assert(
      fc.property(texts, (text) => {
        const n = text.length;
        const { document, results } = runOk('suffix-array', { text });
        const sa = sorted(text);
        expect(results).toEqual(sa);
        const rows = stateOf(replay(document), 'S', 'table').data;
        expect(rows.map((r) => r[0])).toEqual(sa);
        expect(rows.map((r) => r[1])).toEqual(sa.map((i) => text.slice(i)));
        rows.forEach((r, k) =>
          expect(r[4]).toBe(
            k === 0 ? '–' : common(text.slice(sa[k - 1]), text.slice(sa[k])),
          ),
        );
        const rounds = document.steps.filter(
          (s) => s.meta?.at === 'sort',
        ).length;
        expect(rounds).toBeLessThanOrEqual(Math.ceil(Math.log2(n)));
        for (const step of document.steps) {
          expect(step.actions.length).toBeLessThanOrEqual(100);
          expect(['start', 'pairs', 'sort', 'order', 'lcp', 'done']).toContain(
            step.meta?.at,
          );
        }
      }),
      fuzz,
    );
  });

  it('sorts a text whose characters all differ without a round', () => {
    const { document, results } = runOk('suffix-array', 'dcba');
    expect(results).toEqual([3, 2, 1, 0]);
    expect(document.steps.map((s) => s.meta?.at).slice(0, 2)).toEqual([
      'start',
      'order',
    ]);
    // The order step itself re-sorts the rows, with no pairs.
    expect(stateOf(replay(document), 'S', 'table').data).toEqual([
      [3, 'a', 1, '', '–'],
      [2, 'ba', 2, '', 0],
      [1, 'cba', 3, '', 0],
      [0, 'dcba', 4, '', 0],
    ]);
  });

  it('handles one character and the longest text, and refuses others', () => {
    expect(runOk('suffix-array', 'a').results).toEqual([0]);
    expect(runOk('suffix-array', 'aaaaaaaaaaaaaaaa').results).toEqual(
      Array.from({ length: 16 }, (_, k) => 15 - k),
    );
    expect(runError('suffix-array', 'a'.repeat(17)).message).toMatch(/16/);
    expect(runError('suffix-array', 'a b').message).toMatch(
      /letters and digits/,
    );
  });
});
