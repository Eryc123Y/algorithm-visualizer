/**
 * Maximum bipartite matching (CLRS 24.3) by augmenting paths. CLRS turns
 * the graph into a flow network, a source joined to one side and the
 * other side joined to a sink, all of capacity 1, and runs Ford–Fulkerson;
 * an augmenting path there is a path here that starts at a free vertex of
 * the left side, alternates between edges not in the matching and edges
 * in it, and ends at a free vertex of the right side. Flipping its edges
 * matches one more pair. The graph must be bipartite.
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

/** The two sides by colouring, the first vertex of each part on the left. */
export function sides(g: GraphInput): { left: string[]; right: string[] } {
  const adj = adjacency({ ...g, directed: false });
  const side = new Map<string, 0 | 1>();
  for (const start of g.nodes) {
    if (side.has(start)) continue;
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
  return {
    left: g.nodes.filter((v) => side.get(v) === 0),
    right: g.nodes.filter((v) => side.get(v) === 1),
  };
}

/** The graph drawn in two columns, the left side on the left. */
function declareBipartite(
  g: GraphInput,
  left: readonly string[],
  right: readonly string[],
) {
  const ids = edgeIds(g);
  const rowOf = (vs: readonly string[], v: string) => vs.indexOf(v);
  return {
    kind: 'graph' as const,
    label: 'G',
    directed: false,
    layout: 'manual' as const,
    nodes: [
      ...left.map((v) => ({ id: v, x: 60, y: 40 + 60 * rowOf(left, v) })),
      ...right.map((v) => ({ id: v, x: 260, y: 40 + 60 * rowOf(right, v) })),
    ],
    edges: g.edges.map(([from, to], k) => ({ id: ids[k]!, from, to })),
  };
}

export const bipartiteMatching = defineAlgorithm({
  id: 'bipartite-matching',
  title: 'Maximum bipartite matching',
  topic: 'graphs',
  summary:
    'Finds a largest set of edges, no two sharing a vertex, in a bipartite graph, by searching from each free vertex for a path that alternates between unmatched and matched edges, and flipping it.',
  input: z.strictObject({
    graph: Graph.describe(
      'A bipartite graph; its edges are taken as undirected, and the first vertex of each part goes on the left.',
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
              if p is not None:
                  for a, b in p[::2]:  # @augment
                      mate[a], mate[b] = b, a
              else:
                  pass  # @none
          return mate  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: false };
    const { left, right } = sides(g);
    const ids = edgeIds(g);
    const edgeOf = new Map<string, string>();
    g.edges.forEach(([a, b], k) => {
      edgeOf.set(`${a} ${b}`, ids[k]!);
      edgeOf.set(`${b} ${a}`, ids[k]!);
    });
    const adj = adjacency(g);
    const graph = trace.add('g', declareBipartite(g, left, right));
    const mate = new Map<string, string>();
    trace.step(
      'start',
      `Split the vertices into two sides, ${left.join(' ')} and ${right.join(' ')}: every edge joins the two. Start with no edge matched.`,
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
        trace.step(
          'none',
          `No alternating path from ${u} reaches a free vertex on the right: ${u} stays unmatched.`,
        );
        graph.pointer({ name: 'u', node: u });
        continue;
      }
      const path: string[] = [end];
      for (let v = end; v !== u;) {
        v = from.get(v)!;
        path.unshift(v);
      }
      const pairs = path.length / 2;
      trace.step(
        'search',
        `From ${u}, a search finds the path ${path.join(' – ')}, alternating between unmatched and matched edges, from a free vertex to a free vertex.`,
      );
      graph.pointer({ name: 'u', node: u }).highlight({
        nodes: path,
        edges: path.slice(1).map((v, k) => edgeOf.get(`${path[k]} ${v}`)!),
      });
      trace.step(
        'augment',
        pairs === 1
          ? `Match ${u} and ${end}: one more pair.`
          : `Flip the path: its ${pairs} unmatched edges go in and its ${pairs - 1} matched ones out, one more pair than before.`,
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
      `Every vertex on the left has had its search: the ${size} marked edge${size === 1 ? '' : 's'} form a maximum matching, since no augmenting path is left.`,
    );
    graph.pointer({ name: 'u', node: null });
    return { results: [size] };
  },
});
