/**
 * Transitive closure (CLRS 23.2): which vertices reach which, in a table
 * of 0s and 1s updated in place. Pass k allows paths through vertex k:
 * an entry becomes 1 when its row reaches k and k reaches its column.
 * Edges are taken as directed. A step shows each pass and each entry that
 * becomes 1, not each test that changes nothing.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { declareGraph, Graph, graphOf, type GraphInput } from './graph.ts';

export const transitiveClosure = defineAlgorithm({
  id: 'transitive-closure',
  title: { en: 'Transitive closure', zh: '传递闭包' },
  topic: 'graphs',
  summary: {
    en: 'Finds which vertices can reach which, in a table of 0s and 1s, allowing paths through one more vertex in each pass, as Floyd–Warshall does for distances.',
    zh: '在一张 0 和 1 的表中求出哪些顶点能到达哪些顶点，每一趟多允许路径经过一个顶点，和 Floyd–Warshall 算法处理距离的方式相同。',
  },
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as directed.'),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        directed: true,
        nodes: ['1', '2', '3', '4'],
        edges: [
          ['2', '3'],
          ['2', '4'],
          ['3', '2'],
          ['4', '1'],
          ['4', '3'],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      TRANSITIVE-CLOSURE(G, n)
          for i = 0 to n - 1
              for j = 0 to n - 1
                  if i = j or (i, j) is an edge of G
                      t[i][j] = 1  // @start
                  else t[i][j] = 0
          for k = 0 to n - 1  // @through
              for i = 0 to n - 1
                  for j = 0 to n - 1
                      t[i][j] = t[i][j] ∨ (t[i][k] ∧ t[k][j])  // @update
          return t  // @done
    `,
    python: `
      def transitive_closure(a):
          # a[i][j] is 1 when (i, j) is an edge
          n = len(a)
          t = [[int(i == j or a[i][j]) for j in range(n)] for i in range(n)]  # @start
          for k in range(n):  # @through
              for i in range(n):
                  for j in range(n):
                      t[i][j] = t[i][j] | (t[i][k] & t[k][j])  # @update
          return t  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    const n = g.nodes.length;
    const index = new Map(g.nodes.map((v, k) => [v, k]));
    const t = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (const [u, v] of g.edges) t[index.get(u)!]![index.get(v)!] = 1;
    const graph = trace.add('g', declareGraph(g, false));
    const table = trace.add('t', {
      kind: 'table',
      place: 'side',
      label: 't',
      initial: t.map((row) => [...row]),
      rowLabels: [...g.nodes],
      columnLabels: [...g.nodes],
    });
    trace.step('start', {
      en: `Start from the edges: 1 where an edge leads from the row to the column, and on the diagonal, since every vertex reaches itself; 0 elsewhere.${input.graph.directed === true ? '' : ' Each edge is taken one way, as it is listed.'}`,
      zh: `从边开始：有边从行顶点指向列顶点的地方为 1，对角线上也为 1，因为每个顶点都能到达自己；其余为 0。${input.graph.directed === true ? '' : '每条边只按列出的方向算一次。'}`,
    });
    for (let k = 0; k < n; k++) {
      const via = g.nodes[k]!;
      const added: [number, number][] = [];
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if (t[i]![j] === 0 && t[i]![k] === 1 && t[k]![j] === 1)
            added.push([i, j]);
      trace.step(
        'through',
        added.length === 0
          ? {
              en: `Allow paths through ${via}: no new pair is reached.`,
              zh: `允许路径经过 ${via}：没有新的可达顶点对。`,
            }
          : {
              en: `Allow paths through ${via}: a vertex that reaches ${via} now reaches everything ${via} reaches.`,
              zh: `允许路径经过 ${via}：能到达 ${via} 的顶点，现在也能到达 ${via} 能到达的所有顶点。`,
            },
        { vars: { k } },
      );
      graph.pointer({ name: 'k', node: via });
      for (const [i, j] of added) {
        const [a, b] = [g.nodes[i]!, g.nodes[j]!];
        trace.step(
          'update',
          {
            en: `${a} reaches ${via} and ${via} reaches ${b}, so ${a} reaches ${b}.`,
            zh: `${a} 能到达 ${via}，${via} 能到达 ${b}，所以 ${a} 能到达 ${b}。`,
          },
          { vars: { k, i, j } },
        );
        t[i]![j] = 1;
        table.set({ cell: [i, j], value: 1 }).depend({
          cell: [i, j],
          on: [
            [i, k],
            [k, j],
          ],
        });
        graph.highlight({ nodes: [a, via, b] });
      }
    }
    const pairs = t.flat().filter((x) => x === 1).length - n;
    trace.step('done', {
      en: `Every pass is done: the table says which vertex reaches which, ${pairs} ordered pair${pairs === 1 ? '' : 's'} of different vertices.`,
      zh: `所有趟都已完成：这张表给出了谁能到达谁，共有 ${pairs} 个不同顶点的有序对。`,
    });
    graph.pointer({ name: 'k', node: null });
    return { results: [pairs] };
  },
});
