/**
 * Insertion sort, as in CLRS: lift `key = a[i]` out, shift larger values
 * of the sorted prefix one place right, and drop the key into the gap. The
 * key is drawn as a cell of its own, so the shifted copies show as they
 * do in the code.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { range, SAMPLE, SortInput } from './input.ts';

export const insertionSort = defineAlgorithm({
  id: 'insertion-sort',
  title: 'Insertion sort',
  topic: 'sorting',
  summary:
    'Grows a sorted prefix by lifting out the next value, shifting larger ones right, and dropping it into the gap.',
  input: SortInput,
  main: 'values',
  examples: [SAMPLE],
  code: {
    pseudocode: `
      INSERTION-SORT(a, n)
          for i = 1 to n - 1  // @sorted
              key = a[i]  // @key
              j = i - 1
              while j ≥ 0 and a[j] > key  // @compare
                  a[j + 1] = a[j]  // @shift
                  j = j - 1
              a[j + 1] = key  // @insert
    `,
    python: `
      def insertion_sort(a):
          for i in range(1, len(a)):  # @sorted
              key = a[i]  # @key
              j = i - 1
              while j >= 0 and a[j] > key:  # @compare
                  a[j + 1] = a[j]  # @shift
                  j -= 1
              a[j + 1] = key  # @insert
    `,
  },
  run({ values }, trace) {
    const a = [...values];
    const n = a.length;
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    const cell = trace.add('key', {
      kind: 'array',
      place: 'side',
      initial: [''],
    });
    for (let i = 1; i < n; i++) {
      const key = a[i]!;
      trace.step(
        'key',
        `a[0..${i - 1}] is sorted. Lift out the key ${key} from position ${i}.`,
        { vars: { i, key } },
      );
      arr.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
      cell.set({ index: 0, value: key });
      let j = i - 1;
      for (; j >= 0; j--) {
        const larger = a[j]! > key;
        trace.step(
          'compare',
          larger
            ? `${a[j]} > ${key}: ${a[j]} moves right.`
            : `${a[j]} ≤ ${key}: the key goes after it.`,
          { vars: { i, j, key } },
        );
        arr.pointer({ name: 'j', index: j }).highlight({ indices: [j] });
        cell.highlight({ indices: [0] });
        if (!larger) break;
        trace.step(
          'shift',
          `Copy ${a[j]} one place right, to position ${j + 1}.`,
        );
        arr.set({ index: j + 1, value: a[j]! });
        a[j + 1] = a[j]!;
      }
      // The loop test also runs, and fails, once j passes the front.
      if (j < 0) {
        trace.step(
          'compare',
          'No value is left before the gap: the key goes to the front.',
          {
            vars: { i, j, key },
          },
        );
        arr.pointer({ name: 'j', index: null });
        cell.highlight({ indices: [0] });
      }
      trace.step('insert', `Put the key ${key} at position ${j + 1}.`);
      arr.pointer({ name: 'j', index: null }).set({ index: j + 1, value: key });
      cell.set({ index: 0, value: '' });
      a[j + 1] = key;
    }
    trace.step('sorted', 'The array is sorted.');
    arr.pointer({ name: 'i', index: null });
    for (const k of range(0, n - 1)) arr.settle({ index: k });
  },
});
