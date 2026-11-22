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
  startOf,
  CITIES,
  declareGraph,
  Graph,
  graphOf,
  shown,
  type GraphInput,
} from './graph.ts';

export const prim = defineAlgorithm({
  id: 'prim',
  title: { en: 'Prim’s algorithm', zh: 'Prim 算法' },
  topic: 'graphs',
  summary: {
    en: 'Grows a minimum spanning tree from a root, adding the lightest edge from the tree to a vertex outside it at each step.',
    zh: '从一个根出发生长一棵最小生成树，每一步加入从树连到树外顶点的最轻的边。',
  },
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as undirected.'),
    root: z
      .string()
      .optional()
      .describe('The node to grow the tree from; by default the first node.'),
  }),
  main: 'graph',
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
    const r = startOf(g, input.root);
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
    trace.step('start', {
      en: `Every key is ∞, except the root ${r}'s, which is 0. Every vertex goes into the queue Q.`,
      zh: `除根 ${r} 的关键字为 0 外，每个顶点的关键字都是 ∞。所有顶点都进入队列 Q。`,
    });
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
          ? {
              en: `The lightest edge into the tree reaches ${u}, with weight ${key.get(u)}: add ${u} and that edge.`,
              zh: `连到树上最轻的边到达 ${u}，权重为 ${key.get(u)}：把 ${u} 和这条边加入树中。`,
            }
          : u === r
            ? {
                en: `Start the tree at the root ${r}.`,
                zh: `从根 ${r} 开始生长这棵树。`,
              }
            : {
                en: `${u} has key ∞: no edge joins it to the tree so far, so a new tree starts at ${u}.`,
                zh: `${u} 的关键字为 ∞：目前没有边把它连到树上，所以从 ${u} 开始一棵新树。`,
              },
      );
      graph.pointer({ name: 'u', node: u }).settle({ node: u });
      queueOf.extract();
      if (edge !== undefined) graph.markEdge({ edge, mark: 'selected' });
      for (const { to: v, weight, edge: e } of adj.get(u)!) {
        if (!queue.has(v)) {
          trace.step('check', {
            en: `${v} is in the tree already: skip it.`,
            zh: `${v} 已经在树中：跳过。`,
          });
          graph.highlight({ edges: [e] });
          continue;
        }
        if (weight >= key.get(v)!) {
          trace.step('check', {
            en: `${u}–${v} weighs ${weight}, no lighter than ${v}'s key ${shown(key.get(v)!)}: keep it.`,
            zh: `${u}–${v} 的权重是 ${weight}，不比 ${v} 的关键字 ${shown(key.get(v)!)} 轻：保持不变。`,
          });
          graph.highlight({ nodes: [v], edges: [e] });
          continue;
        }
        trace.step('lighter', {
          en: `${u}–${v} weighs ${weight}, lighter than ${shown(key.get(v)!)}: ${v}'s key becomes ${weight}, through ${u}.`,
          zh: `${u}–${v} 的权重是 ${weight}，比 ${shown(key.get(v)!)} 轻：${v} 经由 ${u}，关键字变为 ${weight}。`,
        });
        key.set(v, weight);
        via.set(v, e);
        graph
          .highlight({ nodes: [v], edges: [e] })
          .annotate({ node: v, text: String(weight) });
        queueOf.setKey({ id: v, key: weight });
      }
    }
    trace.step('done', {
      en: 'The queue is empty: the selected edges form a minimum spanning tree, or a forest if the graph is not connected.',
      zh: '队列已空：选中的边构成一棵最小生成树；如果图不连通，则构成一片最小生成森林。',
    });
    graph.pointer({ name: 'u', node: null });
  },
});
