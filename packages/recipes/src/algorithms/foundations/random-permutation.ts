/**
 * Randomly permuting an array in place, as in CLRS: for each position i
 * from the first, swap a[i] with a value drawn uniformly from a[i..n-1].
 * Every one of the n! orders comes out with probability 1/n!.
 *
 * The array settles a position per swap; the draws, an array beside it,
 * keep each index RANDOM returned. The seed in the input fixes the draws,
 * so a run can be shown again.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';
import { seedField, seededRandom } from '../../random.ts';
import { MAX_VALUES } from '../sorting/input.ts';

export const randomPermutation = defineAlgorithm({
  id: 'random-permutation',
  title: { en: 'Random permutation', zh: '随机排列' },
  topic: 'foundations',
  summary: {
    en: 'Shuffles an array in place: each position in turn swaps with a value drawn uniformly from the positions not yet fixed.',
    zh: '原地打乱一个数组：依次让每个位置与从尚未固定的位置中均匀随机选出的值交换。',
  },
  input: z.strictObject({
    values: listField(
      z
        .array(z.number())
        .min(1)
        .max(MAX_VALUES)
        .describe('The numbers to permute, e.g. [1, 2, 3, 4, 5, 6, 7].'),
      'number',
    ),
    seed: seedField,
  }),
  main: 'values',
  examples: [
    { values: [1, 2, 3, 4, 5, 6, 7], seed: 1 },
    { values: [10, 20, 30, 40], seed: 7 },
  ],
  code: {
    pseudocode: `
      RANDOMLY-PERMUTE(a, n)
          for i = 0 to n - 1
              j = RANDOM(i, n - 1)  // @draw
              exchange a[i] with a[j]  // @swap
          return a  // @done
    `,
    python: `
      import random

      def randomly_permute(a):
          n = len(a)
          for i in range(n):
              j = random.randint(i, n - 1)  # @draw
              a[i], a[j] = a[j], a[i]  # @swap
          return a  # @done
    `,
  },
  run({ values, seed }, trace) {
    const n = values.length;
    const a = [...values];
    const random = seededRandom(seed);
    const arr = trace.add('a', { kind: 'array', initial: [...values] });
    const draws = trace.add('draws', {
      kind: 'array',
      label: trace.say({
        en: 'RANDOM(i, n − 1) for each i',
        zh: '每个 i 的 RANDOM(i, n − 1)',
      }),
      place: 'side',
      initial: values.map(() => ''),
    });
    for (let i = 0; i < n; i++) {
      const j = random.int(i, n - 1);
      trace.step(
        'draw',
        i === n - 1
          ? {
              en: `RANDOM(${i}, ${i}) can only return ${j}: a[${i}] = ${a[i]} is the last one left.`,
              zh: `RANDOM(${i}, ${i}) 只能返回 ${j}：a[${i}] = ${a[i]} 是剩下的最后一个。`,
            }
          : {
              en: `RANDOM(${i}, ${n - 1}) draws j = ${j}, one of ${n - i} positions with equal chance.`,
              zh: `RANDOM(${i}, ${n - 1}) 抽到 j = ${j}，${n - i} 个位置的机会均等。`,
            },
        { vars: { i, j, n } },
      );
      arr.pointer({ name: 'i', index: i }).pointer({ name: 'j', index: j });
      arr.highlight({ indices: i === j ? [i] : [i, j] });
      draws.set({ index: i, value: j }).highlight({ indices: [i] });
      trace.step(
        'swap',
        i === j
          ? {
              en: `j = i: ${a[i]} stays at position ${i}, which is now fixed.`,
              zh: `j = i：${a[i]} 留在位置 ${i}，这个位置现在固定了。`,
            }
          : {
              en: `Swap a[${i}] = ${a[i]} with a[${j}] = ${a[j]}: position ${i} is now fixed.`,
              zh: `交换 a[${i}] = ${a[i]} 和 a[${j}] = ${a[j]}：位置 ${i} 现在固定了。`,
            },
        { vars: { i, j } },
      );
      if (i !== j) {
        arr.swap({ i, j });
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      arr.settle({ index: i });
    }
    trace.step('done', {
      en: `a is now [${a.join(', ')}]: one of the ${n}! orders of the values, each equally likely.`,
      zh: `a 现在是 [${a.join(', ')}]：这些值的 ${n}! 种顺序之一，每种的可能性都相同。`,
    });
    arr.pointer({ name: 'i', index: null }).pointer({ name: 'j', index: null });
  },
});
