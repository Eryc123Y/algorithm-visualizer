/**
 * Quicksort, as in CLRS: PARTITION (Lomuto's scheme) takes the last value
 * as the pivot x, keeps values ≤ x on the left, and puts the pivot between
 * the two parts; then each part is sorted the same way.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { SAMPLE, SortInput } from './input.ts';

export const quicksort = defineAlgorithm({
  id: 'quicksort',
  title: 'Quicksort',
  topic: 'sorting',
  summary:
    'Partitions around the last value as pivot, keeping smaller or equal values on its left, then sorts each part the same way.',
  input: SortInput,
  examples: [SAMPLE],
  code: {
    pseudocode: `
      QUICKSORT(a, p, r)
          if p < r  // @single
              q = PARTITION(a, p, r)
              QUICKSORT(a, p, q - 1)
              QUICKSORT(a, q + 1, r)

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
      def quicksort(a, p, r):
          if p < r:  # @single
              q = partition(a, p, r)
              quicksort(a, p, q - 1)
              quicksort(a, q + 1, r)

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
  run({ values }, trace) {
    const a = [...values];
    const arr = trace.add('a', { kind: 'array', initial: [...values] });

    const partition = (p: number, r: number): number => {
      const x = a[r]!;
      trace.step(
        'pivot',
        `Partition a[${p}..${r}] around the pivot ${x}, its last value.`,
        { vars: { p, r, x } },
      );
      arr.pointer({ name: 'pivot', index: r }).highlight({ indices: [r] });
      let i = p - 1;
      for (let j = p; j < r; j++) {
        const small = a[j]! <= x;
        trace.step(
          'compare',
          small
            ? `${a[j]} ≤ ${x}: it belongs on the left.`
            : `${a[j]} > ${x}: it stays on the right.`,
          { vars: { i, j, x } },
        );
        arr.pointer({ name: 'j', index: j }).compare({ i: j, j: r });
        if (!small) continue;
        i += 1;
        trace.step(
          'swap',
          i === j
            ? `The left part grows to a[${p}..${i}]; ${a[j]} is already there.`
            : `The left part grows to a[${p}..${i}]: swap ${a[i]} and ${a[j]}.`,
          { vars: { i, j, x } },
        );
        arr.pointer({ name: 'i', index: i });
        if (i !== j) {
          arr.swap({ i, j });
          [a[i], a[j]] = [a[j]!, a[i]!];
        }
      }
      const q = i + 1;
      trace.step(
        'place',
        `Put the pivot ${x} between the parts, at position ${q}: it is in place.`,
        { vars: { q } },
      );
      arr
        .pointer({ name: 'j', index: null })
        .pointer({ name: 'i', index: null })
        .pointer({ name: 'pivot', index: null });
      if (q !== r) {
        arr.swap({ i: q, j: r });
        [a[q], a[r]] = [a[r]!, a[q]!];
      }
      arr.settle({ index: q });
      return q;
    };

    const sort = (p: number, r: number): void => {
      if (p > r) return;
      if (p === r) {
        trace.step('single', `a[${p}] = ${a[p]} is alone: it is in place.`);
        arr.settle({ index: p });
        return;
      }
      const q = partition(p, r);
      sort(p, q - 1);
      sort(q + 1, r);
    };
    sort(0, a.length - 1);
  },
});
