/**
 * Merge sort, as in CLRS: split a[p..r] in half, sort each half, and merge
 * them. MERGE copies a[p..r] into a buffer `aux` drawn under `a`, instead
 * of CLRS's two arrays L and R, so each value sits under the place it came
 * from (ADR 0022). The call stack beside them holds a call from its split
 * to its merged step (ADR 0029); calls on one value record no step.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { callStack } from '../../call-stack.ts';
import { range, SAMPLE, SortInput } from './input.ts';

export const mergeSort = defineAlgorithm({
  id: 'merge-sort',
  title: 'Merge sort',
  topic: 'sorting',
  summary:
    'Splits the array in halves down to single values, then merges sorted halves through a buffer.',
  input: SortInput,
  examples: [SAMPLE],
  code: {
    pseudocode: `
      MERGE-SORT(a, aux, p, r)
          // aux is a buffer as long as a
          if p ≥ r
              return  // @single
          q = ⌊(p + r) / 2⌋  // @split
          MERGE-SORT(a, aux, p, q)
          MERGE-SORT(a, aux, q + 1, r)
          MERGE(a, aux, p, q, r)

      MERGE(a, aux, p, q, r)
          for k = p to r
              aux[k] = a[k]  // @copy
          i = p
          j = q + 1
          for k = p to r  // @merged
              if j > r or (i ≤ q and aux[i] ≤ aux[j])
                  a[k] = aux[i]  // @take-left
                  i = i + 1
              else
                  a[k] = aux[j]  // @take-right
                  j = j + 1
    `,
    python: `
      def merge_sort(a, aux, p, r):
          # aux is a buffer as long as a, such as [None] * len(a)
          if p >= r:
              return  # @single
          q = (p + r) // 2  # @split
          merge_sort(a, aux, p, q)
          merge_sort(a, aux, q + 1, r)
          merge(a, aux, p, q, r)

      def merge(a, aux, p, q, r):
          for k in range(p, r + 1):
              aux[k] = a[k]  # @copy
          i, j = p, q + 1
          for k in range(p, r + 1):  # @merged
              if j > r or (i <= q and aux[i] <= aux[j]):
                  a[k] = aux[i]  # @take-left
                  i += 1
              else:
                  a[k] = aux[j]  # @take-right
                  j += 1
    `,
  },
  run({ values }, outer) {
    const a = [...values];
    const n = a.length;
    const aux: (number | null)[] = values.map(() => null);
    const arr = outer.add('a', { kind: 'array', initial: [...values] });
    const buf = outer.add('aux', {
      kind: 'array',
      initial: values.map(() => ''),
    });
    const calls = callStack(outer);
    const { trace } = calls;

    const merge = (p: number, q: number, r: number): void => {
      trace.step(
        'copy',
        `Merge the sorted halves a[${p}..${q}] and a[${q + 1}..${r}]: first copy them into aux.`,
        { vars: { p, q, r } },
      );
      arr.highlight({ indices: range(p, r) });
      for (const k of range(p, r)) {
        aux[k] = a[k]!;
        buf.set({ index: k, value: a[k]! });
      }
      let i = p;
      let j = q + 1;
      for (const k of range(p, r)) {
        const left = aux[i]!;
        const right = aux[j]!;
        const takeLeft = j > r || (i <= q && left <= right);
        trace.step(
          takeLeft ? 'take-left' : 'take-right',
          j > r
            ? `The right half is used up: take ${left}.`
            : i > q
              ? `The left half is used up: take ${right}.`
              : `${left} ${takeLeft ? '≤' : '>'} ${right}: take ${takeLeft ? left : right}.`,
          { vars: { i, j, k } },
        );
        buf
          .pointer({ name: 'i', index: i <= q ? i : null })
          .pointer({ name: 'j', index: j <= r ? j : null });
        if (i <= q && j <= r) buf.compare({ i, j });
        arr.pointer({ name: 'k', index: k });
        a[k] = takeLeft ? aux[i++]! : aux[j++]!;
        arr.set({ index: k, value: a[k] });
      }
      const whole = p === 0 && r === n - 1;
      trace.step(
        'merged',
        whole
          ? `a[${p}..${r}] is merged: the array is sorted.`
          : `a[${p}..${r}] is merged and sorted.`,
      );
      calls.pop();
      buf
        .pointer({ name: 'i', index: null })
        .pointer({ name: 'j', index: null });
      arr.pointer({ name: 'k', index: null });
      for (const k of range(p, r)) {
        aux[k] = null;
        buf.set({ index: k, value: '' });
        if (whole) arr.settle({ index: k });
      }
    };

    const sort = (p: number, r: number): void => {
      if (p >= r) {
        // A single value is sorted; say so only when it is the whole array.
        if (n === 1) {
          trace.step('single', 'One value is already sorted.');
          arr.settle({ index: 0 });
        }
        return;
      }
      const q = Math.floor((p + r) / 2);
      trace.step(
        'split',
        `Split a[${p}..${r}] into a[${p}..${q}] and a[${q + 1}..${r}], and sort each.`,
        { vars: { p, q, r } },
      );
      calls.push(`call-${p}-${r}`, `sort a[${p}..${r}]`);
      arr.highlight({ indices: range(p, r) });
      sort(p, q);
      sort(q + 1, r);
      merge(p, q, r);
    };
    sort(0, n - 1);
  },
});
