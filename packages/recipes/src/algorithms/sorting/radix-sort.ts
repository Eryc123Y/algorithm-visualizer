/**
 * Radix sort, as in CLRS: sort the values on their last digit, then on
 * the one before, and so on to the first, each time with a stable sort.
 * Since every pass keeps the order of values whose digit ties, after the
 * pass on digit i the values are sorted on their last i digits.
 *
 * Each pass is a counting sort on the digit: c counts the digits and turns
 * the counts into running sums, and b receives the values, last to first;
 * then b is copied back into a.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** The most values and the largest value radix sort takes. */
export const RADIX_LIMITS = { values: 16, value: 9999 } as const;

const ORDINALS = ['last', 'second to last', 'third to last', 'fourth to last'];

export const radixSort = defineAlgorithm({
  id: 'radix-sort',
  title: 'Radix sort',
  topic: 'sorting',
  summary:
    'Sorts integers digit by digit, from the last digit to the first, with a stable counting sort on each digit.',
  input: z.strictObject({
    values: listField(
      z
        .array(z.int().min(0).max(RADIX_LIMITS.value))
        .min(1)
        .max(RADIX_LIMITS.values)
        .describe(
          `Integers from 0 to ${RADIX_LIMITS.value}, e.g. [329, 457, 657, 839, 436, 720, 355].`,
        ),
      'number',
    ),
  }),
  main: 'values',
  examples: [{ values: [329, 457, 657, 839, 436, 720, 355] }],
  code: {
    pseudocode: `
      RADIX-SORT(a, n, d)
          for i = 1 to d
              COUNTING-SORT-ON-DIGIT(a, n, i)  // @pass
          return a  // @sorted

      COUNTING-SORT-ON-DIGIT(a, n, i)
          let b[0 : n - 1] and c[0 : 9] be new arrays, c all 0
          for j = 0 to n - 1
              x = digit i of a[j], counting from the last
              c[x] = c[x] + 1  // @count
          for x = 1 to 9
              c[x] = c[x] + c[x - 1]  // @sum
          for j = n - 1 downto 0
              x = digit i of a[j]
              c[x] = c[x] - 1  // @place
              b[c[x]] = a[j]
          copy b into a  // @copy
    `,
    python: `
      def radix_sort(a, d):
          for i in range(1, d + 1):
              a = counting_sort_on_digit(a, i)  # @pass
          return a  # @sorted

      def counting_sort_on_digit(a, i):
          n = len(a)
          b, c = [None] * n, [0] * 10
          for j in range(n):
              x = a[j] // 10 ** (i - 1) % 10
              c[x] += 1  # @count
          for x in range(1, 10):
              c[x] += c[x - 1]  # @sum
          for j in range(n - 1, -1, -1):
              x = a[j] // 10 ** (i - 1) % 10
              c[x] -= 1  # @place
              b[c[x]] = a[j]
          return b  # @copy
    `,
  },
  run({ values }, trace) {
    const n = values.length;
    const d = String(Math.max(...values)).length;
    let a = [...values];
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    const counts = trace.add('c', {
      kind: 'array',
      label: 'c: digits counted, then running sums',
      place: 'side',
      initial: Array.from({ length: 10 }, () => ''),
    });
    const out = trace.add('b', {
      kind: 'array',
      place: 'side',
      initial: values.map(() => ''),
    });
    const digit = (x: number, i: number) => Math.floor(x / 10 ** i) % 10;

    for (let i = 0; i < d; i++) {
      const which = ORDINALS[i]!;
      trace.step(
        'pass',
        d === 1
          ? 'The largest value has one digit, so d = 1: one stable pass sorts them.'
          : `Pass ${i + 1} of ${d}, as the largest value has ${d} digits: sort on the ${which} digit, keeping ties in their order${i === 0 ? '' : '; a missing digit counts as 0'}.`,
        { vars: { i: i + 1, d } },
      );
      const c = Array.from({ length: 10 }, () => 0);
      for (let x = 0; x < 10; x++) counts.set({ index: x, value: 0 });
      a.forEach((_, j) => out.set({ index: j, value: '' }));

      a.forEach((value, j) => {
        const x = digit(value, i);
        c[x]! += 1;
        trace.step(
          'count',
          `${value} has ${x} as its ${which} digit: c[${x}] becomes ${c[x]}.`,
          { vars: { j, x } },
        );
        arr.pointer({ name: 'j', index: j }).highlight({ indices: [j] });
        counts.set({ index: x, value: c[x]! }).highlight({ indices: [x] });
      });
      for (let x = 1; x < 10; x++) c[x]! += c[x - 1]!;
      trace.step(
        'sum',
        `Running sums: for each digit x, c[x] is now how many values have a ${which} digit of at most x.`,
      );
      arr.pointer({ name: 'j', index: null });
      c.forEach((value, x) => counts.set({ index: x, value }));

      const b: number[] = Array.from({ length: n }, () => 0);
      for (let j = n - 1; j >= 0; j--) {
        const value = a[j]!;
        const x = digit(value, i);
        c[x]! -= 1;
        b[c[x]!] = value;
        trace.step(
          'place',
          `${value}, digit ${x}: c[${x}] drops to ${c[x]}, so it goes to b[${c[x]}].`,
          { vars: { j, x } },
        );
        arr.pointer({ name: 'j', index: j }).highlight({ indices: [j] });
        counts.set({ index: x, value: c[x]! }).highlight({ indices: [x] });
        out.set({ index: c[x]!, value }).highlight({ indices: [c[x]!] });
      }
      a = b;
      const last = i === d - 1;
      trace.step(
        'copy',
        last
          ? `Copy b into a: sorted on ${d === 1 ? 'its one digit' : `all ${d} digits`}, a is sorted.`
          : `Copy b into a: it is now sorted on its last ${i === 0 ? 'digit' : `${i + 1} digits`}.`,
      );
      arr.pointer({ name: 'j', index: null });
      a.forEach((value, j) => arr.set({ index: j, value }));
      if (last) a.forEach((_, j) => arr.settle({ index: j }));
    }
    trace.step('sorted', `a holds the values in sorted order.`);
  },
});
