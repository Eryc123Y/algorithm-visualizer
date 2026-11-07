/**
 * Bubble sort, as in CLRS Problem 2-2: each pass runs j from the end down
 * to i + 1, swapping neighbours out of order, so the smallest remaining
 * value bubbles to position i.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { SAMPLE, SortInput } from './input.ts';

export const bubbleSort = defineAlgorithm({
  id: 'bubble-sort',
  title: 'Bubble sort',
  topic: 'sorting',
  summary:
    'Swaps neighbours that are out of order, from the end towards the front, so each pass bubbles the smallest remaining value into place.',
  input: SortInput,
  examples: [SAMPLE],
  code: {
    pseudocode: `
      BUBBLE-SORT(a, n)
          for i = 0 to n - 2  // @sorted
              for j = n - 1 downto i + 1  // @in-place
                  if a[j] < a[j - 1]  // @compare
                      exchange a[j] with a[j - 1]  // @swap
    `,
    python: `
      def bubble_sort(a):
          n = len(a)
          for i in range(n - 1):  # @sorted
              for j in range(n - 1, i, -1):  # @in-place
                  if a[j] < a[j - 1]:  # @compare
                      a[j], a[j - 1] = a[j - 1], a[j]  # @swap
    `,
  },
  run({ values }, trace) {
    const a = [...values];
    const n = a.length;
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    for (let i = 0; i < n - 1; i++) {
      for (let j = n - 1; j > i; j--) {
        trace.step('compare', `Compare ${a[j - 1]} and ${a[j]}.`, {
          vars: { i, j },
        });
        arr.pointer({ name: 'j', index: j }).compare({ i: j - 1, j });
        if (a[j]! < a[j - 1]!) {
          trace.step('swap', `${a[j]} < ${a[j - 1]}: swap them.`);
          arr.swap({ i: j - 1, j });
          [a[j - 1], a[j]] = [a[j]!, a[j - 1]!];
        }
      }
      // At the inner loop's last test, which ends the pass.
      trace.step('in-place', `${a[i]} is in its final position, ${i}.`);
      arr.pointer({ name: 'j', index: null }).settle({ index: i });
    }
    trace.step('sorted', 'The array is sorted.');
    arr.settle({ index: n - 1 });
  },
});
