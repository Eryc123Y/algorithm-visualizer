/**
 * Topological sort, as in CLRS (ADR 0023): a depth-first search that puts
 * each vertex at the front of a list as it finishes, so every edge points
 * forward in the list. Edges are taken as directed. A graph with a cycle
 * has no topological order, so it is refused, naming a cycle.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { callStack } from '../../call-stack.ts';
import {
  adjacency,
  CLOTHES,
  declareGraph,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

/** Throws a RangeError naming a cycle of `g`, if it has one. */
export function checkAcyclic(g: GraphInput): void {
  const adj = adjacency(g);
  const state = new Map<string, 'open' | 'done'>();
  const path: string[] = [];
  const visit = (u: string): void => {
    state.set(u, 'open');
    path.push(u);
    for (const { to: v } of adj.get(u)!) {
      if (state.get(v) === 'open') {
        const cycle = [...path.slice(path.indexOf(v)), v];
        throw new RangeError(
          `The graph has a cycle, ${cycle.join(' → ')}, so it has no topological order`,
        );
      }
      if (!state.has(v)) visit(v);
    }
    path.pop();
    state.set(u, 'done');
  };
  for (const u of g.nodes) if (!state.has(u)) visit(u);
}

export const topologicalSort = defineAlgorithm({
  id: 'topological-sort',
  title: { en: 'Topological sort', zh: '拓扑排序' },
  topic: 'graphs',
  summary: {
    en: 'Orders the vertices of a directed acyclic graph so that every edge points forward, by listing them in reverse order of finishing a depth-first search.',
    zh: '对有向无环图的顶点排序，使每条边都指向前方：按深度优先搜索完成时间的逆序列出顶点。',
  },
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as directed.'),
  }),
  main: 'graph',
  examples: [{ graph: CLOTHES }],
  code: {
    pseudocode: `
      TOPOLOGICAL-SORT(G)
          L = an empty linked list
          for each vertex u in G.V
              color[u] = WHITE
          for each vertex u in G.V
              if color[u] == WHITE  // @root
                  TOPOLOGICAL-VISIT(G, u, L)
          return L  // @done

      TOPOLOGICAL-VISIT(G, u, L)
          color[u] = GRAY  // @discover
          for each neighbour v of u
              if color[v] == WHITE  // @edge
                  TOPOLOGICAL-VISIT(G, v, L)
          color[u] = BLACK
          insert u at the front of L  // @finish
    `,
    python: `
      from collections import deque

      def topological_sort(g):
          order, seen = deque(), set()
          for u in g:
              if u not in seen:  # @root
                  visit(g, u, seen, order)
          return list(order)  # @done

      def visit(g, u, seen, order):
          seen.add(u)  # @discover
          for v in g.neighbors(u):
              if v not in seen:  # @edge
                  visit(g, v, seen, order)
          order.appendleft(u)  # @finish
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    checkAcyclic(g);
    const graph = trace.add('g', declareGraph(g, false));
    const order = trace.add('order', {
      kind: 'array',
      label: 'L',
      initial: [],
    });
    // The calls of TOPOLOGICAL-VISIT, as dfs draws them (ADR 0029).
    const calls = callStack(trace);
    const adj = adjacency(g);
    const seen = new Set<string>();
    const visit = (u: string): void => {
      seen.add(u);
      trace.step('discover', { en: `Visit ${u}.`, zh: `访问 ${u}。` });
      calls.push(`call-${u}`, `visit ${u}`);
      graph.visit({ node: u }).pointer({ name: 'u', node: u });
      for (const { to: v, edge } of adj.get(u)!) {
        const fresh = !seen.has(v);
        trace.step(
          'edge',
          fresh
            ? {
                en: `${u} → ${v}: ${v} is not visited yet, so visit it first.`,
                zh: `${u} → ${v}：${v} 还没有访问过，先访问它。`,
              }
            : {
                en: `${u} → ${v}: ${v} is in the list already, after where ${u} will go.`,
                zh: `${u} → ${v}：${v} 已经在列表中，位于 ${u} 将要放的位置之后。`,
              },
        );
        graph.pointer({ name: 'u', node: u }).highlight({ edges: [edge] });
        if (fresh) {
          graph.markEdge({ edge, mark: 'selected' });
          visit(v);
        }
      }
      trace.step('finish', {
        en: `Everything after ${u} is listed: put ${u} at the front of the list.`,
        zh: `${u} 之后的顶点都已列出：把 ${u} 放到列表最前面。`,
      });
      graph.pointer({ name: 'u', node: u }).settle({ node: u });
      order.insert({ index: 0, element: { id: `o-${u}`, value: u } });
      calls.pop();
    };
    for (const u of g.nodes) {
      if (seen.has(u)) continue;
      trace.step('root', {
        en: `${u} is not visited yet: start a search there.`,
        zh: `${u} 还没有访问过：从它开始一次搜索。`,
      });
      visit(u);
    }
    trace.step('done', {
      en: 'Every vertex is in the list, and every edge points forward in it: a topological order.',
      zh: '所有顶点都在列表中，每条边都指向前方：这就是一个拓扑序。',
    });
    graph.pointer({ name: 'u', node: null });
  },
});
