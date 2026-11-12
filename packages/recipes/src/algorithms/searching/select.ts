/**
 * Selection in worst-case linear time, as in CLRS (the median of
 * medians): split a[p..r] into groups of five, sort each group and take
 * its median, take the median x of those medians, partition around x, and
 * search only the side that holds the answer. The pivot always has at
 * least about 3n/10 values on each side, so no input makes it slow.
 *
 * The array is the main structure; the medians of the groups sit in an
 * array beside it, and the call stack names what each call looks for. A
 * part of five values or fewer is sorted directly, and so are the medians,
 * which are never more than five here: that is SELECT's base case.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { callStack } from '../../call-stack.ts';
import type { Handle } from '../../recorder.ts';
import { partitioner } from '../sorting/partition.ts';
import { lowerMedian, ordinal, selectInput } from './randomized-select.ts';

/** At most 25 values, so that the medians of a call fit one group. */
export const MAX_SELECT_VALUES = 25;

const GROUP = 5;

export const select = defineAlgorithm({
  id: 'select',
  title: 'Select (median of medians)',
  topic: 'searching',
  summary:
    'Finds the i-th smallest value in worst-case linear time: partitions around the median of the medians of groups of five, and searches only the side that holds it.',
  input: selectInput(MAX_SELECT_VALUES),
  main: 'values',
  examples: [
    {
      values: [12, 4, 30, 7, 19, 25, 1, 16, 9, 22, 3, 28, 14, 11, 6, 20],
      i: 10,
    },
  ],
  code: {
    pseudocode: `
      SELECT(a, p, r, i)
          if r - p + 1 ≤ 5
              sort a[p..r] with insertion sort  // @small
              return a[p + i - 1]
          for each group of 5 values of a[p..r], the last perhaps shorter
              sort the group, and add its median to the list m  // @group
          x = SELECT(m, 0, m.length - 1, ⌊(m.length + 1) / 2⌋)  // @medians
          exchange a[r] with the first group's median equal to x  // @move
          q = PARTITION(a, p, r)
          k = q - p + 1
          if i == k  // @rank
              return a[q]  // @found
          elseif i < k
              return SELECT(a, p, q - 1, i)
          else return SELECT(a, q + 1, r, i - k)

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
      def select(a, p, r, i):
          if r - p + 1 <= 5:
              a[p:r + 1] = sorted(a[p:r + 1])  # @small
              return a[p + i - 1]
          m = []
          for s in range(p, r + 1, 5):
              e = min(s + 4, r)
              a[s:e + 1] = sorted(a[s:e + 1])
              m.append((a[(s + e) // 2], (s + e) // 2))  # @group
          medians = [v for v, _ in m]
          x = select(medians, 0, len(m) - 1, (len(m) + 1) // 2)  # @medians
          t = next(t for v, t in m if v == x)
          a[t], a[r] = a[r], a[t]  # @move
          q = partition(a, p, r)
          k = q - p + 1
          if i == k:  # @rank
              return a[q]  # @found
          if i < k:
              return select(a, p, q - 1, i)
          return select(a, q + 1, r, i - k)

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
  run({ values, i: rank }, outer) {
    const a = [...values];
    const n = a.length;
    const arr = outer.add('a', { kind: 'array', initial: [...values] });
    const groups = Math.ceil(n / GROUP);
    const medians =
      n > GROUP
        ? outer.add('m', {
            kind: 'array',
            label: 'm: the medians of the groups',
            place: 'side',
            initial: Array.from({ length: groups }, () => ''),
          })
        : undefined;
    const calls = callStack(outer);
    const { trace } = calls;
    const partition = partitioner(a, arr, calls, undefined, false);
    const target = rank ?? lowerMedian(n);
    const sortRange = (lo: number, hi: number) => sortIn(a, arr, lo, hi);

    let [p, r, i] = [0, n - 1, target];
    for (;;) {
      const call = `${ordinal(i)} smallest of a[${p}..${r}]`;
      const size = r - p + 1;
      if (size <= GROUP) {
        const answer = [...a.slice(p, r + 1)].sort((x, y) => x - y)[i - 1]!;
        trace.step(
          'small',
          `a[${p}..${r}] has ${size === 1 ? 'one value' : `${size} values`}: sort ${size === 1 ? 'it' : 'them'} and take the ${ordinal(i)}, ${answer}. It is the answer, the ${ordinal(target)} smallest.`,
          { vars: { p, r, i } },
        );
        calls.push(`call-${p}-${r}`, call);
        sortRange(p, r);
        arr
          .settle({ index: p + i - 1 })
          .pointer({ name: 'answer', index: p + i - 1 });
        break;
      }

      const m: { value: number; at: number }[] = [];
      for (let s = p, g = 0; s <= r; s += GROUP, g++) {
        const e = Math.min(s + GROUP - 1, r);
        const mid = Math.floor((s + e) / 2);
        const group = a.slice(s, e + 1).sort((x, y) => x - y);
        trace.step(
          'group',
          `Sort the group a[${s}..${e}]: [${group.join(', ')}]. Its median is ${group[mid - s]}.`,
          { vars: { p, r } },
        );
        sortRange(s, e);
        m.push({ value: a[mid]!, at: mid });
        if (g === 0) {
          calls.push(`call-${p}-${r}`, call);
          for (let c = 0; c < groups; c++)
            medians!.set({ index: c, value: '' });
        }
        arr.highlight({ indices: range(s, e) });
        arr.pointer({ name: 'median', index: mid });
        medians!.set({ index: g, value: a[mid]! }).highlight({ indices: [g] });
      }

      const sorted = [...m].sort((x, y) => x.value - y.value);
      const x = sorted[lowerMedian(m.length) - 1]!.value;
      // The first group whose median is x, as Python's next() finds it.
      const pick = m.find((g) => g.value === x)!;
      trace.step(
        'medians',
        `The medians, sorted, are [${sorted.map((x) => x.value).join(', ')}]: their median, ${pick.value}, is the pivot x.`,
        { vars: { p, r } },
      );
      arr.pointer({ name: 'median', index: null });
      sorted.forEach((x, c) => medians!.set({ index: c, value: x.value }));
      medians!.highlight({ indices: [lowerMedian(m.length) - 1] });

      trace.step(
        'move',
        pick.at === r
          ? `x = ${pick.value} is already last, in a[${r}].`
          : `Swap x = ${pick.value} from a[${pick.at}] into a[${r}], so that PARTITION takes it as the pivot.`,
        { vars: { p, r } },
      );
      if (pick.at !== r) {
        arr.swap({ i: pick.at, j: r });
        [a[pick.at], a[r]] = [a[r]!, a[pick.at]!];
      }

      const q = partition(p, r, call);
      const k = q - p + 1;
      if (i === k) {
        trace.step(
          'found',
          `The pivot ${a[q]} is the ${ordinal(k)} smallest of a[${p}..${r}], the one wanted: it is the answer, the ${ordinal(target)} smallest.`,
          { vars: { p, r, i, k, q } },
        );
        arr.pointer({ name: 'answer', index: q });
        break;
      }
      const left = i < k;
      trace.step(
        'rank',
        left
          ? `The pivot ${a[q]} is the ${ordinal(k)} smallest of a[${p}..${r}], but the ${ordinal(i)} is wanted: it lies to the left, in a[${p}..${q - 1}].`
          : `The pivot ${a[q]} is the ${ordinal(k)} smallest of a[${p}..${r}], but the ${ordinal(i)} is wanted: it is the ${ordinal(i - k)} smallest of a[${q + 1}..${r}], to the right.`,
        { vars: { p, r, i, k, q } },
      );
      const [lo, hi] = left ? [p, q - 1] : [q + 1, r];
      arr.highlight({ indices: range(lo, hi) });
      if (left) r = q - 1;
      else [p, i] = [q + 1, i - k];
    }
    calls.close();
  },
});

const range = (lo: number, hi: number) =>
  Array.from({ length: hi - lo + 1 }, (_, t) => lo + t);

/** Sorts a[lo..hi] by insertion sort, recording each swap. */
function sortIn(
  a: number[],
  arr: Handle<'array'>,
  lo: number,
  hi: number,
): void {
  for (let j = lo + 1; j <= hi; j++)
    for (let t = j; t > lo && a[t - 1]! > a[t]!; t--) {
      arr.swap({ i: t - 1, j: t });
      [a[t - 1], a[t]] = [a[t]!, a[t - 1]!];
    }
}
