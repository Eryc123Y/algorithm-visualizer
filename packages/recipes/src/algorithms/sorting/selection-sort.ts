/**
 * Selection sort, as in CLRS Exercise 2.2-2: for each position i, find the
 * smallest value of `a[i..n-1]` and swap it into `a[i]`.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { SAMPLE, SortInput } from './input.ts';

export const selectionSort = defineAlgorithm({
  id: 'selection-sort',
  title: 'Selection sort',
  topic: 'sorting',
  summary:
    'Finds the smallest value of the unsorted part and swaps it to the front of that part, one position at a time.',
  input: SortInput,
  main: 'values',
  examples: [SAMPLE],
  code: {
    pseudocode: `
      SELECTION-SORT(a, n)
          for i = 0 to n - 2  // @sorted
              smallest = i  // @start
              for j = i + 1 to n - 1
                  if a[j] < a[smallest]  // @compare
                      smallest = j  // @smaller
              exchange a[i] with a[smallest]  // @swap
    `,
    python: `
      def selection_sort(a):
          n = len(a)
          for i in range(n - 1):  # @sorted
              smallest = i  # @start
              for j in range(i + 1, n):
                  if a[j] < a[smallest]:  # @compare
                      smallest = j  # @smaller
              a[i], a[smallest] = a[smallest], a[i]  # @swap
    `,
  },
  run({ values }, trace) {
    const a = [...values];
    const n = a.length;
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    for (let i = 0; i < n - 1; i++) {
      let smallest = i;
      trace.step('start', `Find the smallest value in a[${i}..${n - 1}].`, {
        vars: { i },
      });
      arr
        .pointer({ name: 'i', index: i })
        .pointer({ name: 'smallest', index: i });
      for (let j = i + 1; j < n; j++) {
        trace.step(
          'compare',
          `Compare ${a[j]} with the smallest so far, ${a[smallest]}.`,
          { vars: { i, j, smallest } },
        );
        arr.pointer({ name: 'j', index: j }).compare({ i: j, j: smallest });
        if (a[j]! < a[smallest]!) {
          smallest = j;
          trace.step('smaller', `${a[j]} is smaller: the smallest so far.`);
          arr.pointer({ name: 'smallest', index: j });
        }
      }
      trace.step(
        'swap',
        smallest === i
          ? `${a[i]} is the smallest: it stays at position ${i}.`
          : `Swap the smallest, ${a[smallest]}, into position ${i}.`,
      );
      arr.pointer({ name: 'j', index: null });
      if (smallest !== i) {
        arr.swap({ i, j: smallest });
        [a[i], a[smallest]] = [a[smallest]!, a[i]!];
      }
      arr.settle({ index: i });
    }
    trace.step('sorted', 'The array is sorted.');
    arr
      .pointer({ name: 'i', index: null })
      .pointer({ name: 'smallest', index: null })
      .settle({ index: n - 1 });
  },
});
