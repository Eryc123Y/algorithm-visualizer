/**
 * PARTITION, as in CLRS (Lomuto's scheme), shared by quicksort and
 * selection: the last value of a[p..r] is the pivot x; values ≤ x move to
 * the left, and the pivot goes between the parts, where it settles, since
 * that is its place in sorted order. With a generator, a value drawn
 * uniformly from a[p..r] is first swapped into a[r] (RANDOMIZED-PARTITION),
 * in a step of its own.
 *
 * Each partition is a call: its entry, named by `call`, is pushed on the
 * call stack in its first step, with the id call-p-r: ranges never
 * repeat within a run.
 */
import type { CallStack } from '../../call-stack.ts';
import type { Random } from '../../random.ts';
import type { Handle } from '../../recorder.ts';

/** Records partitions of `a`, drawn as `arr`; returns the pivot's place. */
export function partitioner(
  a: number[],
  arr: Handle<'array'>,
  calls: CallStack,
  random?: Random,
  /** Whether a partition pushes its call; false when the call began earlier. */
  push = true,
): (p: number, r: number, call: string) => number {
  const { trace } = calls;

  const draw = (p: number, r: number, call: string): void => {
    const k = random!.int(p, r);
    trace.step(
      'random',
      k === r
        ? `RANDOM(${p}, ${r}) draws ${k}: the pivot is ${a[r]}, already last.`
        : a[k] === a[r]
          ? `RANDOM(${p}, ${r}) draws ${k}: a[${k}] equals a[${r}], so the pivot is ${a[r]} either way.`
          : `RANDOM(${p}, ${r}) draws ${k}: swap ${a[k]} into a[${r}], to be the pivot.`,
      { vars: { p, r, k } },
    );
    calls.push(`call-${p}-${r}`, call);
    arr.highlight({ indices: k === r ? [r] : [k, r] });
    if (k !== r) {
      arr.swap({ i: k, j: r });
      [a[k], a[r]] = [a[r]!, a[k]!];
    }
  };

  return (p: number, r: number, call: string): number => {
    if (random !== undefined) draw(p, r, call);
    const x = a[r]!;
    trace.step(
      'pivot',
      `Partition a[${p}..${r}] around the pivot ${x}, ${random === undefined ? 'its' : 'now its'} last value.`,
      { vars: { p, r, x } },
    );
    if (random === undefined && push) calls.push(`call-${p}-${r}`, call);
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
}
