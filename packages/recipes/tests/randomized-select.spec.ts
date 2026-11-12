/**
 * Randomized select against independent references: the answer is the
 * i-th value of the sorted input, and the pivots match a separate
 * RANDOMIZED-SELECT written here with the same generator. Its comparisons
 * stay near linear where sorting a sorted input with plain quicksort
 * compares every pair.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { ordinal } from '../src/algorithms/searching/randomized-select.ts';
import { seededRandom } from '../src/random.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

/** The pivots RANDOMIZED-SELECT takes, and the answer. */
function reference(values: readonly number[], rank: number, seed: number) {
  const a = [...values];
  const random = seededRandom(seed);
  const pivots: number[] = [];
  let [p, r, i] = [0, a.length - 1, rank];
  while (p < r) {
    const k = random.int(p, r);
    [a[k], a[r]] = [a[r]!, a[k]!];
    const x = a[r]!;
    pivots.push(x);
    let s = p - 1;
    for (let j = p; j < r; j++)
      if (a[j]! <= x) {
        s += 1;
        [a[s], a[j]] = [a[j]!, a[s]!];
      }
    const q = s + 1;
    [a[q], a[r]] = [a[r]!, a[q]!];
    const size = q - p + 1;
    if (i === size) return { pivots, answer: x };
    if (i < size) r = q - 1;
    else [p, i] = [q + 1, i - size];
  }
  return { pivots, answer: a[p]! };
}

const steps = (doc: VisualizationInput, id: string) =>
  doc.steps.filter((s) => s.meta?.id === id);

function check(
  doc: VisualizationInput,
  values: readonly number[],
  rank: number,
  seed: number,
) {
  const expected = [...values].sort((x, y) => x - y)[rank - 1]!;
  const ref = reference(values, rank, seed);
  expect(ref.answer).toBe(expected);
  expect(steps(doc, 'pivot').map((s) => s.meta?.vars?.['x'])).toEqual(
    ref.pivots,
  );
  const last = doc.steps.at(-1)!;
  expect(['found', 'single']).toContain(last.meta?.id);
  expect(last.meta?.narration).toContain(`the ${ordinal(rank)} smallest.`);
  const trace = replay(doc);
  const a = stateOf(trace, 'a', 'array', doc.steps.length);
  const at = a.marks.pointers['answer']!;
  expect(a.data[at]!.value).toBe(expected);
  expect(a.marks.settled).toContain(a.data[at]!.id);
  expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
}

const run = (values: readonly number[], i: number, seed: number) =>
  runOk('randomized-select', { values, i, seed }).document;

describe('randomized-select', () => {
  it('finds the 3rd smallest of the example, turning right then left', () => {
    const doc = runOk('randomized-select', undefined).document;
    check(doc, [5, 3, 8, 1, 9, 2, 7], 3, 2);
    expect(steps(doc, 'rank')).toHaveLength(2);
  });

  it('finds the lower median by default, with seed 1', () => {
    const doc = runOk('randomized-select', '4 8 1 6').document;
    check(doc, [4, 8, 1, 6], 2, 1);
  });

  it('names ranks as ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
    ]);
  });

  it('matches an independent RANDOMIZED-SELECT on random inputs', () => {
    fc.assert(
      fc.property(inputs, ({ values, i, seed }) =>
        check(run(values, i, seed), values, i, seed),
      ),
      fuzz,
    );
  });

  it('compares far fewer pairs than sorting, on average', () => {
    const sorted = Array.from({ length: 24 }, (_, k) => k);
    let total = 0;
    for (let seed = 0; seed < 100; seed++)
      total += steps(run(sorted, 12, seed), 'compare').length;
    // CLRS 9.2 bounds the expectation by 4n; for the median it is about 3.4n.
    expect(total / 100).toBeLessThan(4 * 24);
  });

  it('takes i from 1 to n', () => {
    expect(runError('randomized-select', { values: [1, 2], i: 3 }).path).toBe(
      '$.input.i',
    );
    expect(runError('randomized-select', { values: [1, 2], i: 0 }).path).toBe(
      '$.input.i',
    );
  });
});

const inputs = fc
  .array(fc.integer({ min: -20, max: 20 }), { minLength: 1, maxLength: 24 })
  .chain((values) =>
    fc.record({
      values: fc.constant(values),
      i: fc.integer({ min: 1, max: values.length }),
      seed: fc.nat(),
    }),
  );

recipe(
  'randomized-select',
  inputs,
  ({ values, i, seed }) => run(values, i, seed),
  (trace, { values, i, seed }) => check(trace.visualization, values, i, seed),
);
