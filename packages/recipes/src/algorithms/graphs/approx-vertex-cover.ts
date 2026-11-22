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

/** Most edges dimmed in one step, under the 100 actions a step may hold. */
const MAX_DIMMED = 90;

export const approxVertexCover = defineAlgorithm({
  id: 'approx-vertex-cover',
  title: { en: 'Approximate vertex cover', zh: '近似顶点覆盖' },
  topic: 'graphs',
  summary: {
    en: 'Finds a vertex cover at most twice the size of the smallest by taking any edge left, putting both its ends in the cover, and removing every edge they touch.',
    zh: '求一个大小不超过最小顶点覆盖两倍的顶点覆盖：任取一条剩下的边，把它的两个端点放进覆盖，再删去与它们相连的所有边。',
  },
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
    trace.step('start', {
      en: `Start with an empty cover and all ${g.edges.length} edge${g.edges.length === 1 ? '' : 's'} still to cover.`,
      zh: `从空的覆盖开始，${g.edges.length} 条边都还需要覆盖。`,
    });
    const left = new Set(g.edges.keys());
    const cover: string[] = [];
    const taken: number[] = [];
    while (left.size > 0) {
      const k = Math.min(...left);
      const [u, v] = g.edges[k]!;
      taken.push(k);
      // Neither end is in the cover yet: every edge touching the cover is
      // gone. A loop has one end.
      const fresh = u === v ? [u] : [u, v];
      cover.push(...fresh);
      trace.step(
        'take',
        u === v
          ? {
              en: `Take the loop at ${u}, the first edge left: put ${u} in the cover.`,
              zh: `取剩下的第一条边，${u} 上的自环：把 ${u} 放进覆盖。`,
            }
          : {
              en: `Take ${u}–${v}, the first edge left: put both ${u} and ${v} in the cover.`,
              zh: `取剩下的第一条边 ${u}–${v}：把 ${u} 和 ${v} 都放进覆盖。`,
            },
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
          ? {
              en: `No other edge touches ${u === v ? u : `${u} or ${v}`}: ${left.size === 0 ? 'none is left' : `${left.size} still to cover`}.`,
              zh: `没有别的边与 ${u === v ? u : `${u} 或 ${v}`} 相连：${left.size === 0 ? '已经没有剩下的边' : `还有 ${left.size} 条需要覆盖`}。`,
            }
          : {
              en: `Remove the ${others.length} other edge${others.length === 1 ? '' : 's'} touching ${u === v ? u : `${u} or ${v}`}, now covered: ${left.size === 0 ? 'none is left' : `${left.size} still to cover`}.`,
              zh: `删去与 ${u === v ? u : `${u} 或 ${v}`} 相连的另外 ${others.length} 条边，它们已被覆盖：${left.size === 0 ? '已经没有剩下的边' : `还有 ${left.size} 条需要覆盖`}。`,
            },
      );
      // A step holds at most 100 actions: a star's edges are dimmed over
      // several.
      for (let i = 0; i < others.length; i += MAX_DIMMED) {
        if (i > 0)
          trace.step('remove', {
            en: `More of the ${others.length} edges touching ${u === v ? u : `${u} or ${v}`}.`,
            zh: `与 ${u === v ? u : `${u} 或 ${v}`} 相连的 ${others.length} 条边中的其余边。`,
          });
        for (const j of others.slice(i, i + MAX_DIMMED))
          graph.markEdge({ edge: ids[j]!, mark: 'rejected' });
      }
    }
    trace.step(
      'done',
      cover.length === 0
        ? {
            en: 'The graph has no edges, so the empty cover covers them all.',
            zh: '这个图没有边，所以空覆盖就覆盖了所有边。',
          }
        : {
            en: `No edge is left: ${cover.length === 1 ? `the vertex ${cover[0]} covers` : `the ${cover.length} vertices ${cover.join(', ')} cover`} every edge. ${taken.length === 1 ? 'Every cover holds' : `The ${taken.length} edges taken share no vertex, and every cover holds`} an end of ${taken.length === 1 ? 'the edge taken' : 'each'}, so the smallest cover has at least ${taken.length} vertex${taken.length === 1 ? '' : 'es'}: this one is at most twice that.`,
            zh: `没有剩下的边了：${cover.length === 1 ? `顶点 ${cover[0]}` : `${cover.length} 个顶点 ${cover.join(', ')}`} 覆盖了每条边。${taken.length === 1 ? '任何覆盖都包含所取那条边的一个端点' : `所取的 ${taken.length} 条边没有公共顶点，任何覆盖都包含每条边的一个端点`}，所以最小覆盖至少有 ${taken.length} 个顶点：这个覆盖不超过它的两倍。`,
          },
    );
    return { results: [cover.length] };
  },
});
