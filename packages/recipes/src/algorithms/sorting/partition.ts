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
        ? {
            en: `RANDOM(${p}, ${r}) draws ${k}: the pivot is ${a[r]}, already last.`,
            zh: `RANDOM(${p}, ${r}) 抽到 ${k}：主元是 ${a[r]}，已经在最后。`,
          }
        : a[k] === a[r]
          ? {
              en: `RANDOM(${p}, ${r}) draws ${k}: a[${k}] equals a[${r}], so the pivot is ${a[r]} either way.`,
              zh: `RANDOM(${p}, ${r}) 抽到 ${k}：a[${k}] 等于 a[${r}]，所以主元总是 ${a[r]}。`,
            }
          : {
              en: `RANDOM(${p}, ${r}) draws ${k}: swap ${a[k]} into a[${r}], to be the pivot.`,
              zh: `RANDOM(${p}, ${r}) 抽到 ${k}：把 ${a[k]} 交换到 a[${r}]，作为主元。`,
            },
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
      {
        en: `Partition a[${p}..${r}] around the pivot ${x}, ${random === undefined ? 'its' : 'now its'} last value.`,
        zh: `以主元 ${x} 划分 a[${p}..${r}]，它${random === undefined ? '是' : '现在是'}最后一个值。`,
      },
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
          ? {
              en: `${a[j]} ≤ ${x}: it belongs on the left.`,
              zh: `${a[j]} ≤ ${x}：它属于左边。`,
            }
          : {
              en: `${a[j]} > ${x}: it stays on the right.`,
              zh: `${a[j]} > ${x}：它留在右边。`,
            },
        { vars: { i, j, x } },
      );
      arr.pointer({ name: 'j', index: j }).compare({ i: j, j: r });
      if (!small) continue;
      i += 1;
      trace.step(
        'swap',
        i === j
          ? {
              en: `The left part grows to a[${p}..${i}]; ${a[j]} is already there.`,
              zh: `左边部分扩大为 a[${p}..${i}]；${a[j]} 已经在里面。`,
            }
          : {
              en: `The left part grows to a[${p}..${i}]: swap ${a[i]} and ${a[j]}.`,
              zh: `左边部分扩大为 a[${p}..${i}]：交换 ${a[i]} 和 ${a[j]}。`,
            },
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
      {
        en: `Put the pivot ${x} between the parts, at position ${q}: it is in place.`,
        zh: `把主元 ${x} 放在两部分之间，位置 ${q}：它已就位。`,
      },
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
