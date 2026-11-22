/**
 * Property tests of the recipes (recipe-properties.ts): Sorting and searching, part 2.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/sorting-more.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { runError, runOk, stateOf } from '../helpers.ts';
import { recipe, runs, TIMEOUT } from '../recipe-properties.ts';
import {
  smallInt,
  valuesOf,
  sorted,
  checkSorted,
  comparisonSort,
  countable,
  searchInput,
} from './shared.ts';

for (const id of ['quicksort', 'bubble-sort', 'selection-sort'])
  comparisonSort(id);

recipe('counting-sort', countable, sorted('counting-sort'), (trace, input) => {
  checkSorted(trace, input, 'b');
  expect(valuesOf(trace, 'a')).toEqual(input);
  const count = valuesOf(trace, 'c');
  expect(count).toHaveLength(Math.max(...input) + 1);
  // After placing, c[v] is how many values are smaller than v.
  count.forEach((c, v) => expect(c).toBe(input.filter((x) => x < v).length));
});

describe('counting-sort input checks', () => {
  const bad = fc.oneof(
    fc.integer({ min: 100, max: 10_000 }),
    fc.integer({ min: -10_000, max: -1 }),
    fc.double({ min: 0, max: 99 }).filter((x) => !Number.isInteger(x)),
    fc.constantFrom(NaN, Infinity, -Infinity, 99.5, -0.5),
  );
  it(
    'rejects values outside the integers 0..99, at their index',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 6 }),
          bad,
          fc.nat(),
          (good, x, at) => {
            const k = at % (good.length + 1);
            const values = good.toSpliced(k, 0, x);
            expect(runError('counting-sort', { values })).toMatchObject({
              code: 'INVALID_SHAPE',
              path: `$.input.values[${k}]`,
            });
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});

recipe(
  'binary-search',
  searchInput,
  (input, locale) => runOk('binary-search', input, locale).document,
  (trace, { values, target }) => {
    const a = stateOf(trace, 'a', 'array');
    const settled = a.marks.settled;
    if (values.includes(target)) {
      expect(settled).toHaveLength(1);
      expect(a.data.find((e) => e.id === settled[0])?.value).toBe(target);
    } else expect(settled).toEqual([]);
    // The start, a look and a move per halving, and the outcome.
    expect(trace.length).toBeLessThanOrEqual(
      2 + 2 * Math.ceil(Math.log2(values.length + 1)),
    );
  },
);

describe('binary-search input checks', () => {
  it(
    'refuses values that are not sorted',
    () => {
      fc.assert(
        fc.property(
          fc
            .array(smallInt, { minLength: 2, maxLength: 32 })
            .filter((a) => a.some((x, i) => i > 0 && a[i - 1]! > x)),
          smallInt,
          (values, target) => {
            expect(runError('binary-search', { values, target })).toMatchObject(
              { code: 'INVALID_ARGUMENT', path: '$.input' },
            );
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});
