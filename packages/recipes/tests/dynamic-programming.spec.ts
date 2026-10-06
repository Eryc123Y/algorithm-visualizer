import { describe, expect, it } from 'vitest';

import {
  editDistance,
  hashChaining,
  knapsack,
  linearProbing,
  longestCommonSubsequence,
} from '../src/index.ts';
import { replay, stateOf } from './helpers.ts';

function lcsLength(a: string, b: string): number {
  if (a === '' || b === '') return 0;
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
  ])('%s and %s', (a, b) => {
    const trace = replay(longestCommonSubsequence(a, b));
    const table = stateOf(trace, 'L', 'table');
    expect(table.data[a.length]![b.length]).toBe(lcsLength(a, b));
    expect(table.marks.settled).toHaveLength(lcsLength(a, b));
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

describe('hashing', () => {
  it('chains keys by remainder and finds one', () => {
    const keys = [15, 11, 27, 8, 12, 4, 22];
    const trace = replay(hashChaining(keys, 7, 22));
    const t = stateOf(trace, 't', 'hashTable');
    t.data.forEach((chain, b) =>
      expect(chain.map((e) => e.value)).toEqual(
        keys.filter((k) => k % 7 === b),
      ),
    );
    expect(t.marks.settled).toEqual([`k${keys.indexOf(22)}`]);
  });
  it('probes linearly for a free slot', () => {
    const keys = [15, 11, 27, 8, 12];
    const trace = replay(linearProbing(keys, 7));
    const slots = Array<number | string>(7).fill('');
    for (const key of keys) {
      let i = key % 7;
      while (slots[i] !== '') i = (i + 1) % 7;
      slots[i] = key;
    }
    expect(stateOf(trace, 't', 'array').data.map((e) => e.value)).toEqual(
      slots,
    );
  });
});
