/**
 * Hopcroft–Karp maximum bipartite matching (CLRS 25.1). The simple method
 * flips one augmenting path at a time; here each phase flips many. One
 * breadth-first search from all the free vertices on the left, along
 * unmatched edges to the right and matched edges back, puts the vertices
 * in layers and finds the length of the shortest augmenting paths. Depth-
 * first searches through the layers then find a maximal set of vertex-
 * disjoint paths of that length, and all of them are flipped. The length
 * grows every phase, so there are O(√V) phases. The graph must be
 * bipartite.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { declareBipartite, edgesByPair, sides } from './bipartite-matching.ts';
import { adjacency, Graph, graphOf, type GraphInput } from './graph.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const hopcroftKarp = defineAlgorithm({
  id: 'hopcroft-karp',
  title: 'Hopcroft–Karp matching',
  topic: 'graphs',
  summary:
    'Finds a maximum matching in a bipartite graph in phases: a breadth-first search from every free vertex finds the length of the shortest augmenting paths, and depth-first searches through its layers flip a maximal set of disjoint ones at once.',
  input: z.strictObject({
    graph: Graph.describe(
      'A bipartite graph; its edges are taken as undirected, the first vertex of each part goes on the left, and a vertex with no edges on the shorter side.',
    ),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        nodes: ['a', 'b', 'c', 'd', 'p', 'q', 'r', 's'],
        edges: [
          ['a', 'p'],
          ['a', 'q'],
          ['b', 'p'],
          ['c', 'q'],
          ['c', 'r'],
          ['d', 'r'],
          ['d', 's'],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      HOPCROFT-KARP(G)  // G's vertices split into L and R
          M = an empty set of edges  // @start
          while true
              layer the vertices by BFS from the free vertices of L, out of L by edges not in M, back by edges in M  // @layer
              if the search reaches no free vertex of R
                  return M  // @done
              P = a maximal set of vertex-disjoint shortest augmenting paths, by DFS through the layers  // @path
              M = M with the edges of every path in P flipped in or out  // @augment
    `,
    python: `
      def hopcroft_karp(left, adj):
          mate = {}  # @start
          while True:
              layer = bfs_layers(left, adj, mate)  # @layer
              if layer is None:
                  return mate  # @done
              paths = disjoint_paths(left, adj, mate, layer)  # @path
              for p in paths:  # @augment
                  for a, b in zip(p[::2], p[1::2]):
                      mate[a], mate[b] = b, a
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
        ? 'No edge joins two vertices, so none can be matched.'
        : `Split the vertices into two sides, ${left.join(' ')} and ${right.join(' ')}: every edge joins the two. Start with no edge matched.`,
    );
    for (const v of left) graph.group({ node: v, group: 0 });
    for (const v of right) graph.group({ node: v, group: 1 });

    let noted = new Set<string>();
    for (let phase = 1; ; phase++) {
      const free = left.filter((u) => !mate.has(u));
      const { layer, shortest } = layers(free, adj, mate);
      trace.step('layer', layerText(phase, free, shortest), {
        vars: { phase },
      });
      for (const v of g.nodes)
        if (layer.has(v))
          graph.annotate({ node: v, text: String(layer.get(v)) });
        else if (noted.has(v)) graph.annotate({ node: v, text: null });
      noted = new Set(layer.keys());

      if (shortest === Infinity) {
        const size = mate.size / 2;
        trace.step(
          'done',
          size === 0
            ? 'No augmenting path is left, and the matching is empty.'
            : `The ${plural(size, 'marked edge')} form a maximum matching, found in ${plural(phase - 1, 'phase')}.`,
        );
        for (const v of noted) graph.annotate({ node: v, text: null });
        return { results: [size] };
      }

      const paths = disjointPaths(free, adj, mate, layer, shortest);
      paths.forEach((p, k) => {
        trace.step(
          'path',
          `Depth-first search from ${p[0]} through the layers finds ${p.join(' – ')}, of ${plural(shortest, 'edge')}${k === 0 ? '' : `, sharing no vertex with the ${plural(k, 'path')} before it`}.`,
          { vars: { phase } },
        );
        graph.pointer({ name: 'u', node: p[0]! }).highlight({
          nodes: p,
          edges: p.slice(1).map((v, i) => edgeOf.get(`${p[i]} ${v}`)!),
        });
      });
      const before = mate.size / 2;
      trace.step('augment', augmentText(free, paths, shortest, before), {
        vars: { phase },
      });
      graph
        .pointer({ name: 'u', node: null })
        .highlight({ nodes: paths.flat() });
      for (const p of paths)
        for (let k = 0; k + 1 < p.length; k++) {
          const [a, b] = [p[k]!, p[k + 1]!];
          const edge = edgeOf.get(`${a} ${b}`)!;
          if (k % 2 === 0) {
            mate.set(a, b);
            mate.set(b, a);
            graph.markEdge({ edge, mark: 'selected' });
          } else graph.markEdge({ edge, mark: null });
        }
    }
  },
});

type Adjacency = ReturnType<typeof adjacency>;

/**
 * Breadth-first layers from the free vertices on the left, out by edges
 * not matched and back by matched ones, up to the first layer that holds
 * a free vertex on the right; `shortest` is that layer, or Infinity.
 */
