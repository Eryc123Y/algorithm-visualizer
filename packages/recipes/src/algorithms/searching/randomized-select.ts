/**
 * Randomized selection, as in CLRS: to find the i-th smallest value of
 * a[p..r], partition around a random pivot, which lands at position q, the
 * k-th smallest with k = q − p + 1; if i = k the pivot is the answer,
 * otherwise only the side that holds it is searched, for the i-th or the
 * (i − k)-th smallest. Its expected time is linear on every input.
 *
 * The partition steps are those of randomized quicksort; the call stack
 * beside the array names the rank each call looks for and where. The seed
 * in the input fixes the draws, so a run can be shown again.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { callStack } from '../../call-stack.ts';
import { seedField, seededRandom } from '../../random.ts';
import { SortInput } from '../sorting/input.ts';
import { partitioner } from '../sorting/partition.ts';

/** 1st, 2nd, 3rd, 4th, …, 11th, 12th, 13th, 21st. */
export const ordinal = (n: number): string => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/** The lower median's rank, the default i. */
export const lowerMedian = (n: number): number => Math.floor((n + 1) / 2);

export const SelectInput = SortInput.extend({
  i: z
    .int()
    .min(1)
    .optional()
    .describe(
      'The rank to find, from 1 for the smallest to n for the largest; the lower median by default.',
    ),
}).superRefine(({ values, i }, ctx) => {
  if (i !== undefined && i > values.length)
    ctx.addIssue({
      code: 'custom',
      path: ['i'],
      message: `i must be at most n = ${values.length}, the number of values, not ${i}`,
    });
});

const PARTITION_CODE = {
  pseudocode: `
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
};

export const randomizedSelect = defineAlgorithm({
  id: 'randomized-select',
  title: 'Randomized select',
  topic: 'searching',
  summary:
    'Finds the i-th smallest value by partitioning around a random pivot and searching only the side that holds it, in expected linear time.',
  input: SelectInput.extend({ seed: seedField }),
  main: 'values',
  examples: [
    { values: [5, 3, 8, 1, 9, 2, 7], i: 3, seed: 2 },
    { values: [12, 4, 30, 7, 19, 25, 1, 16, 9], i: 5, seed: 2 },
  ],
  code: {
    pseudocode: `
      RANDOMIZED-SELECT(a, p, r, i)
          if p == r
              return a[p]  // @single
          q = RANDOMIZED-PARTITION(a, p, r)
          k = q - p + 1
          if i == k  // @rank
              return a[q]  // @found
          elseif i < k
              return RANDOMIZED-SELECT(a, p, q - 1, i)
          else return RANDOMIZED-SELECT(a, q + 1, r, i - k)
${PARTITION_CODE.pseudocode}`,
    python: `
      import random

      def randomized_select(a, p, r, i):
          if p == r:
              return a[p]  # @single
          q = randomized_partition(a, p, r)
          k = q - p + 1
          if i == k:  # @rank
              return a[q]  # @found
          if i < k:
              return randomized_select(a, p, q - 1, i)
          return randomized_select(a, q + 1, r, i - k)
${PARTITION_CODE.python}`,
  },
  run({ values, i: rank, seed }, outer) {
    const a = [...values];
    const n = a.length;
    const arr = outer.add('a', { kind: 'array', initial: [...values] });
    const calls = callStack(outer);
    const { trace } = calls;
    const partition = partitioner(a, arr, calls, seededRandom(seed));
    const target = rank ?? lowerMedian(n);

    let [p, r, i] = [0, n - 1, target];
    for (;;) {
      const call = `${ordinal(i)} smallest of a[${p}..${r}]`;
      if (p === r) {
        trace.step(
          'single',
          `a[${p}] = ${a[p]} is the only value left: it is the answer, the ${ordinal(target)} smallest.`,
          { vars: { p, r, i } },
        );
        calls.push(`call-${p}-${r}`, call);
        arr.settle({ index: p }).pointer({ name: 'answer', index: p });
        break;
      }
      const q = partition(p, r, call);
      const k = q - p + 1;
      if (i === k) {
        trace.step(
          'found',
          `The pivot ${a[q]} is the ${ordinal(k)} smallest of a[${p}..${r}], the one wanted: it is the answer, the ${ordinal(target)} smallest.`,
          { vars: { p, r, i, k, q } },
        );
        arr.pointer({ name: 'answer', index: q });
        break;
      }
      const left = i < k;
      trace.step(
        'rank',
        left
          ? `The pivot ${a[q]} is the ${ordinal(k)} smallest of a[${p}..${r}], but the ${ordinal(i)} is wanted: it lies to the left, in a[${p}..${q - 1}].`
          : `The pivot ${a[q]} is the ${ordinal(k)} smallest of a[${p}..${r}], but the ${ordinal(i)} is wanted: it is the ${ordinal(i - k)} smallest of a[${q + 1}..${r}], to the right.`,
        { vars: { p, r, i, k, q } },
      );
      const [lo, hi] = left ? [p, q - 1] : [q + 1, r];
      arr.highlight({
        indices: Array.from({ length: hi - lo + 1 }, (_, t) => lo + t),
      });
      if (left) r = q - 1;
      else [p, i] = [q + 1, i - k];
    }
    calls.close();
  },
});
