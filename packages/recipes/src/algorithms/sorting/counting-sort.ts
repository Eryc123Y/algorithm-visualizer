/**
 * Counting sort, as in CLRS: count each value in c, turn the counts into
 * running sums, so c[v] is how many values are at most v, then place each
 * value of a into the output b, from the last one to the first. Equal
 * values keep their order, which radix sort relies on.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { MAX_VALUES } from './input.ts';
import { listField } from '../../notation/schema.ts';

/** The largest value counting sort takes, so the count array stays small. */
export const MAX_COUNTED = 99;

export const countingSort = defineAlgorithm({
  id: 'counting-sort',
  title: 'Counting sort',
  topic: 'sorting',
  summary:
    'Counts each value, turns the counts into running sums, and places every value into an output array, keeping equal values in order.',
  input: z.strictObject({
    values: listField(
      z
        .array(z.int().min(0).max(MAX_COUNTED))
        .min(1)
        .max(MAX_VALUES)
        .describe(
          `Integers from 0 to ${MAX_COUNTED}, e.g. [3, 1, 4, 1, 5, 2, 0, 2].`,
        ),
      'number',
    ),
  }),
  main: 'values',
  examples: [{ values: [3, 1, 4, 1, 5, 2, 0, 2] }],
  code: {
    pseudocode: `
      COUNTING-SORT(a, n, k)
          let b[0 : n - 1] and c[0 : k] be new arrays
          for v = 0 to k
              c[v] = 0
          for j = 0 to n - 1
              c[a[j]] = c[a[j]] + 1  // @count
          for v = 1 to k
              c[v] = c[v] + c[v - 1]  // @sum
          for j = n - 1 downto 0
              c[a[j]] = c[a[j]] - 1  // @place
              b[c[a[j]]] = a[j]
          return b  // @sorted
    `,
    python: `
      def counting_sort(a, k):
          n = len(a)
          b, c = [None] * n, [0] * (k + 1)
          for j in range(n):
              c[a[j]] += 1  # @count
          for v in range(1, k + 1):
              c[v] += c[v - 1]  # @sum
          for j in range(n - 1, -1, -1):
              c[a[j]] -= 1  # @place
              b[c[a[j]]] = a[j]
          return b  # @sorted
    `,
  },
  run({ values }, trace) {
    const n = values.length;
    const k = Math.max(...values);
    const c = Array.from({ length: k + 1 }, () => 0);
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    const counts = trace.add('c', { kind: 'array', initial: [...c] });
    const out = trace.add('b', {
      kind: 'array',
      initial: values.map(() => ''),
    });
    values.forEach((x, j) => {
      c[x]! += 1;
      trace.step('count', `Count ${x}: c[${x}] becomes ${c[x]}.`, {
        vars: { j, k },
      });
      arr.pointer({ name: 'j', index: j }).highlight({ indices: [j] });
      counts.set({ index: x, value: c[x]! }).highlight({ indices: [x] });
    });
    arr.pointer({ name: 'j', index: null });
    for (let v = 1; v <= k; v++) {
      c[v]! += c[v - 1]!;
      trace.step(
        'sum',
        `Add c[${v - 1}] to c[${v}]: ${c[v]} values are at most ${v}.`,
        { vars: { v } },
      );
      counts.set({ index: v, value: c[v]! }).highlight({ indices: [v - 1, v] });
    }
    for (let j = n - 1; j >= 0; j--) {
      const x = values[j]!;
      c[x]! -= 1;
      const at = c[x]!;
      trace.step('place', `c[${x}] drops to ${at}: place ${x} at b[${at}].`, {
        vars: { j },
      });
      arr.pointer({ name: 'j', index: j }).highlight({ indices: [j] });
      counts.set({ index: x, value: at }).highlight({ indices: [x] });
      out.set({ index: at, value: x }).settle({ index: at });
    }
    trace.step('sorted', 'b holds the values in sorted order.');
    arr.pointer({ name: 'j', index: null });
  },
});
