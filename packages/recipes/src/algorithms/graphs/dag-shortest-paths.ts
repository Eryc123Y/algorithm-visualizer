/**
 * Single-source shortest paths in a directed acyclic graph (CLRS 22.4):
 * take the vertices in topological order and relax the edges out of each
 * once. A vertex's distance is final when its turn comes, since every
 * edge into it leaves a vertex before it. Weights may be negative; a
 * graph with a cycle is refused, naming the cycle.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  adjacency,
  declareGraph,
  Graph,
  graphOf,
  plus,
  shown,
  startOf,
  type GraphInput,
} from './graph.ts';
import { checkAcyclic } from './topological-sort.ts';

/** A topological order: reverse finishing order of a depth-first search. */
export function topologicalOrder(g: GraphInput): string[] {
  const adj = adjacency(g);
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (u: string): void => {
    seen.add(u);
    for (const { to } of adj.get(u)!) if (!seen.has(to)) visit(to);
    order.unshift(u);
  };
  for (const u of g.nodes) if (!seen.has(u)) visit(u);
  return order;
}

/** CLRS's Figure 22.6, with letters for its vertices. */
export const DAG_EXAMPLE: z.output<typeof Graph> = {
  directed: true,
  nodes: ['r', 's', 't', 'x', 'y', 'z'],
  edges: [
    ['r', 's', 5],
    ['r', 't', 3],
    ['s', 't', 2],
    ['s', 'x', 6],
    ['t', 'x', 7],
    ['t', 'y', 4],
    ['t', 'z', 2],
    ['x', 'y', -1],
    ['x', 'z', 1],
    ['y', 'z', -2],
  ],
};

export const dagShortestPaths = defineAlgorithm({
  id: 'dag-shortest-paths',
  title: 'Shortest paths in a DAG',
  topic: 'graphs',
  summary:
    'Finds shortest paths from a source in a directed acyclic graph, even with negative weights, by relaxing the edges out of each vertex once, in topological order.',
  input: z.strictObject({
    graph: Graph.describe(
      'A graph whose edges are taken as directed, with no cycle.',
    ),
    source: z
      .string()
      .optional()
      .describe(
        'The node to measure distances from; by default the first node.',
      ),
  }),
  main: 'graph',
  examples: [{ graph: DAG_EXAMPLE, source: 's' }],
  code: {
    pseudocode: `
      DAG-SHORTEST-PATHS(G, w, s)
          topologically sort the vertices of G  // @sort
          for each vertex v in G.V
              d[v] = ∞
              π[v] = NIL
          d[s] = 0  // @start
          for each vertex u, in topological order  // @vertex
              for each edge (u, v) in G.E
                  if d[u] + w(u, v) < d[v]  // @relax
                      d[v] = d[u] + w(u, v)  // @improve
                      π[v] = u
          return d, π  // @done
    `,
    python: `
      def dag_shortest_paths(g, s):
          order = topological_sort(g)  # @sort
          d = {v: float('inf') for v in g}
          parent = {v: None for v in g}
          d[s] = 0  # @start
          for u in order:  # @vertex
              for v, w in g.out_edges(u):
                  if d[u] + w < d[v]:  # @relax
                      d[v] = d[u] + w  # @improve
                      parent[v] = u
          return d, parent  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    checkAcyclic(g);
    const s = startOf(g, input.source);
    const order = topologicalOrder(g);
    const graph = trace.add('g', declareGraph(g, true, { from: order[0]! }));
    const list = trace.add('order', {
      kind: 'array',
      place: 'side',
      label: 'topological order',
      initial: order.map((v) => ({ id: `o-${v}`, value: v })),
    });
    const adj = adjacency(g);
    const d = new Map(g.nodes.map((v) => [v, v === s ? 0 : Infinity]));
    const via = new Map<string, string>();
    trace.step(
      'sort',
      `Sort the vertices topologically, by a depth-first search: ${order.join(', ')}. Every edge goes forward in this order.`,
    );
    trace.step('start', `Every distance is ∞, except ${s}'s, which is 0.`);
    for (const v of g.nodes)
      graph.annotate({ node: v, text: shown(d.get(v)!) });
    order.forEach((u, k) => {
      const du = d.get(u)!;
      trace.step(
        'vertex',
        du === Infinity
          ? `${u} is next, but no path from ${s} reaches it: its edges improve nothing.`
          : `${u} is next: every edge into it has been relaxed, so its distance ${du} is final. Relax the edges out of it.`,
      );
      list.highlight({ indices: [k] });
      graph.pointer({ name: 'u', node: u });
      if (du !== Infinity) graph.settle({ node: u });
      if (du === Infinity) return;
      for (const { to: v, weight: w, edge } of adj.get(u)!) {
        const before = d.get(v)!;
        if (du + w >= before) {
          trace.step(
            'relax',
            `${du} ${plus(w)} = ${du + w} is not less than ${shown(before)}: ${v} keeps its distance.`,
          );
          graph.highlight({ nodes: [v], edges: [edge] });
          continue;
        }
        d.set(v, du + w);
        trace.step(
          'improve',
          `${du} ${plus(w)} = ${du + w} is less than ${shown(before)}: ${v} improves to ${du + w}, through ${u}.`,
        );
        graph
          .highlight({ nodes: [v], edges: [edge] })
          .annotate({ node: v, text: String(du + w) });
        const old = via.get(v);
        if (old !== undefined) graph.markEdge({ edge: old, mark: null });
        via.set(v, edge);
        graph.markEdge({ edge, mark: 'selected' });
      }
    });
    trace.step(
      'done',
      'Every vertex has had its turn: the distances are final, and the marked edges form a shortest-path tree.',
    );
    graph.pointer({ name: 'u', node: null });
  },
});
