import { describe, expect, it } from 'vitest';

import {
  editDistance,
  knapsack,
  longestCommonSubsequence,
} from '../src/index.ts';
import { replay, stateOf } from './helpers.ts';

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

describe('longestCommonSubsequence', () => {
  it.each([
    ['ABCBDAB', 'BDCABA'],
    ['abc', 'abc'],
    ['abc', 'xyz'],
    ['', 'ab'],
    ['a🙂b', '🙂b'],
  ])('%s and %s', (a, b) => {
    const trace = replay(longestCommonSubsequence(a, b));
    const table = stateOf(trace, 'L', 'table');
    const [x, y] = [[...a], [...b]];
    expect(table.data[x.length]![y.length]).toBe(lcsLength(x, y));
    expect(table.marks.settled).toHaveLength(lcsLength(x, y));
  });
});

describe('editDistance', () => {
  it.each([
    ['kitten', 'sitting'],
    ['sunday', 'saturday'],
    ['abc', ''],
    ['same', 'same'],
  ])('%s → %s', (a, b) => {
    const table = stateOf(replay(editDistance(a, b)), 'D', 'table');
    expect(table.data[a.length]![b.length]).toBe(levenshtein(a, b));
    expect(table.marks.settled[0]).toEqual([a.length, b.length]);
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
    const table = stateOf(replay(knapsack(items, capacity)), 'K', 'table');
    expect(table.data[items.length]![capacity]).toBe(best);
    const taken = table.marks.settled.map(([i]) => items[i - 1]!);
    expect(taken.reduce((v, i) => v + i.value, 0)).toBe(best);
  });
});
