/**
 * Dijkstra's algorithm, as in CLRS (ADR 0023): every distance starts at ∞
 * but the source's, which is 0; then the vertex of least distance leaves a
 * min-priority queue, its distance is final, and every edge leaving it is
 * relaxed. A vertex that leaves with distance ∞ is unreachable. Weights
 * must not be negative; Bellman–Ford takes those. The queue Q is drawn in
 * the side panel, every vertex with its distance as its key (ADR 0029).
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  adjacency,
  startOf,
  CITIES,
  declareGraph,
  Graph,
  graphOf,
  shown,
} from './graph.ts';

export const dijkstra = defineAlgorithm({
  id: 'dijkstra',
  title: 'Dijkstra’s algorithm',
  topic: 'graphs',
  summary:
    'Finds shortest paths from a source in a graph with non-negative weights, fixing the closest remaining vertex at each step.',
  input: z.strictObject({
    graph: Graph,
    source: z
      .string()
      .optional()
      .describe(
        'The node to measure distances from; by default the first node.',
      ),
  }),
  main: 'graph',
  examples: [{ graph: CITIES, source: 'A' }],
  code: {
    pseudocode: `
      DIJKSTRA(G, w, s)
          for each vertex v in G.V
              d[v] = ∞
              π[v] = NIL
          d[s] = 0  // @start
          Q = a min-priority queue of G.V, keyed by d
          while Q is not empty  // @done
              u = EXTRACT-MIN(Q)  // @extract
              for each neighbour v of u
                  if d[u] + w(u, v) < d[v]  // @relax
                      d[v] = d[u] + w(u, v)  // @improve
                      π[v] = u
                      DECREASE-KEY(Q, v, d[v])
    `,
    python: `
      def dijkstra(g, s):
          d = {v: float('inf') for v in g}
          parent = {v: None for v in g}
          d[s] = 0  # @start
          queue = list(g)
          while queue:  # @done
              u = min(queue, key=d.get)  # @extract
              queue.remove(u)
              for v, w in g.neighbors(u):
                  if d[u] + w < d[v]:  # @relax
                      d[v] = d[u] + w  # @improve
                      parent[v] = u
          return d, parent
    `,
  },
  run(input, trace) {
    const g = graphOf(input.graph);
    const s = startOf(g, input.source);
    if (g.edges.some(([, , w = 1]) => w < 0))
      throw new RangeError(
        'Dijkstra’s algorithm needs non-negative weights; use bellman-ford for negative ones',
      );
    const graph = trace.add('g', declareGraph(g, true));
    const queueOf = trace.add('Q', {
      kind: 'priorityQueue',
      place: 'side',
      initial: [],
    });
    const adj = adjacency(g);
    const d = new Map(g.nodes.map((v) => [v, v === s ? 0 : Infinity]));
    const via = new Map<string, string>();
    const queue = new Set(g.nodes);
    trace.step(
      'start',
      `Every distance is ∞, except ${s}'s, which is 0. Every vertex goes into the queue Q, keyed by its distance.`,
    );
    for (const v of g.nodes) {
      graph.annotate({ node: v, text: shown(d.get(v)!) });
      queueOf.insert({
        element: { id: v, value: v },
        key: v === s ? 0 : null,
      });
    }
    while (queue.size > 0) {
      // The least distance; ties go to the vertex listed first.
      const u = [...queue].reduce((a, b) => (d.get(b)! < d.get(a)! ? b : a));
      queue.delete(u);
      const du = d.get(u)!;
      if (du === Infinity) {
        trace.step(
          'extract',
          `${u} leaves the queue with distance ∞: it cannot be reached from ${s}.`,
        );
        graph.pointer({ name: 'u', node: u });
        queueOf.extract();
        continue;
      }
      trace.step(
        'extract',
        `${u} has the least distance left, ${du}: it is final.`,
      );
      graph.pointer({ name: 'u', node: u }).settle({ node: u });
      queueOf.extract();
      for (const { to: v, weight, edge } of adj.get(u)!) {
        const c = du + weight;
        const dv = d.get(v)!;
        if (c >= dv) {
          trace.step(
            'relax',
            `${du} + ${weight} = ${c} ≥ ${shown(dv)}: keep ${v} at ${shown(dv)}.`,
          );
          graph.highlight({ nodes: [v], edges: [edge] });
          continue;
        }
        trace.step(
          'improve',
          `${du} + ${weight} = ${c} < ${shown(dv)}: ${v} improves to ${c}, through ${u}.`,
        );
        const old = via.get(v);
        if (old !== undefined) graph.markEdge({ edge: old, mark: null });
        d.set(v, c);
        via.set(v, edge);
        graph
          .highlight({ nodes: [v], edges: [edge] })
          .annotate({ node: v, text: String(c) })
          .markEdge({ edge, mark: 'selected' });
        queueOf.setKey({ id: v, key: c });
      }
    }
    trace.step(
      'done',
      'The queue is empty: every distance is final, and the selected edges form a shortest-path tree.',
    );
    graph.pointer({ name: 'u', node: null });
  },
});
