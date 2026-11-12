/**
 * SELECT (median of medians) against independent references: the answer
 * is the i-th value of the sorted input, the pivots match a separate
 * median-of-medians SELECT written here, and, for distinct values, no
 * partition leaves more than 7n/10 + 6 values on the side searched next
 * (CLRS 9.3).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import { ordinal } from '../src/algorithms/searching/randomized-select.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

const ascending = (xs: readonly number[]) => [...xs].sort((x, y) => x - y);

/** The pivots SELECT takes, run in place on a copy of the values. */
function pivotsOf(values: readonly number[], rank: number): number[] {
  const a = [...values];
  const pivots: number[] = [];
  const sortPart = (lo: number, hi: number) => {
    const part = ascending(a.slice(lo, hi + 1));
    part.forEach((v, t) => (a[lo + t] = v));
  };
  let [p, r, i] = [0, a.length - 1, rank];
  while (r - p + 1 > 5) {
    const medians: { v: number; at: number }[] = [];
    for (let s = p; s <= r; s += 5) {
      const e = Math.min(s + 4, r);
      sortPart(s, e);
      const at = Math.floor((s + e) / 2);
      medians.push({ v: a[at]!, at });
    }
    const pick = [...medians].sort((x, y) => x.v - y.v)[
      Math.floor((medians.length + 1) / 2) - 1
    ]!;
    pivots.push(pick.v);
    [a[pick.at], a[r]] = [a[r]!, a[pick.at]!];
    // Lomuto's PARTITION.
    let t = p - 1;
    for (let j = p; j < r; j++)
      if (a[j]! <= pick.v) {
        t += 1;
        [a[t], a[j]] = [a[j]!, a[t]!];
      }
    const q = t + 1;
    [a[q], a[r]] = [a[r]!, a[q]!];
    const k = q - p + 1;
    if (i === k) return pivots;
    if (i < k) r = q - 1;
    else [p, i] = [q + 1, i - k];
  }
  return pivots;
}

const steps = (doc: VisualizationInput, id: string) =>
  doc.steps.filter((s) => s.meta?.id === id);

function check(
  doc: VisualizationInput,
  values: readonly number[],
  rank: number,
): void {
  const expected = ascending(values)[rank - 1]!;
  expect(steps(doc, 'pivot').map((s) => s.meta?.vars?.['x'])).toEqual(
    pivotsOf(values, rank),
  );
  const last = doc.steps.at(-1)!;
  expect(['found', 'small']).toContain(last.meta?.id);
  expect(last.meta?.narration).toContain(`the ${ordinal(rank)} smallest.`);
  const trace = replay(doc);
  const a = stateOf(trace, 'a', 'array');
  const at = a.marks.pointers['answer']!;
  expect(a.data[at]!.value).toBe(expected);
  expect(a.marks.settled).toContain(a.data[at]!.id);
  expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
  // With distinct values, each turn keeps at most 7n/10 + 6 of the n
  // values partitioned (CLRS assumes them distinct).
  if (new Set(values).size < values.length) return;
  for (const step of steps(doc, 'rank')) {
    const { p, r, q, i, k } = step.meta!.vars as Record<string, number>;
    const n = r! - p! + 1;
    const kept = i! < k! ? q! - p! : r! - q!;
    expect(kept).toBeLessThanOrEqual((7 * n) / 10 + 6);
  }
}

describe('select', () => {
  it('finds the 10th smallest of the example in two rounds', () => {
    const values = [12, 4, 30, 7, 19, 25, 1, 16, 9, 22, 3, 28, 14, 11, 6, 20];
    const doc = runOk('select', undefined).document;
    check(doc, values, 10);
    expect(steps(doc, 'pivot').map((s) => s.meta?.vars?.['x'])).toEqual([
      12, 16,
    ]);
    expect(doc.steps.every((s) => s.meta !== undefined)).toBe(true);
  });

  it('sorts five values or fewer directly', () => {
    const doc = runOk('select', { values: [9, 2, 7, 4], i: 2 }).document;
    check(doc, [9, 2, 7, 4], 2);
    expect(doc.steps).toHaveLength(1);
  });

  it('finds the lower median of sorted input by default', () => {
    const values = Array.from({ length: 25 }, (_, k) => k);
    check(runOk('select', { values }).document, values, 13);
  });

  it('matches an independent SELECT on random inputs', () => {
    fc.assert(
      fc.property(inputs, ({ values, i }) =>
        check(runOk('select', { values, i }).document, values, i),
      ),
      fuzz,
    );
  });

  it('takes 1 to 25 values and i from 1 to n', () => {
    expect(
      runError('select', { values: Array.from({ length: 26 }, () => 1) }).path,
    ).toBe('$.input.values');
    expect(runError('select', { values: [1, 2], i: 3 }).path).toBe('$.input.i');
  });
});

const inputs = fc
  .oneof(
    fc.uniqueArray(fc.integer({ min: -50, max: 50 }), {
      minLength: 1,
      maxLength: 25,
    }),
    fc.array(fc.integer({ min: -30, max: 30 }), {
      minLength: 1,
      maxLength: 25,
    }),
    fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 25 }),
    fc
      .array(fc.integer({ min: -30, max: 30 }), { minLength: 1, maxLength: 25 })
      .map(ascending),
  )
  .chain((values) =>
    fc.record({
      values: fc.constant(values),
      i: fc.integer({ min: 1, max: values.length }),
    }),
  );

recipe(
  'select',
  inputs,
  ({ values, i }) => runOk('select', { values, i }).document,
  (trace, { values, i }) => check(trace.visualization, values, i),
);
