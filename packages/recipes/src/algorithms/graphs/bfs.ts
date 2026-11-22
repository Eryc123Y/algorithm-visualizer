/**
 * Breadth-first search, as in CLRS (ADR 0023): vertices start white, turn
 * grey when found and black when every neighbour has been looked at. Each
 * found vertex gets its distance d and the edge to its parent π, which
 * together form a breadth-first tree; the queue is shown beside the graph.
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
} from './graph.ts';

export const bfs = defineAlgorithm({
  id: 'bfs',
  title: { en: 'Breadth-first search', zh: '广度优先搜索' },
  topic: 'graphs',
  summary: {
    en: 'Explores a graph in layers from a source with a queue, finding each vertex’s distance in edges and a breadth-first tree.',
    zh: '用一个队列从源点出发逐层探索图，求出每个顶点以边数计的距离，以及一棵广度优先树。',
  },
  input: z.strictObject({
    graph: Graph,
    source: z
      .string()
      .optional()
      .describe('The node to start from; by default the first node.'),
  }),
  main: 'graph',
  examples: [{ graph: CITIES, source: 'A' }],
  code: {
    pseudocode: `
      BFS(G, s)
          for each vertex v in G.V
              d[v] = ∞
              π[v] = NIL
              color[v] = WHITE
          d[s] = 0  // @start
          color[s] = GRAY
          Q = a queue that holds only s
          while Q is not empty
              u = DEQUEUE(Q)  // @dequeue
              for each neighbour v of u
                  if color[v] == WHITE  // @seen
                      d[v] = d[u] + 1  // @discover
                      π[v] = u
                      color[v] = GRAY
                      ENQUEUE(Q, v)
              color[u] = BLACK  // @finish
    `,
    python: `
      from collections import deque

      def bfs(g, s):
          d, parent = {s: 0}, {s: None}  # @start
          queue, finished = deque([s]), set()
          while queue:
              u = queue.popleft()  # @dequeue
              for v in g.neighbors(u):
                  if v not in d:  # @seen
                      d[v] = d[u] + 1  # @discover
                      parent[v] = u
                      queue.append(v)
              finished.add(u)  # @finish
          return d, parent
    `,
  },
  run(input, trace) {
    const g = graphOf(input.graph);
    const s = startOf(g, input.source);
    // Rows of the layered layout are the layers from the source.
    const graph = trace.add('g', declareGraph(g, false, { from: s }));
    const queue = trace.add('queue', {
      kind: 'queue',
      label: 'Q',
      place: 'side',
      initial: [],
    });
    const adj = adjacency(g);
    const d = new Map([[s, 0]]);
    const q = [s];
    trace.step('start', {
      en: `Start at ${s}, at distance 0.`,
      zh: `从 ${s} 开始，距离为 0。`,
    });
    graph.visit({ node: s }).annotate({ node: s, text: '0' });
    queue.enqueue({ element: { id: `q-${s}`, value: s } });
    while (q.length > 0) {
      const u = q.shift()!;
      trace.step('dequeue', {
        en: `Take ${u} from the front of the queue.`,
        zh: `从队头取出 ${u}。`,
      });
      queue.dequeue();
      graph.pointer({ name: 'u', node: u });
      for (const { to: v, edge } of adj.get(u)!) {
        if (d.has(v)) {
          trace.step('seen', {
            en: `${v} was found already: skip it.`,
            zh: `${v} 已经发现过：跳过。`,
          });
          graph.highlight({ edges: [edge] });
          continue;
        }
        d.set(v, d.get(u)! + 1);
        q.push(v);
        trace.step('discover', {
          en: `Found ${v}, at distance ${d.get(v)}: its parent is ${u}.`,
          zh: `发现 ${v}，距离为 ${d.get(v)}：它的父节点是 ${u}。`,
        });
        graph
          .highlight({ edges: [edge] })
          .visit({ node: v })
          .annotate({ node: v, text: String(d.get(v)) })
          .markEdge({ edge, mark: 'selected' });
        queue.enqueue({ element: { id: `q-${v}`, value: v } });
      }
      trace.step('finish', {
        en: `Every neighbour of ${u} is found: ${u} is done.`,
        zh: `${u} 的邻居都已发现：${u} 处理完毕。`,
      });
      graph.settle({ node: u });
    }
    graph.pointer({ name: 'u', node: null });
  },
});
