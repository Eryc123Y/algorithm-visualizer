/**
 * Random permutation against independent checks: the drawn indices lie in
 * range, replaying their swaps on the input gives the final array, the
 * same seed gives the same document, and over many seeds every order of
 * three values comes out about equally often. The seeded generator is
 * tested on its own as well.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';

import { seededRandom } from '../src/random.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

const valuesOf = (trace: Trace, name: string) =>
  stateOf(trace, name, 'array').data.map((e) => e.value);

function check(trace: Trace, values: readonly number[]): void {
  const n = values.length;
  const draws = valuesOf(trace, 'draws') as number[];
  expect(draws).toHaveLength(n);
  const a = [...values];
  draws.forEach((j, i) => {
    expect(j).toBeGreaterThanOrEqual(i);
    expect(j).toBeLessThanOrEqual(n - 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  });
  expect(valuesOf(trace, 'a')).toEqual(a);
  const sorted = (xs: readonly unknown[]) =>
    [...xs].sort((x, y) => (x as number) - (y as number));
  expect(sorted(valuesOf(trace, 'a'))).toEqual(sorted(values));
  expect(stateOf(trace, 'a', 'array').marks.settled).toHaveLength(n);
}

const orderOf = (values: number[], seed: number) =>
  valuesOf(
    replay(runOk('random-permutation', { values, seed }).document),
    'a',
  ).join(',');

describe('seededRandom', () => {
  it('repeats its draws for a seed, and keeps them in range', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 20 }), (seed, span) => {
        const one = seededRandom(seed);
        const two = seededRandom(seed);
        for (let k = 0; k < 20; k++) {
          const x = one.int(3, 3 + span);
          expect(two.int(3, 3 + span)).toBe(x);
          expect(x).toBeGreaterThanOrEqual(3);
          expect(x).toBeLessThanOrEqual(3 + span);
        }
      }),
      fuzz,
    );
  });

  it('draws each of 6 values about equally often', () => {
    const random = seededRandom(42);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 60_000; k++) counts[random.int(0, 5)]! += 1;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
  });
});

describe('random-permutation', () => {
  it('shuffles the example, two steps per position', () => {
    const doc = runOk('random-permutation', undefined).document;
    check(replay(doc), [1, 2, 3, 4, 5, 6, 7]);
    expect(doc.steps).toHaveLength(2 * 7 + 1);
  });

  it('gives the same document for the same seed', () => {
    const input = { values: [3, 1, 4, 1, 5, 9, 2, 6], seed: 2026 };
    expect(runOk('random-permutation', input).document).toEqual(
      runOk('random-permutation', input).document,
    );
  });

  it('takes the values alone, with seed 1', () => {
    expect(runOk('random-permutation', '1 2 3 4 5 6 7').document).toEqual(
      runOk('random-permutation', undefined).document,
    );
  });

  it('gives each of the 6 orders of 3 values about equally often', () => {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 3_000; seed++) {
      const order = orderOf([1, 2, 3], seed);
      counts.set(order, (counts.get(order) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const c of counts.values()) expect(Math.abs(c - 500)).toBeLessThan(90);
  });

  it('replays its draws into the final order on random inputs', () => {
    fc.assert(
      fc.property(inputs, ({ values, seed }) => {
        check(
          replay(runOk('random-permutation', { values, seed }).document),
          values,
        );
      }),
      fuzz,
    );
  });

  it('takes a seed from 0 to 2^32 - 1', () => {
    for (const seed of [-1, 2 ** 32, 1.5])
      expect(
        runError('random-permutation', { values: [1, 2], seed }).path,
      ).toBe('$.input.seed');
  });
});

const inputs = fc.record({
  values: fc.array(fc.integer({ min: -50, max: 50 }), {
    minLength: 1,
    maxLength: 24,
  }),
  seed: fc.nat(),
});

recipe(
  'random-permutation',
  inputs,
  (input) => runOk('random-permutation', input).document,
  (trace, { values }) => check(trace, values),
);
