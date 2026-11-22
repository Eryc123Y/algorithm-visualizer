/**
 * Property tests of the recipes (recipe-properties.ts): Dynamic programming.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/dynamic-programming.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { runError, runOk, stateOf } from '../helpers.ts';
import { recipe, runs, TIMEOUT } from '../recipe-properties.ts';
import {
  smallInt,
  lcsLength,
  levenshtein,
  stringPairs,
  knapsackInput,
  bestValue,
} from './shared.ts';

recipe(
  'lcs',
  stringPairs,
  ([first, second], locale) => runOk('lcs', { first, second }, locale).document,
  (trace, [first, second]) => {
    const [a, b] = [[...first], [...second]];
    const table = stateOf(trace, 'c', 'table');
    const length = lcsLength(a, b);
    expect(table.data[a.length]![b.length]).toBe(length);
    // Settled cells are matches, strictly increasing in both strings.
    const cells = [...table.marks.settled].sort((x, y) => x[0] - y[0]);
    expect(cells).toHaveLength(length);
    cells.forEach(([i, j], k) => {
      expect(a[i - 1]).toBe(b[j - 1]);
      if (k > 0) {
        expect(i).toBeGreaterThan(cells[k - 1]![0]);
        expect(j).toBeGreaterThan(cells[k - 1]![1]);
      }
    });
  },
);

recipe(
  'edit-distance',
  stringPairs,
  ([first, second], locale) =>
    runOk('edit-distance', { first, second }, locale).document,
  (trace, [first, second]) => {
    const [a, b] = [[...first], [...second]];
    const table = stateOf(trace, 'D', 'table');
    const D = table.data as readonly (readonly number[])[];
    expect(D[a.length]![b.length]).toBe(levenshtein(a, b));
    // The settled path walks from the corner to the origin, each move
    // accounting for the difference between the cells.
    const path = table.marks.settled;
    expect(path[0]).toEqual([a.length, b.length]);
    expect(path.at(-1)).toEqual([0, 0]);
    for (let k = 1; k < path.length; k++) {
      const [[i, j], [p, q]] = [path[k - 1]!, path[k]!];
      expect([
        [i - 1, j - 1],
        [i - 1, j],
        [i, j - 1],
      ]).toContainEqual([p, q]);
      const cost = p === i - 1 && q === j - 1 && a[p] === b[q] ? 0 : 1;
      expect(D[i]![j]).toBe(D[p]![q]! + cost);
    }
  },
);

recipe(
  'knapsack',
  knapsackInput,
  ([items, capacity], locale) =>
    runOk('knapsack', { items, capacity }, locale).document,
  (trace, [items, capacity]) => {
    const table = stateOf(trace, 'K', 'table');
    const best = bestValue(items, capacity);
    expect(table.data[items.length]![capacity]).toBe(best);
    const rows = table.marks.settled.map(([i]) => i);
    expect(new Set(rows).size).toBe(rows.length);
    const taken = rows.map((i) => items[i - 1]!);
    expect(taken.reduce((w, i) => w + i.weight, 0)).toBeLessThanOrEqual(
      capacity,
    );
    expect(taken.reduce((v, i) => v + i.value, 0)).toBe(best);
  },
);

describe('knapsack input checks', () => {
  const badCapacity = fc.oneof(
    fc.integer({ min: 41, max: 1000 }),
    fc.integer({ min: -1000, max: -1 }),
    fc.double({ min: 0, max: 40 }).filter((x) => !Number.isInteger(x)),
    fc.constantFrom(NaN, Infinity, -Infinity),
  );
  const badWeight = fc.oneof(
    fc.integer({ min: -100, max: 0 }),
    fc.double({ min: -10, max: 10 }).filter((x) => !Number.isInteger(x)),
    fc.constantFrom(NaN, Infinity, -Infinity),
  );
  it(
    'rejects a capacity that is not an integer from 0 to 40',
    () => {
      fc.assert(
        fc.property(knapsackInput, badCapacity, ([items], capacity) => {
          expect(runError('knapsack', { items, capacity })).toMatchObject({
            code: 'INVALID_SHAPE',
            path: '$.input.capacity',
          });
        }),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
  it(
    'rejects an item weight that is not a positive integer, at its index',
    () => {
      fc.assert(
        fc.property(
          knapsackInput.filter(([items]) => items.length < 8),
          badWeight,
          fc.nat(),
          smallInt,
          ([items, capacity], weight, at, value) => {
            const k = at % (items.length + 1);
            const bad = items.toSpliced(k, 0, { weight, value });
            expect(
              runError('knapsack', { items: bad, capacity }),
            ).toMatchObject({
              code: 'INVALID_SHAPE',
              path: `$.input.items[${k}].weight`,
            });
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});
