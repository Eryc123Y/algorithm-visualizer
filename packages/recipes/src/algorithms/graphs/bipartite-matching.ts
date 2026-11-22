/**
 * Maximum bipartite matching (CLRS 24.3) by augmenting paths. CLRS turns
 * the graph into a flow network, a source joined to one side and the
 * other side joined to a sink, all of capacity 1, and runs Ford–Fulkerson;
 * an augmenting path there is a path here that starts at a free vertex of
 * the left side, alternates between edges not in the matching and edges
 * in it, and ends at a free vertex of the right side. Flipping its edges
 * matches one more pair. Searching once from each left vertex in turn, as
 * here, is enough: a vertex with no such path never gains one later. The
 * graph must be bipartite.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  adjacency,
  edgeIds,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

/**
 * The two sides by colouring, the first vertex of each part on the left;
 * a vertex with no edges goes on the shorter side, so the columns stay
 * even.
 */
export function sides(g: GraphInput): { left: string[]; right: string[] } {
  const loop = g.edges.find(([a, b]) => a === b);
  if (loop !== undefined)
    throw new RangeError(
      `The graph is not bipartite: edge ${loop[0]}–${loop[0]} joins a vertex to itself`,
    );
  const adj = adjacency({ ...g, directed: false });
  const side = new Map<string, 0 | 1>();
  const lone = g.nodes.filter((v) => adj.get(v)!.length === 0);
  for (const start of g.nodes) {
    if (side.has(start) || lone.includes(start)) continue;
    side.set(start, 0);
    const queue = [start];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const { to: v } of adj.get(u)!) {
        if (!side.has(v)) {
          side.set(v, side.get(u) === 0 ? 1 : 0);
          queue.push(v);
        } else if (side.get(v) === side.get(u))
          throw new RangeError(
            `The graph is not bipartite: ${u} and ${v} are joined but would be on one side`,
          );
      }
    }
  }
  const count = (s: 0 | 1) => [...side.values()].filter((x) => x === s).length;
  for (const v of lone) side.set(v, count(1) < count(0) ? 1 : 0);
  return {
    left: g.nodes.filter((v) => side.get(v) === 0),
    right: g.nodes.filter((v) => side.get(v) === 1),
  };
}

/** Rows 60 apart, closer for a side of more than 10 vertices. */
const pitchFor = (rows: number) =>
  rows <= 10 ? 60 : Math.max(44, 540 / (rows - 1));

/** The graph drawn in two columns, the left side on the left. */
export function declareBipartite(
  g: GraphInput,
  left: readonly string[],
  right: readonly string[],
) {
  const ids = edgeIds(g);
  const rows = Math.max(left.length, right.length);
  const pitch = pitchFor(rows);
  // Wider apart as the columns grow, so edges are not too steep.
  const across = 60 + Math.max(200, ((rows - 1) * pitch) / 2);
  return {
    kind: 'graph' as const,
    label: 'G',
    directed: false,
    layout: 'manual' as const,
    nodes: [
      ...left.map((v, k) => ({ id: v, x: 60, y: 40 + pitch * k })),
      ...right.map((v, k) => ({ id: v, x: across, y: 40 + pitch * k })),
    ],
    edges: g.edges.map(([from, to], k) => ({ id: ids[k]!, from, to })),
  };
}

/** The id of the edge joining two vertices, keyed `a b` either way round. */
export function edgesByPair(g: GraphInput): Map<string, string> {
  const ids = edgeIds(g);
  const edgeOf = new Map<string, string>();
  g.edges.forEach(([a, b], k) => {
    edgeOf.set(`${a} ${b}`, ids[k]!);
    edgeOf.set(`${b} ${a}`, ids[k]!);
  });
  return edgeOf;
}

