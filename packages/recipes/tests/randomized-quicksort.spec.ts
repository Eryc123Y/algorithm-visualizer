/**
 * Randomized quicksort against independent references: the sorted order,
 * and the pivots of a separate randomized quicksort written here with the
 * same generator. On sorted input, where plain quicksort compares every
 * pair, the randomized one averages about 2n ln n comparisons.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';
import type { VisualizationInput } from '@algoviz/spec';

import { seededRandom } from '../src/random.ts';
import { fuzz, replay, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

/** The pivots, in the order the partitions take them. */
function pivotsOf(values: readonly number[], seed: number): number[] {
  const a = [...values];
  const random = seededRandom(seed);
  const pivots: number[] = [];
  const sort = (p: number, r: number): void => {
    if (p >= r) return;
    const k = random.int(p, r);
    [a[k], a[r]] = [a[r]!, a[k]!];
    const x = a[r];
    pivots.push(x);
    let i = p - 1;
    for (let j = p; j < r; j++)
      if (a[j]! <= x) {
        i += 1;
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
    [a[i + 1], a[r]] = [a[r], a[i + 1]!];
    sort(p, i);
    sort(i + 2, r);
  };
  sort(0, a.length - 1);
  return pivots;
}

const steps = (doc: VisualizationInput, id: string) =>
  doc.steps.filter((s) => s.meta?.id === id);

function check(
  doc: VisualizationInput,
  values: readonly number[],
  seed: number,
): void {
  const trace: Trace = replay(doc);
  const a = stateOf(trace, 'a', 'array');
  expect(a.data.map((e) => e.value)).toEqual([...values].sort((x, y) => x - y));
  expect(a.marks.settled).toHaveLength(values.length);
  expect(steps(doc, 'pivot').map((s) => s.meta?.vars?.['x'])).toEqual(
    pivotsOf(values, seed),
  );
  expect(steps(doc, 'random')).toHaveLength(steps(doc, 'pivot').length);
  expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
}

const run = (values: readonly number[], seed: number) =>
  runOk('randomized-quicksort', { values, seed }).document;

describe('randomized-quicksort', () => {
  it('sorts the examples, drawing each pivot before it partitions', () => {
    check(
      runOk('randomized-quicksort', undefined).document,
      [5, 3, 8, 1, 9, 2, 7],
      7,
    );
    check(run([1, 2, 3, 4, 5, 6, 7, 8], 6), [1, 2, 3, 4, 5, 6, 7, 8], 6);
  });

  it('gives the same document for the same seed, and runs the values alone with seed 1', () => {
    expect(run([4, 2, 7, 1], 9)).toEqual(run([4, 2, 7, 1], 9));
    expect(runOk('randomized-quicksort', '4 2 7 1').document).toEqual(
      run([4, 2, 7, 1], 1),
    );
  });

  it('matches an independent randomized quicksort on random inputs', () => {
    fc.assert(
      fc.property(inputs, ({ values, seed }) =>
        check(run(values, seed), values, seed),
      ),
      fuzz,
    );
  });

  it('averages far fewer comparisons than plain quicksort on sorted input', () => {
    const sorted = Array.from({ length: 24 }, (_, k) => k);
    const plain = steps(
      runOk('quicksort', { values: sorted }).document,
      'compare',
    );
    expect(plain).toHaveLength((24 * 23) / 2);
    let total = 0;
    for (let seed = 0; seed < 100; seed++)
      total += steps(run(sorted, seed), 'compare').length;
    // About 2n ln n - 2.85n, or 84 for n = 24 (CLRS 7.4).
    expect(total / 100).toBeLessThan(130);
  });
});

const inputs = fc.record({
  values: fc.array(fc.integer({ min: -20, max: 20 }), {
    minLength: 1,
    maxLength: 24,
  }),
  seed: fc.nat(),
});

recipe(
  'randomized-quicksort',
  inputs,
  ({ values, seed }) => run(values, seed),
  (trace, { values, seed }) => check(trace.visualization, values, seed),
);
