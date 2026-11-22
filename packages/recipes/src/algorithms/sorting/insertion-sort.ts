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
  title: { en: 'Insertion sort', zh: '插入排序' },
  topic: 'sorting',
  summary: {
    en: 'Grows a sorted prefix by lifting out the next value, shifting larger ones right, and dropping it into the gap.',
    zh: '逐步扩大已排序的前缀：取出下一个值，把比它大的值右移，再把它放进空位。',
  },
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
        {
          en: `a[0..${i - 1}] is sorted. Lift out the key ${key} from position ${i}.`,
          zh: `a[0..${i - 1}] 已排好序。从位置 ${i} 取出关键字 ${key}。`,
        },
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
            ? {
                en: `${a[j]} > ${key}: ${a[j]} moves right.`,
                zh: `${a[j]} > ${key}：${a[j]} 右移。`,
              }
            : {
                en: `${a[j]} ≤ ${key}: the key goes after it.`,
                zh: `${a[j]} ≤ ${key}：关键字放在它后面。`,
              },
          { vars: { i, j, key } },
        );
        arr.pointer({ name: 'j', index: j }).highlight({ indices: [j] });
        cell.highlight({ indices: [0] });
        if (!larger) break;
        trace.step('shift', {
          en: `Copy ${a[j]} one place right, to position ${j + 1}.`,
          zh: `把 ${a[j]} 右移一位，到位置 ${j + 1}。`,
        });
        arr.set({ index: j + 1, value: a[j]! });
        a[j + 1] = a[j]!;
      }
      // The loop test also runs, and fails, once j passes the front.
      if (j < 0) {
        trace.step(
          'compare',
          {
            en: 'No value is left before the gap: the key goes to the front.',
            zh: '空位前面已没有值：关键字放到最前面。',
          },
          {
            vars: { i, j, key },
          },
        );
        arr.pointer({ name: 'j', index: null });
        cell.highlight({ indices: [0] });
      }
      trace.step('insert', {
        en: `Put the key ${key} at position ${j + 1}.`,
        zh: `把关键字 ${key} 放到位置 ${j + 1}。`,
      });
      arr.pointer({ name: 'j', index: null }).set({ index: j + 1, value: key });
      cell.set({ index: 0, value: '' });
      a[j + 1] = key;
    }
    trace.step('sorted', { en: 'The array is sorted.', zh: '数组已排好序。' });
    arr.pointer({ name: 'i', index: null });
    for (const k of range(0, n - 1)) arr.settle({ index: k });
  },
});
