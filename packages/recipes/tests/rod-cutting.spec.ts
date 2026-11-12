/**
 * Rod cutting against an independent reference: the best revenue for each
 * length by trying every way to cut the rod (the 2^(j−1) compositions of
 * j), and the cuts the run ends with, which must sum to n and sell for
 * r[n].
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

/** The best revenue of a rod of length j, over every way to cut it. */
function bruteForce(prices: readonly number[], j: number): number {
  let best = 0;
  for (let mask = 0; mask < 2 ** (j - 1); mask++) {
    let revenue = 0;
    let piece = 1;
    for (let b = 0; b < j - 1; b++) {
      if (mask & (1 << b)) {
        revenue += prices[piece - 1]!;
        piece = 1;
      } else piece += 1;
    }
    revenue += prices[piece - 1]!;
    best = Math.max(best, revenue);
  }
  return best;
}

function check(doc: VisualizationInput, prices: readonly number[]): void {
  const n = prices.length;
  const table = stateOf(replay(doc), 'rod', 'table').data;
  const r = table[1]!;
  for (let j = 1; j <= n; j++) expect(r[j]).toBe(bruteForce(prices, j));
  const cuts = doc.steps.filter((s) => s.meta?.id === 'cut');
  const pieces = cuts.map((s) => {
    const left = s.meta!.vars!['n'] as number;
    return table[2]![left] as number;
  });
  expect(pieces.reduce((a, b) => a + b, 0)).toBe(n);
  expect(pieces.reduce((a, b) => a + prices[b - 1]!, 0)).toBe(r[n]);
  // s[j] is the first piece that reaches r[j], as CLRS's strict < keeps.
  for (let j = 1; j <= n; j++) {
    const first = prices.findIndex(
      (price, k) =>
        k < j &&
        price + (k + 1 === j ? 0 : bruteForce(prices, j - k - 1)) === r[j],
    );
    expect(table[2]![j]).toBe(first + 1);
  }
  expect(doc.steps.filter((s) => s.meta?.id === 'try')).toHaveLength(
    (n * (n + 1)) / 2,
  );
}

describe('rod-cutting', () => {
  it('fills CLRS’s table for the prices of lengths 1 to 8', () => {
    const doc = runOk('rod-cutting', undefined).document;
    check(doc, [1, 5, 8, 9, 10, 17, 17, 20]);
    const table = stateOf(replay(doc), 'rod', 'table').data;
    expect(table[1]).toEqual([0, 1, 5, 8, 10, 13, 17, 18, 22]);
    expect(table[2]!.slice(1)).toEqual([1, 2, 3, 2, 2, 6, 1, 2]);
  });

  it('matches every way of cutting on random prices', () => {
    fc.assert(
      fc.property(prices, (p) => check(runOk('rod-cutting', p).document, p)),
      fuzz,
    );
  });

  it('cuts a rod of length 1, and one whose prices are all 0', () => {
    check(runOk('rod-cutting', [7]).document, [7]);
    check(runOk('rod-cutting', [0, 0, 0]).document, [0, 0, 0]);
    check(runOk('rod-cutting', [0, 1e6]).document, [0, 1e6]);
  });

  it('takes 1 to 12 integer prices from 0 to 1e6', () => {
    expect(runError('rod-cutting', { prices: [1e6 + 1] }).path).toBe(
      '$.input.prices[0]',
    );
    expect(runError('rod-cutting', { prices: [1.5] }).path).toBe(
      '$.input.prices[0]',
    );
    expect(runError('rod-cutting', { prices: [] }).path).toBe('$.input.prices');
    expect(
      runError('rod-cutting', { prices: Array.from({ length: 13 }, () => 1) })
        .path,
    ).toBe('$.input.prices');
    expect(runError('rod-cutting', { prices: [1, -2] }).path).toBe(
      '$.input.prices[1]',
    );
  });
});

const prices = fc.oneof(
  fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 1, maxLength: 12 }),
  fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 8 }),
  fc.array(fc.integer({ min: 0, max: 1e6 }), { minLength: 1, maxLength: 6 }),
);

recipe(
  'rod-cutting',
  prices,
  (p) => runOk('rod-cutting', { prices: p }).document,
  (trace, p) => check(trace.visualization, p),
);
