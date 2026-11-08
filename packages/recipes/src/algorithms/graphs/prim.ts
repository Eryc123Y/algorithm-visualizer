/**
 * Prim's algorithm, as in CLRS (ADR 0023): every key starts at ∞ but the
 * root's, which is 0; then the vertex of least key leaves a min-priority
 * queue and joins the tree by the edge to its parent π, and its neighbours
 * still in the queue get lighter keys where its edges are lighter. A
 * vertex that leaves with key ∞ starts a new tree, so a disconnected graph
 * gives a minimum spanning forest. Edges are taken as undirected.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  adjacency,
  checkNode,
  CITIES,
  declareGraph,
  Graph,
  graphOf,
  shown,
  type GraphInput,
} from './graph.ts';

export const prim = defineAlgorithm({
  id: 'prim',
  title: 'Prim’s algorithm',
  topic: 'graphs',
  summary:
    'Grows a minimum spanning tree from a root, adding the lightest edge from the tree to a vertex outside it at each step.',
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as undirected.'),
    root: z.string().describe('The node to grow the tree from.'),
  }),
  examples: [{ graph: CITIES, root: 'A' }],
  code: {
    pseudocode: `
      MST-PRIM(G, w, r)
          for each vertex u in G.V
              key[u] = ∞
              π[u] = NIL
          key[r] = 0  // @start
          Q = a min-priority queue of G.V, keyed by key
          while Q is not empty  // @done
              u = EXTRACT-MIN(Q)  // @extract
              for each neighbour v of u
                  if v ∈ Q and w(u, v) < key[v]  // @check
                      π[v] = u  // @lighter
                      key[v] = w(u, v)
                      DECREASE-KEY(Q, v, key[v])
    `,
    python: `
      def prim(g, r):
          key = {v: float('inf') for v in g}
          parent = {v: None for v in g}
          key[r] = 0  # @start
          queue = list(g)
          while queue:  # @done
              u = min(queue, key=key.get)  # @extract
              queue.remove(u)
              for v, w in g.neighbors(u):
                  if v in queue and w < key[v]:  # @check
                      parent[v] = u  # @lighter
                      key[v] = w
          return parent
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: false };
    const r = input.root;
    checkNode(g, r);
    const graph = trace.add('g', declareGraph(g, true));
    // Q in the side panel, every vertex keyed by its key (ADR 0029).
    const queueOf = trace.add('Q', {
      kind: 'priorityQueue',
      place: 'side',
      initial: [],
    });
    const adj = adjacency(g);
    const key = new Map(g.nodes.map((v) => [v, v === r ? 0 : Infinity]));
    const via = new Map<string, string>();
    const queue = new Set(g.nodes);
    trace.step(
      'start',
      `Every key is ∞, except the root ${r}'s, which is 0. Every vertex goes into the queue Q.`,
    );
    for (const v of g.nodes) {
      graph.annotate({ node: v, text: shown(key.get(v)!) });
      queueOf.insert({
        element: { id: v, value: v },
        key: v === r ? 0 : null,
      });
    }
    while (queue.size > 0) {
      // The least key; ties go to the vertex listed first.
      const u = [...queue].reduce((a, b) =>
        key.get(b)! < key.get(a)! ? b : a,
      );
      queue.delete(u);
      const edge = via.get(u);
      trace.step(
        'extract',
        edge !== undefined
          ? `The lightest edge into the tree reaches ${u}, with weight ${key.get(u)}: add ${u} and that edge.`
          : u === r
            ? `Start the tree at the root ${r}.`
            : `${u} has key ∞: no edge joins it to the tree so far, so a new tree starts at ${u}.`,
      );
      graph.pointer({ name: 'u', node: u }).settle({ node: u });
      queueOf.extract();
      if (edge !== undefined) graph.markEdge({ edge, mark: 'selected' });
      for (const { to: v, weight, edge: e } of adj.get(u)!) {
        if (!queue.has(v)) {
          trace.step('check', `${v} is in the tree already: skip it.`);
          graph.highlight({ edges: [e] });
          continue;
        }
        if (weight >= key.get(v)!) {
          trace.step(
            'check',
            `${u}–${v} weighs ${weight}, no lighter than ${v}'s key ${shown(key.get(v)!)}: keep it.`,
          );
          graph.highlight({ nodes: [v], edges: [e] });
          continue;
        }
        trace.step(
          'lighter',
          `${u}–${v} weighs ${weight}, lighter than ${shown(key.get(v)!)}: ${v}'s key becomes ${weight}, through ${u}.`,
        );
        key.set(v, weight);
        via.set(v, e);
        graph
          .highlight({ nodes: [v], edges: [e] })
          .annotate({ node: v, text: String(weight) });
        queueOf.setKey({ id: v, key: weight });
      }
    }
    trace.step(
      'done',
      'The queue is empty: the selected edges form a minimum spanning tree, or a forest if the graph is not connected.',
    );
    graph.pointer({ name: 'u', node: null });
  },
});
