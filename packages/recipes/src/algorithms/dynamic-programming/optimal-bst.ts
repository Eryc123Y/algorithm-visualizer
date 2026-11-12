/**
 * Optimal binary search trees, as in CLRS: keys k₁ < … < kₙ are searched
 * with probabilities p₁, …, pₙ, and the gaps between them (the dummy keys
 * d₀, …, dₙ) with q₀, …, qₙ. e[i, j] is the least expected search cost of
 * a tree on kᵢ, …, kⱼ, the best over its root r of
 * e[i, r − 1] + e[r + 1, j] + w[i, j], where w[i, j] adds up the
 * probabilities of the subtree. root[i, j] keeps that r, and the tree is
 * built from it at the end.
 *
 * e is the main table, w and root sit beside it, and the tree is drawn as
 * it is built. Probabilities have at most two decimals and are added in
 * whole hundredths, so every sum is exact.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** The most keys, so that the tables stay readable. */
export const MAX_KEYS = 6;

/** A probability with at most two decimals, in whole hundredths. */
const hundredths = (x: number) => Math.round(x * 100);
const Probability = z
  .number()
  .min(0)
  .max(1)
  .refine((x) => Math.abs(x * 100 - hundredths(x)) < 1e-9, {
    message: 'Give probabilities with at most two decimals, such as 0.15',
  });

/** Hundredths as a decimal: 275 → "2.75", 5 → "0.05". */
const show = (h: number) => (h / 100).toFixed(2);

