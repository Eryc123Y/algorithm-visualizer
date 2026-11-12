/**
 * Quicksort, as in CLRS: PARTITION (Lomuto's scheme) takes the last value
 * as the pivot x, keeps values ≤ x on the left, and puts the pivot between
 * the two parts; then each part is sorted the same way. The call stack
 * beside the array holds each call on one value or more; a call leaves it
 * at the next step after it returns (ADR 0029).
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { callStack } from '../../call-stack.ts';
import type { Random } from '../../random.ts';
import { partitioner } from './partition.ts';
import type { Trace } from '../../trace.ts';
import { SAMPLE, SortInput } from './input.ts';

export const quicksort = defineAlgorithm({
  id: 'quicksort',
  title: 'Quicksort',
  topic: 'sorting',
  summary:
    'Partitions around the last value as pivot, keeping smaller or equal values on its left, then sorts each part the same way.',
  input: SortInput,
  main: 'values',
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
  run: ({ values }, trace) => recordQuicksort(values, trace),
});

/**
 * Records quicksort on `values`. With `random`, each partition first
 * swaps a value drawn uniformly from a[p..r] into a[r], so that it is the
 * pivot (RANDOMIZED-PARTITION), in a step of its own.
 */
export function recordQuicksort(
  values: readonly number[],
  outer: Trace,
  random?: Random,
): void {
  const a = [...values];
  const arr = outer.add('a', { kind: 'array', initial: [...values] });
  const calls = callStack(outer);
  const { trace } = calls;

  const partition = partitioner(a, arr, calls, random);

  const sort = (p: number, r: number): void => {
    if (p > r) return;
    if (p === r) {
      trace.step('single', `a[${p}] = ${a[p]} is alone: it is in place.`);
      calls.push(`call-${p}-${r}`, `sort a[${p}..${r}]`);
      arr.settle({ index: p });
      calls.leave();
      return;
    }
    const q = partition(p, r, `sort a[${p}..${r}]`);
    sort(p, q - 1);
    sort(q + 1, r);
    calls.leave();
  };
  sort(0, a.length - 1);
  calls.close();
}
