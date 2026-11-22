/**
 * Property tests of the recipes (recipe-properties.ts): Hashing.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/hashing.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { runAlgorithm } from '../../src/index.ts';
import { runOk, stateOf } from '../helpers.ts';
import { recipe, runs, TIMEOUT } from '../recipe-properties.ts';
import { smallInt, valuesOf, mod, hashRuns } from './shared.ts';

recipe(
  'hash-chaining',
  hashRuns(() => 24),
  (input, locale) => runOk('hash-chaining', input, locale).document,
  (trace, { from: { size, keys }, ops }) => {
    const chains: number[][] = Array.from({ length: size }, () => []);
    for (const k of keys) chains[mod(k, size)]!.unshift(k);
    for (const { op, key } of ops)
      if (op === 'insert') chains[mod(key, size)]!.unshift(key);
    const t = stateOf(trace, 't', 'hashTable');
    expect(t.data.map((chain) => chain.map((e) => e.value))).toEqual(chains);
  },
);

recipe(
  'linear-probing',
  hashRuns((size) => size),
  (input, locale) => runOk('linear-probing', input, locale).document,
  (trace, { from: { size, keys }, ops }) => {
    const slots = Array<number | string>(size).fill('');
    const insert = (key: number) => {
      let i = mod(key, size);
      while (slots[i] !== '') i = (i + 1) % size;
      slots[i] = key;
    };
    keys.forEach(insert);
    for (const { op, key } of ops) if (op === 'insert') insert(key);
    expect(valuesOf(trace, 't')).toEqual(slots);
  },
);

describe('hashing input checks', () => {
  const bad = fc.record({
    size: fc.oneof(
      fc.integer({ min: 17, max: 1000 }),
      fc.integer({ min: -10, max: 0 }),
      fc.double({ min: 1, max: 16 }).filter((x) => !Number.isInteger(x)),
      fc.integer({ min: 1, max: 16 }),
    ),
    keys: fc.array(
      fc.oneof(
        smallInt,
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.constantFrom(NaN, Infinity, 2 ** 60),
      ),
      { maxLength: 30 },
    ),
  });
  for (const id of ['hash-chaining', 'linear-probing'])
    it(
      `${id} reports a table it cannot hold, or runs`,
      () => {
        fc.assert(
          fc.property(bad, smallInt, (from, key) => {
            const run = runAlgorithm(`${id}.insert`, { from, key });
            if (!run.ok)
              expect(['INVALID_SHAPE', 'INVALID_ARGUMENT']).toContain(
                run.error[0]!.code,
              );
          }),
          { numRuns: runs },
        );
      },
      TIMEOUT,
    );
});
