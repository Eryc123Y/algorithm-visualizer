/**
 * Matrix-chain multiplication against an independent reference: the
 * fewest multiplications of every subchain by trying every
 * parenthesization recursively, without a table, and the order the run
 * reads back, whose cost must be m[1, n].
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

/** The first split of Aᵢ⋯Aⱼ that reaches the fewest multiplications. */
function firstBest(p: readonly number[], i: number, j: number): number {
  const best = cost(p, i, j);
  for (let k = i; k < j; k++)
    if (cost(p, i, k) + cost(p, k + 1, j) + p[i - 1]! * p[k]! * p[j]! === best)
      return k;
  throw new Error('no split reaches the best cost');
}

/** The fewest multiplications for Aᵢ⋯Aⱼ, trying every split. */
function cost(p: readonly number[], i: number, j: number): number {
  if (i === j) return 0;
  let best = Infinity;
  for (let k = i; k < j; k++)
    best = Math.min(
      best,
      cost(p, i, k) + cost(p, k + 1, j) + p[i - 1]! * p[k]! * p[j]!,
    );
  return best;
}

/** The multiplications a parenthesization such as ((A1A2)A3) costs. */
function costOf(order: string, p: readonly number[]): number {
  const stack: [number, number, number][] = [];
  let total = 0;
  for (const token of order.match(/A\d+|\(|\)/g)!) {
    if (token === '(') continue;
    if (token === ')') {
      const right = stack.pop()!;
      const left = stack.pop()!;
      total += left[0] * left[1] * right[1];
      stack.push([left[0], right[1], 0]);
    } else {
      const i = Number(token.slice(1));
      stack.push([p[i - 1]!, p[i]!, 0]);
    }
  }
  return total;
}

function check(doc: VisualizationInput, p: readonly number[]): void {
  const n = p.length - 1;
  const trace = replay(doc);
  const m = stateOf(trace, 'm', 'table').data;
  const s = stateOf(trace, 's', 'table').data;
  for (let i = 1; i <= n; i++)
    for (let j = i; j <= n; j++) {
      expect(m[i - 1]![j - 1]).toBe(cost(p, i, j));
      // Ties keep the first best split, as CLRS's strict < does.
      if (j > i) expect(s[i - 1]![j - 1]).toBe(firstBest(p, i, j));
    }
  const last = doc.steps.find((s) =>
    s.meta?.narration?.includes('Best order'),
  )!;
  const order = /Best order: (\S+),/.exec(last.meta!.narration!)![1]!;
  expect(costOf(order, p)).toBe(cost(p, 1, n));
  expect(doc.steps.filter((s) => s.meta?.id === 'try')).toHaveLength(
    (n * n * n - n) / 6,
  );
  expect(doc.steps.filter((s) => s.meta?.id === 'split')).toHaveLength(n - 1);
}

describe('matrix-chain', () => {
  it('finds CLRS’s order for six matrices, 15,125 multiplications', () => {
    const doc = runOk('matrix-chain', undefined).document;
    check(doc, [30, 35, 15, 5, 10, 20, 25]);
    expect(doc.steps.at(-5)!.meta!.narration).toContain(
      '((A1(A2A3))((A4A5)A6)), 15125',
    );
    const s = stateOf(replay(doc), 's', 'table').data;
    expect(s[0]![5]).toBe(3);
  });

  it('prefers the cheaper of the two orders of three matrices', () => {
    check(runOk('matrix-chain', '10 100 5 50').document, [10, 100, 5, 50]);
  });

  it('matches every parenthesization on random chains', () => {
    fc.assert(
      fc.property(dims, (p) => check(runOk('matrix-chain', p).document, p)),
      fuzz,
    );
  });

  it('takes 3 to 8 dimensions from 1 to 1000', () => {
    expect(runError('matrix-chain', { dims: [1, 2] }).path).toBe(
      '$.input.dims',
    );
    expect(
      runError('matrix-chain', { dims: Array.from({ length: 9 }, () => 2) })
        .path,
    ).toBe('$.input.dims');
    expect(runError('matrix-chain', { dims: [1, 0, 2] }).path).toBe(
      '$.input.dims[1]',
    );
  });
});

const dims = fc.oneof(
  fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 3, maxLength: 8 }),
  fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 3, maxLength: 8 }),
  fc.array(fc.integer({ min: 900, max: 1000 }), { minLength: 3, maxLength: 8 }),
);

recipe(
  'matrix-chain',
  dims,
  (p) => runOk('matrix-chain', { dims: p }).document,
  (trace, p) => check(trace.visualization, p),
);
