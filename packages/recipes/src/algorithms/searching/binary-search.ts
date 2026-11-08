/**
 * Binary search (ADR 0023): keep the range a[lo..hi] that can still hold
 * the target, look at its middle value, and drop the half that cannot.
 * The values must be sorted, so an unsorted input is refused.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** Most values binary search takes, so every step stays readable. */
export const MAX_SEARCHED = 32;

/** Throws a RangeError naming the first pair of values out of order. */
function checkSorted(values: readonly number[]): void {
  const k = values.findIndex((x, i) => i > 0 && values[i - 1]! > x);
  if (k > 0)
    throw new RangeError(
      `The values must be sorted: ${values[k - 1]} at position ${k - 1} comes before ${values[k]}`,
    );
}

export const binarySearch = defineAlgorithm({
  id: 'binary-search',
  title: 'Binary search',
  topic: 'searching',
  summary:
    'Finds a value in a sorted array by looking at the middle of the range left and halving it.',
  input: z.strictObject({
    values: listField(
      z
        .array(z.number())
        .min(1)
        .max(MAX_SEARCHED)
        .describe('Sorted numbers, e.g. [1, 3, 4, 7, 9, 11, 15].'),
      'number',
    ),
    target: z.number().describe('The value to find.'),
  }),
  examples: [
    { values: [1, 3, 4, 7, 9, 11, 15], target: 9 },
    { values: [1, 3, 4, 7, 9, 11, 15], target: 6 },
  ],
  code: {
    pseudocode: `
      BINARY-SEARCH(a, n, x)
          lo = 0  // @start
          hi = n - 1
          while lo ≤ hi
              mid = ⌊(lo + hi) / 2⌋  // @mid
              if a[mid] == x
                  return mid  // @found
              elseif a[mid] < x
                  lo = mid + 1  // @right
              else hi = mid - 1  // @left
          return NIL  // @missing
    `,
    python: `
      def binary_search(a, x):
          lo, hi = 0, len(a) - 1  # @start
          while lo <= hi:
              mid = (lo + hi) // 2  # @mid
              if a[mid] == x:
                  return mid  # @found
              if a[mid] < x:
                  lo = mid + 1  # @right
              else:
                  hi = mid - 1  # @left
          return None  # @missing
    `,
  },
  run({ values, target }, trace) {
    checkSorted(values);
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    let lo = 0;
    let hi = values.length - 1;
    trace.step('start', `Search the whole array for ${target}.`, {
      vars: { lo, hi },
    });
    arr.pointer({ name: 'lo', index: lo }).pointer({ name: 'hi', index: hi });
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = values[mid]!;
      trace.step('mid', `Look in the middle: a[${mid}] = ${v}.`, {
        vars: { lo, hi, mid },
      });
      arr.pointer({ name: 'mid', index: mid }).highlight({ indices: [mid] });
      if (v === target) {
        trace.step('found', `Found ${target} at position ${mid}.`, {
          vars: { mid },
        });
        arr.settle({ index: mid });
        return;
      }
      if (v < target) {
        lo = mid + 1;
        trace.step('right', `${v} < ${target}: search right of ${mid}.`, {
          vars: { lo, hi },
        });
        arr.pointer({ name: 'lo', index: lo });
      } else {
        hi = mid - 1;
        trace.step('left', `${v} > ${target}: search left of ${mid}.`, {
          vars: { lo, hi },
        });
        arr.pointer({ name: 'hi', index: hi >= 0 ? hi : null });
      }
      arr.pointer({ name: 'mid', index: null });
    }
    trace.step('missing', `lo > hi: ${target} is not in the array.`);
  },
});
