/**
 * Randomized quicksort, as in CLRS: RANDOMIZED-PARTITION first swaps a
 * value drawn uniformly from a[p..r] into a[r], then partitions around it
 * as PARTITION does. No input makes it slow every time: its expected
 * running time is O(n lg n) on every input. The seed in the input fixes
 * the draws, so a run can be shown again.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { seedField, seededRandom } from '../../random.ts';
import { SAMPLE, SortInput } from './input.ts';
import { recordQuicksort } from './quicksort.ts';

export const randomizedQuicksort = defineAlgorithm({
  id: 'randomized-quicksort',
  title: 'Randomized quicksort',
  topic: 'sorting',
  summary:
    'Quicksort with a pivot drawn uniformly from each part, so that its expected time is O(n lg n) on every input.',
  input: SortInput.extend({ seed: seedField }),
  main: 'values',
  examples: [
    // Seed 7 draws the median, 5, as the first pivot.
    { ...SAMPLE, seed: 7 },
    // Sorted input, PARTITION's worst case, splits evenly with seed 6.
    { values: [1, 2, 3, 4, 5, 6, 7, 8], seed: 6 },
  ],
  code: {
    pseudocode: `
      RANDOMIZED-QUICKSORT(a, p, r)
          if p < r  // @single
              q = RANDOMIZED-PARTITION(a, p, r)
              RANDOMIZED-QUICKSORT(a, p, q - 1)
              RANDOMIZED-QUICKSORT(a, q + 1, r)

      RANDOMIZED-PARTITION(a, p, r)
          k = RANDOM(p, r)
          exchange a[r] with a[k]  // @random
          return PARTITION(a, p, r)

      PARTITION(a, p, r)
          x = a[r]  // @pivot
          i = p - 1
          for j = p to r - 1
              if a[j] ≤ x  // @compare
                  i = i + 1
                  exchange a[i] with a[j]  // @swap
          exchange a[i + 1] with a[r]  // @place
          return i + 1
    `,
    python: `
      import random

      def randomized_quicksort(a, p, r):
          if p < r:  # @single
              q = randomized_partition(a, p, r)
              randomized_quicksort(a, p, q - 1)
              randomized_quicksort(a, q + 1, r)

      def randomized_partition(a, p, r):
          k = random.randint(p, r)
          a[r], a[k] = a[k], a[r]  # @random
          return partition(a, p, r)

      def partition(a, p, r):
          x = a[r]  # @pivot
          i = p - 1
          for j in range(p, r):
              if a[j] <= x:  # @compare
                  i += 1
                  a[i], a[j] = a[j], a[i]  # @swap
          a[i + 1], a[r] = a[r], a[i + 1]  # @place
          return i + 1
    `,
  },
  run: ({ values, seed }, trace) =>
    recordQuicksort(values, trace, seededRandom(seed)),
});
