/**
 * Strongly connected components (CLRS 20.5): a depth-first search lists
 * the vertices by decreasing finishing time; then, taking them in that
 * order, a search that follows edges backwards (in the transpose G^T)
 * reaches exactly one new component each time. Edges are taken as
 * directed.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  adjacency,
  declareGraph,
  edgeIds,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

/** The arcs into each vertex: G^T's adjacency lists, edge ids kept. */
function reversed(
  g: GraphInput,
): Map<string, { from: string; edge: string }[]> {
  const ids = edgeIds(g);
  const into = new Map(
    g.nodes.map((v) => [v, [] as { from: string; edge: string }[]]),
  );
  g.edges.forEach(([from, to], k) =>
    into.get(to)!.push({ from, edge: ids[k]! }),
  );
  return into;
}

/** A component's vertices, the first few when there are many. */
const listed = (vs: readonly string[]) =>
  vs.length <= 5
    ? vs.join(' ')
    : `${vs.slice(0, 4).join(' ')} … (${vs.length})`;

/** CLRS's Figure 20.9, in letters. */
export const SCC_EXAMPLE: z.output<typeof Graph> = {
  directed: true,
  nodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  edges: [
    ['a', 'b'],
    ['b', 'c'],
    ['b', 'e'],
    ['b', 'f'],
    ['c', 'd'],
    ['c', 'g'],
    ['d', 'c'],
    ['d', 'h'],
    ['e', 'a'],
    ['e', 'f'],
    ['f', 'g'],
    ['g', 'f'],
    ['g', 'h'],
    ['h', 'h'],
  ],
};

