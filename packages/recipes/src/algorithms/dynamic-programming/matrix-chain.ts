/**
 * Matrix-chain multiplication, as in CLRS: for matrices A₁, …, Aₙ, where
 * Aᵢ is p[i − 1] × p[i], m[i, j] is the fewest scalar multiplications that
 * compute Aᵢ⋯Aⱼ, the best over the split k of
 * m[i, k] + m[k + 1, j] + p[i − 1]·p[k]·p[j], and s[i, j] keeps that k.
 * Filling the tables for chains of length 2, 3, …, n, then reading the
 * splits back from s[1, n], gives the best parenthesization.
 *
 * m is the main table and s sits beside it, both indexed 1 to n as the
 * matrices are. Each step tries one split, marking the two cells its cost
 * depends on; the splits read back settle their cells of s.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** The most matrices, so that the tables stay readable. */
export const MAX_MATRICES = 7;
/** The largest dimension, so that the costs stay exact. */
export const MAX_DIMENSION = 1000;

export const matrixChain = defineAlgorithm({
  id: 'matrix-chain',
  title: 'Matrix-chain multiplication',
  topic: 'dynamic-programming',
  summary:
    'Finds the order of multiplying a chain of matrices with the fewest scalar multiplications, filling a table of the best cost of every subchain, then reads the parenthesization back.',
  input: z.strictObject({
    dims: listField(
      z
        .array(z.int().min(1).max(MAX_DIMENSION))
        .min(3)
        .max(MAX_MATRICES + 1)
        .describe(
          `The dimensions p[0], …, p[n]: matrix Aᵢ is p[i − 1] × p[i], for 2 to ${MAX_MATRICES} matrices. E.g. [30, 35, 15, 5, 10, 20, 25].`,
        ),
      'number',
    ),
  }),
  main: 'dims',
  examples: [{ dims: [30, 35, 15, 5, 10, 20, 25] }, { dims: [10, 100, 5, 50] }],
  code: {
    pseudocode: `
      MATRIX-CHAIN-ORDER(p, n)
          let m[1 : n, 1 : n] and s[1 : n - 1, 2 : n] be new tables
          for i = 1 to n
              m[i, i] = 0
          for l = 2 to n
              for i = 1 to n - l + 1
                  j = i + l - 1
                  best = ∞
                  for k = i to j - 1
                      q = m[i, k] + m[k + 1, j] + p[i - 1]·p[k]·p[j]  // @try
                      if q < best
                          best = q
                          split = k
                  m[i, j] = best  // @best
                  s[i, j] = split
          return m and s

      PRINT-OPTIMAL-PARENS(s, i, j)
          if i == j
              print "A"ᵢ
          else
              k = s[i, j]  // @split
              print "("
              PRINT-OPTIMAL-PARENS(s, i, k)
              PRINT-OPTIMAL-PARENS(s, k + 1, j)
              print ")"
    `,
    python: `
      def matrix_chain_order(p):
          n = len(p) - 1
          m = [[0] * (n + 1) for _ in range(n + 1)]
          s = [[0] * (n + 1) for _ in range(n + 1)]
          for l in range(2, n + 1):
              for i in range(1, n - l + 2):
                  j = i + l - 1
                  best, split = float('inf'), None
                  for k in range(i, j):
                      q = m[i][k] + m[k + 1][j] + p[i - 1] * p[k] * p[j]  # @try
                      if q < best:
                          best, split = q, k
                  m[i][j], s[i][j] = best, split  # @best
          return m, s

      def optimal_parens(s, i, j):
          if i == j:
              return f'A{i}'
          k = s[i][j]  # @split
          return f'({optimal_parens(s, i, k)}{optimal_parens(s, k + 1, j)})'
    `,
  },
  run({ dims }, trace) {
    const p = dims;
    const n = p.length - 1;
    const labels = Array.from({ length: n }, (_, k) => k + 1);
    const m: number[][] = labels.map((_, i) =>
      labels.map((_, j) => (i === j ? 0 : Infinity)),
    );
    const s: number[][] = labels.map(() => labels.map(() => 0));
    const M = trace.add('m', {
      kind: 'table',
      label: 'm[i, j]: fewest multiplications for Ai to Aj',
      initial: labels.map((_, i) => labels.map((_, j) => (i === j ? 0 : null))),
      rowLabels: labels,
      columnLabels: labels,
    });
    const S = trace.add('s', {
      kind: 'table',
      label: 's[i, j]: where the best split falls',
      place: 'side',
      rows: n,
      columns: n,
      rowLabels: labels,
      columnLabels: labels,
    });
    // Cells are 0-based; the matrices, and the narration, count from 1.
    const cell = (i: number, j: number): [number, number] => [i - 1, j - 1];

    for (let l = 2; l <= n; l++)
      for (let i = 1; i <= n - l + 1; i++) {
        const j = i + l - 1;
        for (let k = i; k < j; k++) {
          const product = p[i - 1]! * p[k]! * p[j]!;
          const q = m[i - 1]![k - 1]! + m[k]![j - 1]! + product;
          const best = m[i - 1]![j - 1]!;
          const better = q < best;
          trace.step(
            'try',
            `A${i}⋯A${j}, split after A${k}: m[${i}, ${k}] + m[${k + 1}, ${j}] + ${p[i - 1]}·${p[k]}·${p[j]} = ${m[i - 1]![k - 1]} + ${m[k]![j - 1]} + ${product} = ${q}${best === Infinity ? ', the first split tried' : better ? `, better than ${best}` : `, no better than ${best}`}.`,
            { vars: { i, j, k, q } },
          );
          M.depend({ cell: cell(i, j), on: [cell(i, k), cell(k + 1, j)] });
          if (better) {
            m[i - 1]![j - 1] = q;
            s[i - 1]![j - 1] = k;
          }
        }
        const best = m[i - 1]![j - 1]!;
        const k = s[i - 1]![j - 1]!;
        trace.step(
          'best',
          j === i + 1
            ? `m[${i}, ${j}] = ${best}: A${i}A${j} has only the one split, after A${i}, so s[${i}, ${j}] = ${k}.`
            : `m[${i}, ${j}] = ${best}: A${i}⋯A${j} is cheapest split after A${k}, so s[${i}, ${j}] = ${k}.`,
          { vars: { i, j, k } },
        );
        M.set({ cell: cell(i, j), value: best }).highlight({
          cells: [cell(i, j)],
        });
        S.set({ cell: cell(i, j), value: k }).highlight({
          cells: [cell(i, j)],
        });
      }

    const parens = (i: number, j: number): string =>
      i === j
        ? `A${i}`
        : `(${parens(i, s[i - 1]![j - 1]!)}${parens(s[i - 1]![j - 1]! + 1, j)})`;
    const split = (i: number, j: number): void => {
      if (i === j) return;
      const k = s[i - 1]![j - 1]!;
      const whole = i === 1 && j === n;
      trace.step(
        'split',
        `s[${i}, ${j}] = ${k}: ${whole ? 'the whole chain' : `A${i}⋯A${j}`} splits into ${parens(i, k)} and ${parens(k + 1, j)}.${whole ? ` Best order: ${parens(1, n)}, ${m[0]![n - 1]} multiplications.` : ''}`,
        { vars: { i, j, k } },
      );
      S.settle({ cells: [cell(i, j)] });
      M.highlight({ cells: [cell(i, j)] });
      split(i, k);
      split(k + 1, j);
    };
    split(1, n);
    M.settle({ cells: [cell(1, n)] });
  },
});
