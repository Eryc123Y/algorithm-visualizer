/**
 * The dynamic-programming modules against independent references:
 * recursive LCS length and Levenshtein distance, and every subset of the
 * knapsack items. `properties.spec.ts` runs them on random inputs.
 */
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { replay, runError, runOk, stateOf } from './helpers.ts';

const doc = (id: string, input: object): VisualizationInput =>
  runOk(id, input).document;
const ids = (d: VisualizationInput) => d.steps.map((s) => s.meta?.id);

/** LCS length over characters (code points). */
function lcsLength(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  return a[0] === b[0]
    ? 1 + lcsLength(a.slice(1), b.slice(1))
    : Math.max(lcsLength(a.slice(1), b), lcsLength(a, b.slice(1)));
}

function levenshtein(a: string, b: string): number {
  if (a === '') return b.length;
  if (b === '') return a.length;
  return Math.min(
    levenshtein(a.slice(1), b) + 1,
    levenshtein(a, b.slice(1)) + 1,
    levenshtein(a.slice(1), b.slice(1)) + (a[0] === b[0] ? 0 : 1),
  );
}

describe('lcs', () => {
  it.each([
    ['ABCBDAB', 'BDCABA'],
    ['abc', 'abc'],
    ['abc', 'xyz'],
    ['a', 'ab'],
    ['a🙂b', '🙂b'],
  ])('%s and %s', (first, second) => {
    const d = doc('lcs', { first, second });
    const table = stateOf(replay(d), 'c', 'table');
    const [x, y] = [[...first], [...second]];
    const length = lcsLength(x, y);
    expect(table.data[x.length]![y.length]).toBe(length);
    // The settled cells are matches that spell a common subsequence.
    const cells = [...table.marks.settled].sort((p, q) => p[0] - q[0]);
    expect(cells).toHaveLength(length);
    for (const [i, j] of cells) expect(x[i - 1]).toBe(y[j - 1]);
    // One step per cell, the length, then the traceback.
    expect(d.steps).toHaveLength(x.length * y.length + 2);
    expect(ids(d).slice(-2)).toEqual(['done', 'trace']);
  });

  it('names the subsequence it traces back', () => {
    const d = doc('lcs', { first: 'ABCBDAB', second: 'BDCABA' });
    expect(d.steps.at(-1)!.meta!.narration).toContain('"BCBA"');
  });
});

describe('edit-distance', () => {
  it.each([
    ['kitten', 'sitting'],
    ['sunday', 'saturday'],
    ['abc', 'a'],
    ['same', 'same'],
  ])('%s → %s', (first, second) => {
    const table = stateOf(
      replay(doc('edit-distance', { first, second })),
      'D',
      'table',
    );
    expect(table.data[first.length]![second.length]).toBe(
      levenshtein(first, second),
    );
    // The path runs from the corner back to the start.
    expect(table.marks.settled[0]).toEqual([first.length, second.length]);
    expect(table.marks.settled.at(-1)).toEqual([0, 0]);
  });
});

describe('knapsack', () => {
  const items = [
    { weight: 1, value: 1 },
    { weight: 3, value: 4 },
    { weight: 4, value: 5 },
    { weight: 5, value: 7 },
  ];
  it.each([0, 4, 7, 9, 13])('capacity %i', (capacity) => {
    let best = 0;
    for (let mask = 0; mask < 1 << items.length; mask++) {
      const chosen = items.filter((_, k) => mask & (1 << k));
      if (chosen.reduce((w, i) => w + i.weight, 0) <= capacity)
        best = Math.max(
          best,
          chosen.reduce((v, i) => v + i.value, 0),
        );
    }
    const d = doc('knapsack', { items, capacity });
    const table = stateOf(replay(d), 'K', 'table');
    expect(table.data[items.length]![capacity]).toBe(best);
    const taken = table.marks.settled.map(([i]) => items[i - 1]!);
    expect(taken.reduce((v, i) => v + i.value, 0)).toBe(best);
    expect(taken.reduce((w, i) => w + i.weight, 0)).toBeLessThanOrEqual(
      capacity,
    );
    // An item that does not fit is skipped; one that fits is weighed.
    const skips = items.reduce(
      (n, { weight }) => n + Math.min(weight, capacity + 1),
      0,
    );
    expect(ids(d).filter((x) => x === 'skip')).toHaveLength(skips);
  });

  it('never takes an item that does not raise the value', () => {
    const run = (values: number[], capacity: number) =>
      stateOf(
        replay(
          doc('knapsack', {
            items: values.map((value) => ({ weight: 1, value })),
            capacity,
          }),
        ),
        'K',
        'table',
      ).marks.settled.map(([i]) => i);
    expect(run([-3, 5, 0], 3)).toEqual([2]);
    expect(run([4, 4], 1)).toEqual([1]);
    expect(run([7], 0)).toEqual([]);
  });

  it('takes 1 to 8 items of positive integer weight and a capacity of 0 to 40', () => {
    for (const [input, path] of [
      [{ items: [], capacity: 1 }, '$.input.items'],
      [
        { items: [{ weight: 0, value: 1 }], capacity: 1 },
        '$.input.items[0].weight',
      ],
      [
        { items: [{ weight: 1.5, value: 1 }], capacity: 1 },
        '$.input.items[0].weight',
      ],
      [{ items: [{ weight: 1, value: 1 }], capacity: 41 }, '$.input.capacity'],
      [
        { items: [{ weight: 1, value: 1e308 }], capacity: 1 },
        '$.input.items[0].value',
      ],
    ] as const)
      expect(runError('knapsack', input).path).toBe(path);
  });
});

describe('string inputs', () => {
  it('take 1 to 16 characters each', () => {
    for (const id of ['lcs', 'edit-distance'])
      for (const [input, path] of [
        [{ first: '', second: 'a' }, '$.input.first'],
        [{ first: 'a', second: 'x'.repeat(17) }, '$.input.second'],
      ] as const)
        expect(runError(id, input).path).toBe(path);
  });
});