function layers(
  free: readonly string[],
  adj: Adjacency,
  mate: ReadonlyMap<string, string>,
): { layer: Map<string, number>; shortest: number } {
  const layer = new Map<string, number>(free.map((u) => [u, 0]));
  let shortest = Infinity;
  const queue = [...free];
  while (queue.length > 0) {
    const x = queue.shift()!;
    const d = layer.get(x)!;
    if (d + 1 > shortest) break;
    for (const { to: y } of adj.get(x)!) {
      if (mate.get(x) === y || layer.has(y)) continue;
      layer.set(y, d + 1);
      const z = mate.get(y);
      if (z === undefined) shortest = d + 1;
      else if (!layer.has(z)) {
        layer.set(z, d + 2);
        queue.push(z);
      }
    }
  }
  // Layers past the shortest paths play no part.
  for (const [v, d] of layer) if (d > shortest) layer.delete(v);
  return { layer, shortest };
}

/**
 * A maximal set of vertex-disjoint augmenting paths of length `shortest`,
 * each found by depth-first search from a free vertex on the left, going
 * one layer deeper at every edge. A vertex on a path, or one a search has
 * left without success, is not entered again in this phase.
 */
function disjointPaths(
  free: readonly string[],
  adj: Adjacency,
  mate: ReadonlyMap<string, string>,
  layer: ReadonlyMap<string, number>,
  shortest: number,
): string[][] {
  const used = new Set<string>();
  const search = (x: string): string[] | undefined => {
    used.add(x);
    const d = layer.get(x)!;
    for (const { to: y } of adj.get(x)!) {
      if (used.has(y) || mate.get(x) === y || layer.get(y) !== d + 1) continue;
      used.add(y);
      const z = mate.get(y);
      if (z === undefined) {
        if (d + 1 === shortest) return [x, y];
        continue;
      }
      if (used.has(z) || layer.get(z) !== d + 2) continue;
      const rest = search(z);
      if (rest !== undefined) return [x, y, ...rest];
    }
    return undefined;
  };
  return free.flatMap((u) => {
    if (used.has(u)) return [];
    const p = search(u);
    return p === undefined ? [] : [p];
  });
}

function layerText(
  phase: number,
  free: readonly string[],
  shortest: number,
): string {
  if (free.length === 0)
    return `Phase ${phase}: every vertex on the left is matched, so no augmenting path is left.`;
  const from = `Phase ${phase}: breadth-first search from the free vertices on the left, ${free.join(' ')}, along unmatched edges to the right and matched edges back, puts each vertex it reaches in a layer, its note.`;
  return shortest === Infinity
    ? `${from} It reaches no free vertex on the right: no augmenting path is left.`
    : `${from} A free vertex on the right is first reached in layer ${shortest}, so the shortest augmenting paths have ${plural(shortest, 'edge')}.`;
}

function augmentText(
  free: readonly string[],
  paths: readonly (readonly string[])[],
  shortest: number,
  before: number,
): string {
  const rest = free.filter((u) => !paths.some((p) => p[0] === u));
  const left =
    rest.length === 0
      ? ''
      : `${rest.join(' ')} ${rest.length === 1 ? 'has' : 'have'} no such path that shares no vertex with these. `;
  const k = paths.length;
  const flip =
    shortest === 1
      ? k === 1
        ? 'Match the pair'
        : `Match the ${k} pairs at once`
      : k === 1
        ? 'Flip the path: its unmatched edges go in and its matched ones out'
        : `Flip all ${k} paths at once: their unmatched edges go in and their matched ones out`;
  return `${left}${flip}, so the matching grows from ${before} to ${before + k}.`;
}
