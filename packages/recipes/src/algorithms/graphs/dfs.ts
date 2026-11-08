/**
 * Depth-first search, as in CLRS (ADR 0023): `DFS` starts a depth-first
 * tree at every vertex still white, in the order listed, and `DFS-VISIT`
 * goes as deep as it can before backing up. Each vertex is annotated with
 * its discovery and finishing times d/f, tree edges are marked, and the
 * call stack is shown beside the graph.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { adjacency, CLOTHES, declareGraph, Graph, graphOf } from './graph.ts';

export const dfs = defineAlgorithm({
  id: 'dfs',
  title: 'Depth-first search',
  topic: 'graphs',
  summary:
    'Explores a graph as deep as it can before backing up, from every vertex not yet reached, recording discovery and finishing times.',
  input: z.strictObject({ graph: Graph }),
  main: 'graph',
  examples: [{ graph: CLOTHES }],
  code: {
    pseudocode: `
      DFS(G)
          for each vertex u in G.V
              color[u] = WHITE
          time = 0
          for each vertex u in G.V
              if color[u] == WHITE  // @root
                  DFS-VISIT(G, u)

      DFS-VISIT(G, u)
          time = time + 1
          d[u] = time  // @discover
          color[u] = GRAY
          for each neighbour v of u
              if color[v] == WHITE  // @seen
                  π[v] = u  // @tree-edge
                  DFS-VISIT(G, v)
          time = time + 1
          f[u] = time  // @finish
          color[u] = BLACK
    `,
    python: `
      def dfs(g):
          d, f, parent = {}, {}, {}
          time = 0

          def visit(u):
              nonlocal time
              time += 1
              d[u] = time  # @discover
              for v in g.neighbors(u):
                  if v not in d:  # @seen
                      parent[v] = u  # @tree-edge
                      visit(v)
              time += 1
              f[u] = time  # @finish

          for u in g:
              if u not in d:  # @root
                  visit(u)
          return d, f, parent
    `,
  },
  run(input, trace) {
    const g = graphOf(input.graph);
    const graph = trace.add('g', declareGraph(g, false));
    const calls = trace.add('calls', {
      kind: 'stack',
      label: 'call stack',
      place: 'side',
      initial: [],
    });
    const adj = adjacency(g);
    const d = new Map<string, number>();
    const finished = new Set<string>();
    let time = 0;
    const visit = (u: string): void => {
      d.set(u, ++time);
      trace.step('discover', `Discover ${u} at time ${time}.`, {
        vars: { time },
      });
      calls.push({ element: { id: `call-${u}`, value: `visit ${u}` } });
      graph
        .visit({ node: u })
        .pointer({ name: 'u', node: u })
        .annotate({ node: u, text: `${time}/` });
      for (const { to: v, edge } of adj.get(u)!) {
        if (d.has(v)) {
          trace.step(
            'seen',
            finished.has(v)
              ? `${v} is finished already: skip it.`
              : `${v} is on the current path: skip it.`,
          );
          graph.pointer({ name: 'u', node: u }).highlight({ edges: [edge] });
          continue;
        }
        trace.step(
          'tree-edge',
          `${v} is new: ${u}–${v} is a tree edge, so go deeper.`,
        );
        graph
          .pointer({ name: 'u', node: u })
          .highlight({ edges: [edge] })
          .markEdge({ edge, mark: 'selected' });
        visit(v);
      }
      finished.add(u);
      trace.step('finish', `${u} is finished at time ${++time}.`, {
        vars: { time },
      });
      graph
        .pointer({ name: 'u', node: u })
        .settle({ node: u })
        .annotate({ node: u, text: `${d.get(u)}/${time}` });
      calls.pop();
    };
    for (const u of g.nodes) {
      if (d.has(u)) continue;
      trace.step(
        'root',
        time === 0
          ? `Start a depth-first tree at ${u}.`
          : `${u} is not reached yet: start a new depth-first tree there.`,
      );
      visit(u);
    }
    graph.pointer({ name: 'u', node: null });
  },
});