export const optimalBst = defineAlgorithm({
  id: 'optimal-bst',
  title: 'Optimal binary search tree',
  topic: 'dynamic-programming',
  summary:
    'Finds the binary search tree with the least expected search cost for keys and gaps searched with given probabilities, filling tables of the best cost of every range of keys, then builds the tree.',
  input: z
    .strictObject({
      p: listField(
        z
          .array(Probability)
          .min(1)
          .max(MAX_KEYS)
          .describe(
            `The probabilities p₁, …, pₙ of searching for each key, 1 to ${MAX_KEYS} of them, e.g. [0.15, 0.10, 0.05, 0.10, 0.20].`,
          ),
        'number',
      ),
      q: listField(
        z
          .array(Probability)
          .min(2)
          .max(MAX_KEYS + 1)
          .describe(
            'The probabilities q₀, …, qₙ of searching between keys, one more than p, e.g. [0.05, 0.10, 0.05, 0.05, 0.05, 0.10].',
          ),
        'number',
      ),
    })
    .superRefine(({ p, q }, ctx) => {
      if (q.length !== p.length + 1)
        ctx.addIssue({
          code: 'custom',
          path: ['q'],
          message: `q needs one probability more than p: ${p.length + 1}, not ${q.length}`,
        });
    }),
  examples: [
    {
      p: [0.15, 0.1, 0.05, 0.1, 0.2],
      q: [0.05, 0.1, 0.05, 0.05, 0.05, 0.1],
    },
  ],
  code: {
    pseudocode: `
      OPTIMAL-BST(p, q, n)
          let e[1 : n + 1, 0 : n], w[1 : n + 1, 0 : n] and root[1 : n, 1 : n] be new tables
          for i = 1 to n + 1
              e[i, i - 1] = q[i - 1]  // @init
              w[i, i - 1] = q[i - 1]
          for l = 1 to n
              for i = 1 to n - l + 1
                  j = i + l - 1
                  w[i, j] = w[i, j - 1] + p[j] + q[j]  // @weight
                  best = ∞
                  for r = i to j
                      t = e[i, r - 1] + e[r + 1, j] + w[i, j]  // @try
                      if t < best
                          best = t
                          choice = r
                  e[i, j] = best  // @best
                  root[i, j] = choice
          return e and root

      CONSTRUCT-OPTIMAL-BST(root, i, j, parent)
          if i ≤ j
              r = root[i, j]
              make kᵣ the root, or a child of parent  // @node
              CONSTRUCT-OPTIMAL-BST(root, i, r - 1, kᵣ)
              CONSTRUCT-OPTIMAL-BST(root, r + 1, j, kᵣ)
    `,
    python: `
      def optimal_bst(p, q):
          # p[1..n] and q[0..n]; p[0] is unused
          n = len(q) - 1
          e = [[0.0] * (n + 1) for _ in range(n + 2)]
          w = [[0.0] * (n + 1) for _ in range(n + 2)]
          root = [[0] * (n + 1) for _ in range(n + 1)]
          for i in range(1, n + 2):
              e[i][i - 1] = q[i - 1]  # @init
              w[i][i - 1] = q[i - 1]
          for l in range(1, n + 1):
              for i in range(1, n - l + 2):
                  j = i + l - 1
                  w[i][j] = w[i][j - 1] + p[j] + q[j]  # @weight
                  best, choice = float('inf'), None
                  for r in range(i, j + 1):
                      t = e[i][r - 1] + e[r + 1][j] + w[i][j]  # @try
                      if t < best:
                          best, choice = t, r
                  e[i][j], root[i][j] = best, choice  # @best
          return e, root

      def construct(root, i, j, parent, side, tree):
          if i <= j:
              r = root[i][j]
              tree.add(r, parent, side)  # @node
              construct(root, i, r - 1, r, 'left', tree)
              construct(root, r + 1, j, r, 'right', tree)
    `,
  },
  run({ p: given, q: gaps }, trace) {
    const n = given.length;
    // In hundredths; p[1..n], with p[0] unused, as in CLRS.
    const p = [0, ...given.map(hundredths)];
    const q = gaps.map(hundredths);
    const rows = Array.from({ length: n + 1 }, (_, k) => `${k + 1}`);
    const columns = Array.from({ length: n + 1 }, (_, k) => k);
    const empty = () => rows.map(() => columns.map((): number | null => null));
    const e = empty();
    const w = empty();
    const root = empty();
    const E = trace.add('e', {
      kind: 'table',
      label: 'e[i, j]: least expected cost on keys i to j',
      rows: n + 1,
      columns: n + 1,
      rowLabels: rows,
      columnLabels: columns,
    });
    const W = trace.add('w', {
      kind: 'table',
      label: 'w[i, j]: probability of the subtree',
      place: 'side',
      rows: n + 1,
      columns: n + 1,
      rowLabels: rows,
      columnLabels: columns,
    });
    const R = trace.add('root', {
      kind: 'table',
      label: 'root[i, j]',
      place: 'side',
      rows: n,
      columns: n,
      rowLabels: rows.slice(0, n),
      columnLabels: columns.slice(1),
    });
    const tree = trace.add('tree', {
      kind: 'tree',
      label: 'the optimal tree',
      place: 'side',
      binary: true,
    });
    // Cells: row i − 1 for i, column j for j; root's columns start at 1.
    const at = (i: number, j: number): [number, number] => [i - 1, j];
    const rootAt = (i: number, j: number): [number, number] => [i - 1, j - 1];

    trace.step(
      'init',
      `A range with no keys, e[i, i − 1], is the gap dᵢ₋₁ alone: its cost and weight are qᵢ₋₁, here ${q.map(show).join(', ')}.`,
      { vars: { n } },
    );
    for (let i = 1; i <= n + 1; i++) {
      e[i - 1]![i - 1] = q[i - 1]!;
      w[i - 1]![i - 1] = q[i - 1]!;
      E.set({ cell: at(i, i - 1), value: show(q[i - 1]!) });
      W.set({ cell: at(i, i - 1), value: show(q[i - 1]!) });
    }

    for (let l = 1; l <= n; l++)
      for (let i = 1; i <= n - l + 1; i++) {
        const j = i + l - 1;
        const weight = w[i - 1]![j - 1]! + p[j]! + q[j]!;
        w[i - 1]![j] = weight;
        trace.step(
          'weight',
          `w[${i}, ${j}] = w[${i}, ${j - 1}] + p${j} + q${j} = ${show(w[i - 1]![j - 1]!)} + ${show(p[j]!)} + ${show(q[j]!)} = ${show(weight)}.`,
          { vars: { i, j } },
        );
        W.set({ cell: at(i, j), value: show(weight) }).highlight({
          cells: [at(i, j - 1), at(i, j)],
        });
        let best = Infinity;
        let choice = i;
        for (let r = i; r <= j; r++) {
          const left = e[i - 1]![r - 1]!;
          const right = e[r]![j]!;
          const t = left + right + weight;
          trace.step(
            'try',
            `Keys ${i} to ${j} with root k${r}: e[${i}, ${r - 1}] + e[${r + 1}, ${j}] + w[${i}, ${j}] = ${show(left)} + ${show(right)} + ${show(weight)} = ${show(t)}${best === Infinity ? '' : t < best ? `, better than ${show(best)}` : `, no better than ${show(best)}`}.`,
            { vars: { i, j, r } },
          );
          E.depend({ cell: at(i, j), on: [at(i, r - 1), at(r + 1, j)] });
          if (t < best) {
            best = t;
            choice = r;
          }
        }
        e[i - 1]![j] = best;
        root[i - 1]![j - 1] = choice;
        trace.step(
          'best',
          `e[${i}, ${j}] = ${show(best)}, with k${choice} at the root: root[${i}, ${j}] = ${choice}.`,
          { vars: { i, j, r: choice } },
        );
        E.set({ cell: at(i, j), value: show(best) }).highlight({
          cells: [at(i, j)],
        });
        R.set({ cell: rootAt(i, j), value: choice }).highlight({
          cells: [rootAt(i, j)],
        });
      }

    const build = (
      i: number,
      j: number,
      parent: number | null,
      side: 'left' | 'right',
    ) => {
      if (i > j) return;
      const r = root[i - 1]![j - 1]!;
      trace.step(
        'node',
        parent === null
          ? `root[${i}, ${j}] = ${r}: k${r} is the root. The expected search cost is e[1, ${n}] = ${show(e[0]![n]!)}.`
          : `root[${i}, ${j}] = ${r}: k${r} is the ${side} child of k${parent}.`,
        { vars: { i, j, r } },
      );
      tree.addNode({
        node: { id: `k${r}`, value: `k${r}` },
        parent: parent === null ? null : `k${parent}`,
        ...(parent === null ? {} : { slot: side }),
      });
      tree.highlight({ nodes: [`k${r}`] });
      R.settle({ cells: [rootAt(i, j)] });
      build(i, r - 1, r, 'left');
      build(r + 1, j, r, 'right');
    };
    build(1, n, null, 'left');
    E.settle({ cells: [at(1, n)] });
  },
});
