/**
 * 0/1 knapsack (ADR 0023): K[i][c] is the best total value of the first i
 * items within capacity c. Each cell either skips item i, keeping the
 * value above it, or takes it, adding its value to the best of the
 * remaining capacity one row up. KNAPSACK-ITEMS then walks back from the
 * corner and settles the cells where an item was taken.
 */
import type { Cell } from '@algomotion/spec';
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** Most items, and the largest capacity, so the table stays readable. */
export const MAX_ITEMS = 8;
export const MAX_CAPACITY = 40;
/** Largest value either way, so sums stay exact enough to show. */
export const MAX_VALUE = 1e9;

export interface KnapsackItem {
  readonly weight: number;
  readonly value: number;
}

export const knapsack = defineAlgorithm({
  id: 'knapsack',
  title: { en: '0/1 knapsack', zh: '0-1 背包' },
  topic: 'dynamic-programming',
  summary: {
    en: 'Fills a table of the best value of the first items within every capacity, each item taken whole or not at all, then traces back the items taken.',
    zh: '填一张表：在每种容量下，前几件物品能得到的最大价值，每件物品要么整件拿，要么不拿；再回溯出拿了哪些物品。',
  },
  input: z.strictObject({
    items: z
      .array(
        z.strictObject({
          weight: z.int().min(1).describe('A positive integer weight.'),
          value: z
            .number()
            .min(-MAX_VALUE)
            .max(MAX_VALUE)
            .describe('The item’s value, at most 1e9 either way.'),
        }),
      )
      .min(1)
      .max(MAX_ITEMS)
      .describe('The items, e.g. [{ "weight": 3, "value": 4 }].'),
    capacity: z
      .int()
      .min(0)
      .max(MAX_CAPACITY)
      .describe(`The weight the knapsack holds, from 0 to ${MAX_CAPACITY}.`),
  }),
  examples: [
    {
      items: [
        { weight: 1, value: 1 },
        { weight: 3, value: 4 },
        { weight: 4, value: 5 },
        { weight: 5, value: 7 },
      ],
      capacity: 7,
    },
  ],
  code: {
    pseudocode: `
      KNAPSACK(w, v, n, W)
          let K[0 : n, 0 : W] be a new table whose row 0 is all 0
          for i = 1 to n
              for c = 0 to W
                  K[i][c] = K[i - 1][c]  // @skip
                  if w[i - 1] ≤ c
                      K[i][c] = max(K[i][c], K[i - 1][c - w[i - 1]] + v[i - 1])  // @take
          return K[n][W]  // @done

      KNAPSACK-ITEMS(K, w, n, W)
          c = W
          for i = n downto 1  // @trace
              if K[i][c] ≠ K[i - 1][c]
                  item i - 1 is in the knapsack
                  c = c - w[i - 1]
    `,
    python: `
      def knapsack(w, v, W):
          n = len(w)
          K = [[0] * (W + 1) for _ in range(n + 1)]
          for i in range(1, n + 1):
              for c in range(W + 1):
                  K[i][c] = K[i - 1][c]  # @skip
                  if w[i - 1] <= c:
                      K[i][c] = max(K[i][c], K[i - 1][c - w[i - 1]] + v[i - 1])  # @take
          return K[n][W]  # @done

      def knapsack_items(K, w, W):
          c, taken = W, []
          for i in range(len(w), 0, -1):  # @trace
              if K[i][c] != K[i - 1][c]:
                  taken.append(i - 1)
                  c -= w[i - 1]
          return taken
    `,
  },
  run({ items, capacity }, trace) {
    const n = items.length;
    const K = Array.from({ length: n + 1 }, () =>
      Array<number>(capacity + 1).fill(0),
    );
    const table = trace.add('K', {
      kind: 'table',
      initial: K.map((row, i) => row.map((v) => (i === 0 ? v : null))),
      rowLabels: [
        trace.say({ en: 'none', zh: '无' }),
        ...items.map(({ weight, value }) => `w${weight} v${value}`),
      ],
    });
    items.forEach(({ weight: w, value: v }, k) => {
      const i = k + 1;
      for (let c = 0; c <= capacity; c++) {
        const skip = K[i - 1]![c]!;
        if (w > c) {
          K[i]![c] = skip;
          trace.step(
            'skip',
            {
              en: `Capacity ${c}: item ${i}, of weight ${w}, does not fit; keep ${skip}.`,
              zh: `容量 ${c}：物品 ${i} 的重量是 ${w}，放不下；保持 ${skip}。`,
            },
            { vars: { i, c } },
          );
          table.depend({ cell: [i, c], on: [[i - 1, c]] });
        } else {
          const take = K[i - 1]![c - w]! + v;
          K[i]![c] = Math.max(skip, take);
          trace.step(
            'take',
            {
              en: `Capacity ${c}: item ${i} fits; the better of leaving it, ${skip}, and taking it, ${K[i - 1]![c - w]} + ${v} = ${take}, is ${K[i]![c]}.`,
              zh: `容量 ${c}：物品 ${i} 放得下；不拿它是 ${skip}，拿它是 ${K[i - 1]![c - w]} + ${v} = ${take}，较大的是 ${K[i]![c]}。`,
            },
            { vars: { i, c } },
          );
          table.depend({
            cell: [i, c],
            on: [
              [i - 1, c],
              [i - 1, c - w],
            ],
          });
        }
        table.set({ cell: [i, c], value: K[i]![c]! });
      }
    });
    trace.step('done', {
      en: `The table is complete: the best value within capacity ${capacity} is ${K[n]![capacity]}.`,
      zh: `表已填完：容量 ${capacity} 内的最大价值是 ${K[n]![capacity]}。`,
    });
    const chosen: Cell[] = [];
    let c = capacity;
    for (let i = n; i > 0; i--)
      if (K[i]![c] !== K[i - 1]![c]) {
        chosen.push([i, c]);
        c -= items[i - 1]!.weight;
      }
    const taken = chosen.map(([i]) => i).reverse();
    trace.step(
      'trace',
      taken.length === 0
        ? {
            en: 'Walk back from the last row: no row differs from the one above, so no item is taken.',
            zh: '从最后一行往回走：没有哪一行与上一行不同，所以没有拿任何物品。',
          }
        : {
            en: `Walk back from the last row: where a row differs from the one above, its item is taken, so ${taken.length === 1 ? 'item' : 'items'} ${taken.join(', ')}.`,
            zh: `从最后一行往回走：哪一行与上一行不同，就拿了那一行的物品，所以拿了物品 ${taken.join(', ')}。`,
          },
    );
    if (chosen.length > 0) table.settle({ cells: chosen });
  },
});
