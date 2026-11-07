/**
 * Topological sort, as in CLRS (ADR 0023): a depth-first search that puts
 * each vertex at the front of a list as it finishes, so every edge points
 * forward in the list. Edges are taken as directed. A graph with a cycle
 * has no topological order, so it is refused, naming a cycle.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  adjacency,
  CLOTHES,
  declareGraph,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

/** Throws a RangeError naming a cycle of `g`, if it has one. */
function checkAcyclic(g: GraphInput): void {
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
  title: 'Topological sort',
  topic: 'graphs',
  summary:
    'Orders the vertices of a directed acyclic graph so that every edge points forward, by listing them in reverse order of finishing a depth-first search.',
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as directed.'),
  }),
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
    const order = trace.add('order', { kind: 'array', initial: [] });
    const adj = adjacency(g);
    const seen = new Set<string>();
    const visit = (u: string): void => {
      seen.add(u);
      trace.step('discover', `Visit ${u}.`);
      graph.visit({ node: u }).pointer({ name: 'u', node: u });
      for (const { to: v, edge } of adj.get(u)!) {
        const fresh = !seen.has(v);
        trace.step(
          'edge',
          fresh
            ? `${u} → ${v}: ${v} is not visited yet, so visit it first.`
            : `${u} → ${v}: ${v} is in the list already, after where ${u} will go.`,
        );
        graph.pointer({ name: 'u', node: u }).highlight({ edges: [edge] });
        if (fresh) {
          graph.markEdge({ edge, mark: 'selected' });
          visit(v);
        }
      }
      trace.step(
        'finish',
        `Everything after ${u} is listed: put ${u} at the front of the list.`,
      );
      graph.pointer({ name: 'u', node: u }).settle({ node: u });
      order.insert({ index: 0, element: { id: `o-${u}`, value: u } });
    };
    for (const u of g.nodes) {
      if (seen.has(u)) continue;
      trace.step('root', `${u} is not visited yet: start a search there.`);
      visit(u);
    }
    trace.step(
      'done',
      'Every vertex is in the list, and every edge points forward in it: a topological order.',
    );
    graph.pointer({ name: 'u', node: null });
  },
});
