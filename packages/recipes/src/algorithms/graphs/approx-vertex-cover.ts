/**
 * APPROX-VERTEX-COVER (CLRS 35.1): a vertex cover at most twice the
 * smallest. While an edge is left, take any one, (u, v), put both u and v
 * in the cover, and remove every edge either of them touches. The edges
 * taken share no vertex, and any cover must hold an end of each, so the
 * smallest cover has at least half as many vertices as this one.
 *
 * Here "any edge" is the first edge left in input order. Taken edges are
 * marked, covered edges dimmed, and the cover's vertices put in group 0.
 * Edges are taken as undirected.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  declareGraph,
  edgeIds,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

export const approxVertexCover = defineAlgorithm({
  id: 'approx-vertex-cover',
  title: 'Approximate vertex cover',
  topic: 'graphs',
  summary:
    'Finds a vertex cover at most twice the size of the smallest by taking any edge left, putting both its ends in the cover, and removing every edge they touch.',
  input: z.strictObject({
    graph: Graph.describe('A graph; its edges are taken as undirected.'),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        nodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        edges: [
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'd'],
          ['c', 'e'],
          ['d', 'e'],
          ['d', 'f'],
          ['d', 'g'],
          ['e', 'f'],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      APPROX-VERTEX-COVER(G)
          C = an empty set  // @start
          E' = G.E
          while E' is not empty
              let (u, v) be any edge of E'  // @take
              C = C ∪ {u, v}
              remove from E' every edge incident on u or v  // @remove
          return C  // @done
    `,
    python: `
      def approx_vertex_cover(edges):
          cover = set()  # @start
          left = list(edges)
          while left:
              u, v = left[0]  # @take
              cover |= {u, v}
              left = [e for e in left if u not in e and v not in e]  # @remove
          return cover  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: false };
    const ids = edgeIds(g);
    const graph = trace.add('g', declareGraph(g, false));
    trace.step(
      'start',
      `Start with an empty cover and all ${g.edges.length} edge${g.edges.length === 1 ? '' : 's'} still to cover.`,
    );
    const left = new Set(g.edges.keys());
    const cover: string[] = [];
    const taken: number[] = [];
    while (left.size > 0) {
      const k = Math.min(...left);
      const [u, v] = g.edges[k]!;
      taken.push(k);
      const fresh = [u, v].filter(
        (x, i, all) => all.indexOf(x) === i && !cover.includes(x),
      );
      cover.push(...fresh);
      trace.step(
        'take',
        u === v
          ? `Take the loop at ${u}, the first edge left: put ${u} in the cover.`
          : `Take ${u}–${v}, the first edge left: put both ${u} and ${v} in the cover.`,
      );
      graph.markEdge({ edge: ids[k]!, mark: 'selected' });
      for (const x of fresh) graph.group({ node: x, group: 0 });
      const gone = [...left].filter((j) => {
        const [a, b] = g.edges[j]!;
        return a === u || a === v || b === u || b === v;
      });
      for (const j of gone) left.delete(j);
      const others = gone.filter((j) => j !== k);
      trace.step(
        'remove',
        others.length === 0
          ? `No other edge touches ${u === v ? u : `${u} or ${v}`}: ${left.size === 0 ? 'none is left' : `${left.size} still to cover`}.`
          : `Remove the ${others.length} other edge${others.length === 1 ? '' : 's'} touching ${u === v ? u : `${u} or ${v}`}, now covered: ${left.size === 0 ? 'none is left' : `${left.size} still to cover`}.`,
      );
      for (const j of others)
        graph.markEdge({ edge: ids[j]!, mark: 'rejected' });
    }
    trace.step(
      'done',
      cover.length === 0
        ? 'The graph has no edges, so the empty cover covers them all.'
        : `No edge is left: ${cover.length === 1 ? `the vertex ${cover[0]} covers` : `the ${cover.length} vertices ${cover.join(' ')} cover`} every edge. ${taken.length === 1 ? 'Every cover holds' : `The ${taken.length} edges taken share no vertex, and every cover holds`} an end of ${taken.length === 1 ? 'the edge taken' : 'each'}, so the smallest cover has at least ${taken.length} vertex${taken.length === 1 ? '' : 'es'}: this one is at most twice that.`,
    );
    return { results: [cover.length] };
  },
});
