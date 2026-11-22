/**
 * Bellman–Ford, as in CLRS (ADR 0023): relax every edge in each of |V| − 1
 * rounds, then check every edge once more; one that still improves a
 * distance shows a negative-weight cycle reachable from the source. Edges
 * are taken as directed. A step shows each round and each improvement,
 * not each test that improves nothing.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  startOf,
  declareGraph,
  edgeIds,
  Graph,
  graphOf,
  plus,
  shown,
  type GraphInput,
} from './graph.ts';

export const bellmanFord = defineAlgorithm({
  id: 'bellman-ford',
  title: { en: 'Bellman–Ford', zh: 'Bellman–Ford 算法' },
  topic: 'graphs',
  summary: {
    en: 'Finds shortest paths from a source even with negative weights, relaxing every edge |V| − 1 times, and reports a negative cycle.',
    zh: '求从一个源点出发的最短路径，允许边权为负：把每条边松弛 |V| − 1 次，并报告负权环。',
  },
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as directed.'),
    source: z
      .string()
      .optional()
      .describe(
        'The node to measure distances from; by default the first node.',
      ),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        nodes: ['s', 'a', 'b', 'c'],
        edges: [
          ['s', 'a', 4],
          ['s', 'b', 5],
          ['b', 'a', -3],
          ['a', 'c', 2],
        ],
      },
      source: 's',
    },
  ],
  code: {
    pseudocode: `
      BELLMAN-FORD(G, w, s)
          for each vertex v in G.V
              d[v] = ∞
              π[v] = NIL
          d[s] = 0  // @start
          for i = 1 to |G.V| - 1  // @round
              for each edge (u, v) in G.E
                  if d[u] + w(u, v) < d[v]
                      d[v] = d[u] + w(u, v)  // @improve
                      π[v] = u
          for each edge (u, v) in G.E  // @check
              if d[u] + w(u, v) < d[v]
                  return FALSE  // @cycle
          return TRUE  // @done
    `,
    python: `
      def bellman_ford(g, s):
          d = {v: float('inf') for v in g}
          parent = {v: None for v in g}
          d[s] = 0  # @start
          for i in range(1, len(g)):  # @round
              for u, v, w in g.edges:
                  if d[u] + w < d[v]:
                      d[v] = d[u] + w  # @improve
                      parent[v] = u
          for u, v, w in g.edges:  # @check
              if d[u] + w < d[v]:
                  return False  # @cycle
          return True  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    const s = startOf(g, input.source);
    const graph = trace.add('g', declareGraph(g, true));
    const ids = edgeIds(g);
    const d = new Map(g.nodes.map((v) => [v, v === s ? 0 : Infinity]));
    const via = new Map<string, string>();
    const better = (u: string, v: string, w: number) =>
      d.get(u)! + w < d.get(v)!;
    trace.step('start', {
      en: `Every distance is ∞, except ${s}'s, which is 0.`,
      zh: `除 ${s} 的距离为 0 外，每个顶点的距离都是 ∞。`,
    });
    for (const v of g.nodes)
      graph.annotate({ node: v, text: shown(d.get(v)!) });
    for (let i = 1; i < g.nodes.length; i++) {
      // Whether this round improves anything, for its narration.
      const probe = new Map(d);
      const improves = g.edges.some(([u, v, w = 1]) => {
        const c = probe.get(u)! + w;
        if (c >= probe.get(v)!) return false;
        probe.set(v, c);
        return true;
      });
      trace.step(
        'round',
        improves
          ? {
              en: `Round ${i} of ${g.nodes.length - 1}: relax every edge in turn.`,
              zh: `第 ${i} 轮，共 ${g.nodes.length - 1} 轮：依次松弛每条边。`,
            }
          : {
              en: `Round ${i} of ${g.nodes.length - 1}: no edge improves a distance.`,
              zh: `第 ${i} 轮，共 ${g.nodes.length - 1} 轮：没有边能改进距离。`,
            },
        { vars: { i } },
      );
      for (const [k, [u, v, w = 1]] of g.edges.entries()) {
        if (!better(u, v, w)) continue;
        const edge = ids[k]!;
        const du = d.get(u)!;
        d.set(v, du + w);
        trace.step(
          'improve',
          {
            en: `${du} ${plus(w)} = ${du + w} improves ${v} to ${du + w}, through ${u}.`,
            zh: `${du} ${plus(w)} = ${du + w}：${v} 经由 ${u} 改进为 ${du + w}。`,
          },
          { vars: { i } },
        );
        graph
          .highlight({ nodes: [v], edges: [edge] })
          .annotate({ node: v, text: String(d.get(v)) });
        const old = via.get(v);
        if (old !== undefined) graph.markEdge({ edge: old, mark: null });
        via.set(v, edge);
        graph.markEdge({ edge, mark: 'selected' });
      }
    }
    trace.step('check', {
      en: 'Check every edge once more for one that still improves.',
      zh: '再检查一遍每条边，看是否还有能改进距离的。',
    });
    for (const [k, [u, v, w = 1]] of g.edges.entries())
      if (better(u, v, w)) {
        trace.step('cycle', {
          en: `${u} → ${v} still improves ${v}: a negative-weight cycle is reachable from ${s}.`,
          zh: `${u} → ${v} 仍能改进 ${v}：从 ${s} 可以到达一个负权环。`,
        });
        graph
          .highlight({ edges: [ids[k]!] })
          .markEdge({ edge: ids[k]!, mark: 'rejected' });
        return;
      }
    trace.step('done', {
      en: 'No edge improves any more: the distances are final.',
      zh: '没有边还能改进距离：所有距离都已确定。',
    });
    for (const v of g.nodes)
      if (d.get(v) !== Infinity) graph.settle({ node: v });
  },
});
