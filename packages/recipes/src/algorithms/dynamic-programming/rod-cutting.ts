/**
 * Rod cutting, as in CLRS: given the price p[i] of a piece of length i,
 * the best revenue r[j] from a rod of length j is the best, over the first
 * piece i, of p[i] + r[j − i]; s[j] keeps that best first piece. Filling r
 * and s for j = 1, 2, …, n bottom up, then cutting s[n], s[n − s[n]], …
 * off the rod, gives a best way to cut it.
 *
 * One table holds the prices, r and s, a column per length. Each step
 * tries one first piece, marking the two cells its revenue depends on;
 * the cuts settle the cells of the pieces at the end.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** The longest rod, so that the table stays readable. */
export const MAX_ROD = 12;
/** The largest price; prices are integers, so that sums stay exact. */
export const MAX_PRICE = 1e6;

const ROW = { p: 0, r: 1, s: 2 } as const;

export const rodCutting = defineAlgorithm({
  id: 'rod-cutting',
  title: { en: 'Rod cutting', zh: '钢条切割' },
  topic: 'dynamic-programming',
  summary: {
    en: 'Finds the best revenue from cutting a rod into pieces of priced lengths, bottom up, then cuts the rod by the best first pieces it recorded.',
    zh: '自底向上求出把钢条切成若干段（每种长度有价格）能得到的最大收益，再按记录的最优第一段切开钢条。',
  },
  input: z.strictObject({
    prices: listField(
      z
        .array(z.int().min(0).max(MAX_PRICE))
        .min(1)
        .max(MAX_ROD)
        .describe(
          `The integer price of a piece of length 1, 2, …, n; the rod has length n, at most ${MAX_ROD}. E.g. [1, 5, 8, 9, 10, 17, 17, 20].`,
        ),
      'number',
    ),
  }),
  main: 'prices',
  examples: [{ prices: [1, 5, 8, 9, 10, 17, 17, 20] }],
  code: {
    pseudocode: `
      EXTENDED-BOTTOM-UP-CUT-ROD(p, n)
          let r[0 : n] and s[0 : n] be new arrays
          r[0] = 0
          for j = 1 to n
              q = -∞
              for i = 1 to j
                  if q < p[i] + r[j - i]  // @try
                      q = p[i] + r[j - i]
                      s[j] = i
              r[j] = q  // @best
          return r and s

      PRINT-CUT-ROD-SOLUTION(p, n)
          (r, s) = EXTENDED-BOTTOM-UP-CUT-ROD(p, n)
          while n > 0
              print s[n]  // @cut
              n = n - s[n]
    `,
    python: `
      def extended_bottom_up_cut_rod(p, n):
          r, s = [0] * (n + 1), [0] * (n + 1)
          for j in range(1, n + 1):
              q = float('-inf')
              for i in range(1, j + 1):
                  if q < p[i] + r[j - i]:  # @try
                      q = p[i] + r[j - i]
                      s[j] = i
              r[j] = q  # @best
          return r, s

      def cut_rod_solution(p, n):
          r, s = extended_bottom_up_cut_rod(p, n)
          pieces = []
          while n > 0:
              pieces.append(s[n])  # @cut
              n -= s[n]
          return pieces
    `,
  },
  run({ prices }, trace) {
    const n = prices.length;
    const p = [0, ...prices];
    const r = [0];
    const s = [0];
    const table = trace.add('rod', {
      kind: 'table',
      initial: [
        ['', ...prices],
        [0, ...prices.map(() => null)],
        ['', ...prices.map(() => null)],
      ],
      rowLabels: ['p', 'r', 's'],
      columnLabels: Array.from({ length: n + 1 }, (_, j) => j),
    });

    for (let j = 1; j <= n; j++) {
      let q = -Infinity;
      for (let i = 1; i <= j; i++) {
        const value = p[i]! + r[j - i]!;
        const better = q < value;
        trace.step(
          'try',
          q === -Infinity
            ? {
                en: `Length ${j}, first piece ${i}: p[${i}] + r[${j - i}] = ${p[i]} + ${r[j - i]} = ${value}, the best so far.`,
                zh: `长度 ${j}，第一段长 ${i}：p[${i}] + r[${j - i}] = ${p[i]} + ${r[j - i]} = ${value}，目前最好。`,
              }
            : better
              ? {
                  en: `First piece ${i}: p[${i}] + r[${j - i}] = ${p[i]} + ${r[j - i]} = ${value}, better than ${q}.`,
                  zh: `第一段长 ${i}：p[${i}] + r[${j - i}] = ${p[i]} + ${r[j - i]} = ${value}，比 ${q} 好。`,
                }
              : {
                  en: `First piece ${i}: p[${i}] + r[${j - i}] = ${p[i]} + ${r[j - i]} = ${value}, no better than ${q}.`,
                  zh: `第一段长 ${i}：p[${i}] + r[${j - i}] = ${p[i]} + ${r[j - i]} = ${value}，不比 ${q} 好。`,
                },
          // q as the comparison reads it, before this piece can update it.
          { vars: q === -Infinity ? { j, i } : { j, i, q } },
        );
        table.depend({
          cell: [ROW.r, j],
          on: [
            [ROW.p, i],
            [ROW.r, j - i],
          ],
        });
        if (better) {
          q = value;
          s[j] = i;
        }
      }
      r[j] = q;
      trace.step(
        'best',
        {
          en: `r[${j}] = ${q}: a rod of length ${j} sells best with a first piece of length s[${j}] = ${s[j]}.`,
          zh: `r[${j}] = ${q}：长度为 ${j} 的钢条，第一段长 s[${j}] = ${s[j]} 时卖得最好。`,
        },
        { vars: { j, q } },
      );
      table
        .set({ cell: [ROW.r, j], value: q })
        .set({ cell: [ROW.s, j], value: s[j]! })
        .highlight({
          cells: [
            [ROW.r, j],
            [ROW.s, j],
          ],
        });
    }

    const pieces: number[] = [];
    for (let left = n; left > 0; left -= s[left]!) {
      const piece = s[left]!;
      pieces.push(piece);
      const rest = left - piece;
      trace.step(
        'cut',
        rest === 0
          ? {
              en: `s[${left}] = ${piece}: the last piece${pieces.length === 1 ? ' is the whole rod' : ` has length ${piece}`}. Pieces ${pieces.join(' + ')} = ${n} sell for r[${n}] = ${r[n]}.`,
              zh: `s[${left}] = ${piece}：${pieces.length === 1 ? '最后一段就是整根钢条' : `最后一段长 ${piece}`}。各段 ${pieces.join(' + ')} = ${n} 共卖 r[${n}] = ${r[n]}。`,
            }
          : {
              en: `s[${left}] = ${piece}: cut a piece of length ${piece}, worth ${p[piece]}, leaving ${rest}.`,
              zh: `s[${left}] = ${piece}：切下长 ${piece} 的一段，价值 ${p[piece]}，还剩 ${rest}。`,
            },
        { vars: { n: left } },
      );
      table.settle({
        cells: [
          [ROW.s, left],
          [ROW.p, piece],
        ],
      });
    }
  },
});
