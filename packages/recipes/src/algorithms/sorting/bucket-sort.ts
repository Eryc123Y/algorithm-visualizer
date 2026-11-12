/**
 * Bucket sort, as in CLRS: for n values in [0, 1), split the interval into
 * n equal buckets, put each value into the list of its bucket, sort each
 * list with insertion sort, and concatenate the lists in order. When the
 * values are spread evenly, each list stays short and the expected time
 * is linear.
 *
 * The lists are the chains of a hash table, one per bucket; insertion
 * sort moves a value within its chain, and the sorted lists are copied,
 * bucket by bucket, into the output array beside it.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** The most values bucket sort takes, so that the buckets fit a page. */
export const MAX_BUCKET_VALUES = 16;

export const bucketSort = defineAlgorithm({
  id: 'bucket-sort',
  title: 'Bucket sort',
  topic: 'sorting',
  summary:
    'Sorts n values in [0, 1) by putting each into one of n equal buckets, sorting each bucket with insertion sort, and joining the buckets in order.',
  input: z.strictObject({
    values: listField(
      z
        .array(z.number().min(0).lt(1))
        .min(1)
        .max(MAX_BUCKET_VALUES)
        .describe(
          'Numbers from 0 up to but not including 1, e.g. [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68].',
        ),
      'number',
    ),
  }),
  main: 'values',
  examples: [
    { values: [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68] },
  ],
  code: {
    pseudocode: `
      BUCKET-SORT(a, n)
          let b[0 : n - 1] be a new array of empty lists
          for i = 0 to n - 1
              insert a[i] into the list b[⌊n · a[i]⌋]  // @bucket
          for k = 0 to n - 1
              sort the list b[k] with insertion sort  // @sort
          concatenate the lists b[0], b[1], …, b[n - 1] in order  // @concat
    `,
    python: `
      def bucket_sort(a):
          n = len(a)
          b = [[] for _ in range(n)]
          for i in range(n):
              b[int(n * a[i])].append(a[i])  # @bucket
          for k in range(n):
              insertion_sort(b[k])  # @sort
          return [x for chain in b for x in chain]  # @concat

      def insertion_sort(chain):
          for j in range(1, len(chain)):
              key, i = chain[j], j - 1
              while i >= 0 and chain[i] > key:
                  chain[i + 1] = chain[i]
                  i -= 1
              chain[i + 1] = key
    `,
  },
  run({ values }, trace) {
    const n = values.length;
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    const buckets = trace.add('b', {
      kind: 'hashTable',
      label: `b: ${n} buckets of width 1/${n}`,
      size: n,
    });
    const out = trace.add('out', {
      kind: 'array',
      label: 'the lists joined',
      place: 'side',
      initial: values.map(() => ''),
    });
    const lists: { id: string; value: number }[][] = Array.from(
      { length: n },
      () => [],
    );

    values.forEach((value, i) => {
      const k = Math.floor(n * value);
      const id = `e${i}`;
      lists[k]!.push({ id, value });
      trace.step(
        'bucket',
        `⌊${n} · ${value}⌋ = ${k}: ${value} goes into bucket ${k}, which holds [${k}/${n}, ${k + 1}/${n}).`,
        { vars: { i } },
      );
      arr.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
      buckets.insert({ bucket: k, element: { id, value } });
      buckets.highlight({ bucket: k, indices: [lists[k]!.length - 1] });
    });
    arr.pointer({ name: 'i', index: null });

    let moves = 0;
    lists.forEach((list, k) => {
      for (let j = 1; j < list.length; j++) {
        const key = list[j]!;
        let at = j;
        while (at > 0 && list[at - 1]!.value > key.value) at -= 1;
        trace.step(
          'sort',
          at === j
            ? `Bucket ${k}: ${key.value} is not smaller than ${list[j - 1]!.value}, so it stays.`
            : `Bucket ${k}: ${key.value} is smaller than ${list[at]!.value}; insertion sort moves it ${at === 0 ? 'to the front' : `after ${list[at - 1]!.value}`}.`,
          { vars: { k, j } },
        );
        if (at !== j) {
          // Ids stay unique for the whole trace, so the moved value gets a
          // new one.
          moves += 1;
          const moved = { id: `${key.id}-${moves}`, value: key.value };
          list.splice(j, 1);
          list.splice(at, 0, moved);
          buckets.remove({ bucket: k, index: j });
          buckets.insert({ bucket: k, element: moved, index: at });
        }
        buckets.highlight({ bucket: k, indices: [at] });
      }
    });

    let filled = 0;
    lists.forEach((list, k) => {
      if (list.length === 0) return;
      trace.step(
        'concat',
        `Bucket ${k} is sorted: copy ${list.map((e) => e.value).join(', ')} to the output, ${filled === 0 ? 'at its start' : `after the ${filled} value${filled === 1 ? '' : 's'} there`}.`,
        { vars: { k } },
      );
      buckets.highlight({ bucket: k });
      list.forEach((e, j) => {
        out.set({ index: filled, value: e.value }).settle({ index: filled });
        buckets.settle({ bucket: k, index: j });
        filled += 1;
      });
    });
  },
});