export const stronglyConnectedComponents = defineAlgorithm({
  id: 'strongly-connected-components',
  title: { en: 'Strongly connected components', zh: '强连通分量' },
  topic: 'graphs',
  summary: {
    en: 'Splits a directed graph into its strongly connected components: one depth-first search orders the vertices by finishing time, and a second, following edges backwards in that order, finds one component at a time.',
    zh: '把有向图划分为强连通分量：第一次深度优先搜索按完成时间排列顶点，第二次按这个顺序沿反向边搜索，每次找出一个分量。',
  },
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as directed.'),
  }),
  main: 'graph',
  examples: [
    { graph: SCC_EXAMPLE },
    {
      graph: {
        directed: true,
        nodes: ['1', '2', '3', '4', '5'],
        edges: [
          ['1', '2'],
          ['2', '3'],
          ['3', '1'],
          ['3', '4'],
          ['4', '5'],
          ['5', '4'],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      STRONGLY-CONNECTED-COMPONENTS(G)
          L = an empty list
          for each vertex u in G.V
              if u is not visited
                  VISIT(G, u, L)  // @root
          for each vertex u in L, in order
              if u is in no component  // @component
                  ASSIGN(G, u, u)
          return the components  // @done

      VISIT(G, u, L)
          mark u visited  // @discover
          for each edge (u, v) in G.E
              if v is not visited  // @edge
                  VISIT(G, v, L)
          insert u at the front of L  // @finish

      ASSIGN(G, u, root)
          put u in the component of root  // @assign
          for each edge (v, u) in G.E, followed backwards
              if v is in no component  // @reverse
                  ASSIGN(G, v, root)
    `,
    python: `
      from collections import deque

      def strongly_connected_components(g):
          order, seen = deque(), set()
          for u in g:
              if u not in seen:  # @root
                  visit(g, u, seen, order)
          comp = {}
          for u in order:
              if u not in comp:  # @component
                  assign(g, u, u, comp)
          return comp  # @done

      def visit(g, u, seen, order):
          seen.add(u)  # @discover
          for v in g.neighbors(u):
              if v not in seen:  # @edge
                  visit(g, v, seen, order)
          order.appendleft(u)  # @finish

      def assign(g, u, root, comp):
          comp[u] = root  # @assign
          for v in g.predecessors(u):
              if v not in comp:  # @reverse
                  assign(g, v, root, comp)
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    const graph = trace.add('g', declareGraph(g, false));
    const order = trace.add('L', {
      kind: 'array',
      place: 'side',
      label: trace.say({ en: 'L, by finishing time', zh: 'L：按完成时间排列' }),
      initial: [],
    });
    const found = trace.add('components', {
      kind: 'array',
      place: 'side',
      label: trace.say({ en: 'components', zh: '强连通分量' }),
      initial: [],
    });
    const adj = adjacency(g);
    const seen = new Set<string>();
    const list: string[] = [];
    let time = 0;
    const visit = (u: string): void => {
      seen.add(u);
      trace.step('discover', { en: `Visit ${u}.`, zh: `访问 ${u}。` });
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
                en: `${u} → ${v}: ${v} is visited already.`,
                zh: `${u} → ${v}：${v} 已经访问过。`,
              },
        );
        graph.pointer({ name: 'u', node: u }).highlight({ edges: [edge] });
        if (fresh) visit(v);
      }
      time++;
      trace.step('finish', {
        en: `${u} finishes, number ${time}: put it at the front of L, so L lists the vertices by decreasing finishing time.`,
        zh: `${u} 完成，序号 ${time}：把它放到 L 的最前面，这样 L 按完成时间从晚到早列出顶点。`,
      });
      graph
        .pointer({ name: 'u', node: u })
        .annotate({ node: u, text: `f=${time}` });
      order.insert({ index: 0, element: { id: `L-${u}`, value: u } });
      list.unshift(u);
    };
    for (const u of g.nodes) {
      if (seen.has(u)) continue;
      trace.step('root', {
        en: `${u} is not visited yet: start a search there.`,
        zh: `${u} 还没有访问过：从它开始一次搜索。`,
      });
      visit(u);
    }

    const into = reversed(g);
    const component = new Map<string, number>();
    const members: string[][] = [];
    const assign = (u: string, c: number): void => {
      component.set(u, c);
      members[c]!.push(u);
      trace.step('assign', {
        en: `${u} joins component ${c + 1}.`,
        zh: `${u} 加入分量 ${c + 1}。`,
      });
      // Coloured by component; a settled mark would hide the colour.
      graph
        .group({ node: u, group: (c % 6) as 0 | 1 | 2 | 3 | 4 | 5 })
        .pointer({ name: 'u', node: u });
      for (const { from: v, edge } of into.get(u)!) {
        const fresh = !component.has(v);
        trace.step(
          'reverse',
          fresh
            ? {
                en: `Follow ${v} → ${u} backwards: ${v} is in no component yet, so it is in this one.`,
                zh: `沿 ${v} → ${u} 反向走：${v} 还不属于任何分量，所以属于这一个。`,
              }
            : {
                en: `Follow ${v} → ${u} backwards: ${v} is in component ${component.get(v)! + 1} already.`,
                zh: `沿 ${v} → ${u} 反向走：${v} 已经属于分量 ${component.get(v)! + 1}。`,
              },
        );
        graph.highlight({ edges: [edge] });
        if (fresh) {
          graph.markEdge({ edge, mark: 'selected' });
          assign(v, c);
        }
      }
    };
    for (const u of list) {
      if (component.has(u)) continue;
      const c = members.length;
      members.push([]);
      trace.step('component', {
        en: `${u} comes next in L and is in no component: the vertices that reach it, and are in no component yet, form component ${c + 1}.`,
        zh: `L 中的下一个是 ${u}，它还不属于任何分量：能到达它且还不属于任何分量的顶点组成分量 ${c + 1}。`,
      });
      graph.highlight({ nodes: [u] }).pointer({ name: 'u', node: u });
      assign(u, c);
      found.insert({
        index: c,
        element: { id: `C-${c + 1}`, value: listed(members[c]!) },
      });
    }
    trace.step('done', {
      en: `Every vertex is in a component: ${members.length === 1 ? 'the graph is strongly connected' : `${members.length} components`}.`,
      zh: `每个顶点都属于一个分量：${members.length === 1 ? '这个图是强连通的' : `共 ${members.length} 个分量`}。`,
    });
    graph.pointer({ name: 'u', node: null });
    return { results: [members.length] };
  },
});