export const bipartiteMatching = defineAlgorithm({
  id: 'bipartite-matching',
  title: { en: 'Maximum bipartite matching', zh: '二分图最大匹配' },
  topic: 'graphs',
  summary: {
    en: 'Finds a largest set of edges, no two sharing a vertex, in a bipartite graph, by searching from each free vertex for a path that alternates between unmatched and matched edges, and flipping it.',
    zh: '在二分图中求最多的边，使任意两条边没有公共顶点：从每个未匹配的顶点出发，寻找未匹配边和匹配边交替出现的路径，再把它翻转。',
  },
  input: z.strictObject({
    graph: Graph.describe(
      'A bipartite graph; its edges are taken as undirected, the first vertex of each part goes on the left, and a vertex with no edges on the shorter side.',
    ),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        nodes: ['a', 'b', 'c', 'd', 'e', 'p', 'q', 'r', 's'],
        edges: [
          ['a', 'p'],
          ['b', 'p'],
          ['b', 'r'],
          ['c', 'q'],
          ['c', 'r'],
          ['c', 's'],
          ['d', 'r'],
          ['e', 'r'],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      BIPARTITE-MATCHING(G)  // G's vertices split into L and R
          M = an empty set of edges  // @start
          for each vertex u in L  // @search
              p = a path from u, alternating edges out of M and in M, to a free vertex of R
              if there is such a path p
                  M = M with the edges of p flipped in or out  // @augment
              else u stays unmatched  // @none
          return M  // @done
    `,
    python: `
      def bipartite_matching(left, adj):
          mate = {}  # @start
          for u in left:  # @search
              p = alternating_path(u, adj, mate)
              if p is None:
                  continue  # @none
              for a, b in zip(p[::2], p[1::2]):  # @augment
                  mate[a], mate[b] = b, a
          return mate  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: false };
    const { left, right } = sides(g);
    const edgeOf = edgesByPair(g);
    const adj = adjacency(g);
    const graph = trace.add('g', declareBipartite(g, left, right));
    const mate = new Map<string, string>();
    trace.step(
      'start',
      g.edges.length === 0
        ? {
            en: 'No edge joins two vertices, so none can be matched.',
            zh: '没有边连接两个顶点，所以无法匹配。',
          }
        : {
            en: `Split the vertices into two sides, ${left.join(' ')} and ${right.join(' ')}: every edge joins the two. Start with no edge matched.`,
            zh: `把顶点分成两边，${left.join(' ')} 和 ${right.join(' ')}：每条边都连接两边。开始时没有边被匹配。`,
          },
    );
    for (const v of left) graph.group({ node: v, group: 0 });
    for (const v of right) graph.group({ node: v, group: 1 });
    for (const u of left) {
      // Breadth-first search for an alternating path from u.
      const from = new Map<string, string>();
      const seenR = new Set<string>();
      const queue = [u];
      let end: string | undefined;
      while (queue.length > 0 && end === undefined) {
        const x = queue.shift()!;
        for (const { to: y } of adj.get(x)!) {
          if (seenR.has(y) || mate.get(x) === y) continue;
          seenR.add(y);
          from.set(y, x);
          const z = mate.get(y);
          if (z === undefined) {
            end = y;
            break;
          }
          from.set(z, y);
          queue.push(z);
        }
      }
      if (end === undefined) {
        trace.step('none', {
          en: `No alternating path from ${u} reaches a free vertex on the right: ${u} stays unmatched.`,
          zh: `从 ${u} 出发的交替路径到达不了右边未匹配的顶点：${u} 保持未匹配。`,
        });
        graph.pointer({ name: 'u', node: u });
        continue;
      }
      const path: string[] = [end];
      for (let v = end; v !== u;) {
        v = from.get(v)!;
        path.unshift(v);
      }
      const pairs = path.length / 2;
      trace.step('search', {
        en: `From ${u}, a search finds the path ${path.join(' – ')}, alternating between unmatched and matched edges, from a free vertex to a free vertex.`,
        zh: `从 ${u} 出发，搜索找到路径 ${path.join(' – ')}：未匹配边和匹配边交替出现，从一个未匹配顶点到另一个未匹配顶点。`,
      });
      graph.pointer({ name: 'u', node: u }).highlight({
        nodes: path,
        edges: path.slice(1).map((v, k) => edgeOf.get(`${path[k]} ${v}`)!),
      });
      trace.step(
        'augment',
        pairs === 1
          ? {
              en: `Match ${u} and ${end}: one more pair.`,
              zh: `匹配 ${u} 和 ${end}：多了一对。`,
            }
          : {
              en: `Flip the path: its ${pairs} unmatched edges go in and its ${pairs - 1} matched ones out, one more pair than before.`,
              zh: `翻转这条路径：它的 ${pairs} 条未匹配边加入匹配，${pairs - 1} 条匹配边移出，比之前多一对。`,
            },
      );
      for (let k = 0; k + 1 < path.length; k++) {
        const [a, b] = [path[k]!, path[k + 1]!];
        const edge = edgeOf.get(`${a} ${b}`)!;
        if (k % 2 === 0) {
          mate.set(a, b);
          mate.set(b, a);
          graph.markEdge({ edge, mark: 'selected' });
        } else graph.markEdge({ edge, mark: null });
      }
      graph.highlight({ nodes: path });
    }
    const size = mate.size / 2;
    trace.step(
      'done',
      size === 0
        ? {
            en: 'Every vertex has had its search, and the matching is empty.',
            zh: '每个顶点都搜索过了，匹配为空。',
          }
        : {
            en: `Every vertex on the left has had its search: the ${size} marked edge${size === 1 ? ' forms' : 's form'} a maximum matching, since no augmenting path is left.`,
            zh: `左边的每个顶点都搜索过了：标出的 ${size} 条边构成一个最大匹配，因为已经没有增广路径。`,
          },
    );
    graph.pointer({ name: 'u', node: null });
    return { results: [size] };
  },
});
