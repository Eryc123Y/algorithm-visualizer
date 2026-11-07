/**
 * Floyd–Warshall (ADR 0023): all-pairs shortest paths in one distance
 * matrix, updated in place. Pass k allows paths through vertex k, and
 * d[i][j] drops to d[i][k] + d[k][j] where that is shorter. Entries that
 * cannot change are skipped: through-paths of ∞, and row and column k
 * unless d[k][k] < 0. A negative diagonal entry shows a negative-weight
 * cycle.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { declareGraph, Graph, graphOf, shown } from './graph.ts';

export const floydWarshall = defineAlgorithm({
  id: 'floyd-warshall',
  title: 'Floyd–Warshall',
  topic: 'graphs',
  summary:
    'Finds shortest paths between all pairs of vertices in a distance table, allowing paths through one more vertex in each pass.',
  input: z.strictObject({ graph: Graph }),
  examples: [
    {
      graph: {
        directed: true,
        nodes: ['1', '2', '3', '4'],
        edges: [
          ['1', '3', -2],
          ['3', '4', 2],
          ['4', '2', -1],
          ['2', '1', 4],
          ['2', '3', 3],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      FLOYD-WARSHALL(W, n)
          d = a copy of W  // @start
          for k = 0 to n - 1  // @through
              for i = 0 to n - 1
                  for j = 0 to n - 1
                      if d[i][k] + d[k][j] < d[i][j]  // @compare
                          d[i][j] = d[i][k] + d[k][j]  // @update
          return d  // @done
    `,
    python: `
      def floyd_warshall(w):
          d = [row[:] for row in w]  # @start
          n = len(d)
          for k in range(n):  # @through
              for i in range(n):
                  for j in range(n):
                      if d[i][k] + d[k][j] < d[i][j]:  # @compare
                          d[i][j] = d[i][k] + d[k][j]  # @update
          return d  # @done
    `,
  },
  run(input, trace) {
    const g = graphOf(input.graph);
    const n = g.nodes.length;
    const index = new Map(g.nodes.map((v, k) => [v, k]));
    const d = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
    );
    for (const [u, v, w = 1] of g.edges) {
      const [i, j] = [index.get(u)!, index.get(v)!];
      d[i]![j] = Math.min(d[i]![j]!, w);
      if (!g.directed) d[j]![i] = Math.min(d[j]![i]!, w);
    }
    const graph = trace.add('g', declareGraph(g, true));
    const table = trace.add('dist', {
      kind: 'table',
      initial: d.map((row) => row.map((x) => (x === Infinity ? '∞' : x))),
      rowLabels: [...g.nodes],
      columnLabels: [...g.nodes],
    });
    trace.step(
      'start',
      'Start from the edge weights: 0 on the diagonal, ∞ where there is no edge.',
    );
    for (let k = 0; k < n; k++) {
      const via = g.nodes[k]!;
      trace.step('through', `Allow paths through ${via}.`, { vars: { k } });
      graph.pointer({ name: 'k', node: via });
      // Row and column k can only improve through a negative cycle at k.
      const cycleAtK = d[k]![k]! < 0;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          if ((i === k || j === k) && !cycleAtK) continue;
          const through = d[i]![k]! + d[k]![j]!;
          if (through === Infinity) continue;
          const better = through < d[i]![j]!;
          const path = `${g.nodes[i]} → ${via} → ${g.nodes[j]}`;
          trace.step(
            better ? 'update' : 'compare',
            better
              ? `${path} costs ${through}, less than ${shown(d[i]![j]!)}: update the entry.`
              : `${path} costs ${through}, no less than ${d[i]![j]}: keep it.`,
            { vars: { k, i, j } },
          );
          table.depend({
            cell: [i, j],
            on: [
              [i, k],
              [k, j],
            ],
          });
          if (better) {
            d[i]![j] = through;
            table.set({ cell: [i, j], value: through });
          }
        }
    }
    const negative = g.nodes.filter((_, i) => d[i]![i]! < 0);
    trace.step(
      'done',
      negative.length === 0
        ? 'Every pass is done: each entry is a shortest distance.'
        : `Negative diagonal entries (${negative.join(', ')}) show a negative-weight cycle: paths through it have no shortest length.`,
    );
    if (negative.length > 0)
      table.highlight({
        cells: negative.map((v) => [index.get(v)!, index.get(v)!]),
      });
    graph.pointer({ name: 'k', node: null });
  },
});
