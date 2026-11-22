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
  title: { en: 'Depth-first search', zh: '深度优先搜索' },
  topic: 'graphs',
  summary: {
    en: 'Explores a graph as deep as it can before backing up, from every vertex not yet reached, recording discovery and finishing times.',
    zh: '从每个还没到达的顶点出发，尽可能深入地探索图再回退，记录每个顶点的发现时间和完成时间。',
  },
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
      label: trace.say({ en: 'call stack', zh: '调用栈' }),
      place: 'side',
      initial: [],
    });
    const adj = adjacency(g);
    const d = new Map<string, number>();
    const finished = new Set<string>();
    let time = 0;
    const visit = (u: string): void => {
      d.set(u, ++time);
      trace.step(
        'discover',
        {
          en: `Discover ${u} at time ${time}.`,
          zh: `在时刻 ${time} 发现 ${u}。`,
        },
        {
          vars: { time },
        },
      );
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
              ? {
                  en: `${v} is finished already: skip it.`,
                  zh: `${v} 已经完成：跳过。`,
                }
              : {
                  en: `${v} is on the current path: skip it.`,
                  zh: `${v} 在当前路径上：跳过。`,
                },
          );
          graph.pointer({ name: 'u', node: u }).highlight({ edges: [edge] });
          continue;
        }
        trace.step('tree-edge', {
          en: `${v} is new: ${u}–${v} is a tree edge, so go deeper.`,
          zh: `${v} 是新顶点：${u}–${v} 是树边，继续深入。`,
        });
        graph
          .pointer({ name: 'u', node: u })
          .highlight({ edges: [edge] })
          .markEdge({ edge, mark: 'selected' });
        visit(v);
      }
      finished.add(u);
      time += 1;
      trace.step(
        'finish',
        {
          en: `${u} is finished at time ${time}.`,
          zh: `${u} 在时刻 ${time} 完成。`,
        },
        {
          vars: { time },
        },
      );
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
          ? {
              en: `Start a depth-first tree at ${u}.`,
              zh: `从 ${u} 开始一棵深度优先树。`,
            }
          : {
              en: `${u} is not reached yet: start a new depth-first tree there.`,
              zh: `${u} 还没有到达：从它开始一棵新的深度优先树。`,
            },
      );
      visit(u);
    }
    graph.pointer({ name: 'u', node: null });
  },
});
