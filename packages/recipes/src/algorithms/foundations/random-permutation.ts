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
  title: 'Random permutation',
  topic: 'foundations',
  summary:
    'Shuffles an array in place: each position in turn swaps with a value drawn uniformly from the positions not yet fixed.',
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
      label: 'RANDOM(i, n − 1) for each i',
      place: 'side',
      initial: values.map(() => ''),
    });
    for (let i = 0; i < n; i++) {
      const j = random.int(i, n - 1);
      trace.step(
        'draw',
        i === n - 1
          ? `RANDOM(${i}, ${i}) can only return ${j}: a[${i}] = ${a[i]} is the last one left.`
          : `RANDOM(${i}, ${n - 1}) draws j = ${j}, one of ${n - i} positions with equal chance.`,
        { vars: { i, j, n } },
      );
      arr.pointer({ name: 'i', index: i }).pointer({ name: 'j', index: j });
      arr.highlight({ indices: i === j ? [i] : [i, j] });
      draws.set({ index: i, value: j }).highlight({ indices: [i] });
      trace.step(
        'swap',
        i === j
          ? `j = i: ${a[i]} stays at position ${i}, which is now fixed.`
          : `Swap a[${i}] = ${a[i]} with a[${j}] = ${a[j]}: position ${i} is now fixed.`,
        { vars: { i, j } },
      );
      if (i !== j) {
        arr.swap({ i, j });
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      arr.settle({ index: i });
    }
    trace.step(
      'done',
      `a is a uniformly random order of the values: [${a.join(', ')}].`,
    );
    arr.pointer({ name: 'i', index: null }).pointer({ name: 'j', index: null });
  },
});
