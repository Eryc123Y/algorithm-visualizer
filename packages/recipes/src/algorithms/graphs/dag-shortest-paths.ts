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
  startOf,
  type GraphInput,
} from './graph.ts';
import { checkAcyclic } from './topological-sort.ts';

/** A topological order: reverse finishing order of a depth-first search. */
export function topologicalOrder(g: GraphInput): string[] {
  const adj = adjacency(g);
  const seen = new Set<string>();
  const finished: string[] = [];
  const visit = (u: string): void => {
    seen.add(u);
    for (const { to } of adj.get(u)!) if (!seen.has(to)) visit(to);
    finished.push(u);
  };
  for (const u of g.nodes) if (!seen.has(u)) visit(u);
  return finished.reverse();
}

/**
 * A distance for narrations and notes: ∞, or the number rounded to 12
 * significant digits, so sums of decimals print as written, with a true
 * minus sign, as `plus` writes them.
 */
const num = (x: number): string => {
  if (x === Infinity) return '∞';
  const r = Number(x.toPrecision(12));
  return r < 0 ? `−${-r}` : String(r);
};

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
          put the vertices in an order where every edge goes forward  // @sort
          for each vertex v in G.V
              d[v] = ∞
              π[v] = NIL
          d[s] = 0  // @start
          for each vertex u, taken in that order  // @vertex
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
    for (const v of g.nodes) graph.annotate({ node: v, text: num(d.get(v)!) });
    order.forEach((u, k) => {
      const du = d.get(u)!;
      if (du === Infinity) {
        trace.step(
          'vertex',
          `${u} is next, but no path from ${s} reaches it: its edges improve nothing.`,
        );
        list.highlight({ indices: [k] });
        graph.pointer({ name: 'u', node: u });
        return;
      }
      trace.step(
        'vertex',
        `${u} is next: every edge into it has been relaxed, so its distance ${num(du)} is final. Relax the edges out of it.`,
      );
      list.highlight({ indices: [k] });
      graph.pointer({ name: 'u', node: u }).settle({ node: u });
      for (const { to: v, weight: w, edge } of adj.get(u)!) {
        const before = d.get(v)!;
        if (du + w >= before) {
          trace.step(
            'relax',
            `${num(du)} ${plus(w)} = ${num(du + w)} is not less than ${num(before)}: ${v} keeps its distance.`,
          );
          graph.highlight({ nodes: [v], edges: [edge] });
          continue;
        }
        d.set(v, du + w);
        trace.step(
          'improve',
          `${num(du)} ${plus(w)} = ${num(du + w)} is less than ${num(before)}: ${v} improves to ${num(du + w)}, through ${u}.`,
        );
        graph
          .highlight({ nodes: [v], edges: [edge] })
          .annotate({ node: v, text: num(du + w) });
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
