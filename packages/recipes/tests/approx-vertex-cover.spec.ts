/**
 * APPROX-VERTEX-COVER against a brute force over every set of vertices:
 * what it returns covers every edge, the edges it takes share no vertex,
 * and it is at most twice the smallest cover.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runOk, stateOf } from './helpers.ts';

type Pair = [string, string];

/** The size of the smallest vertex cover. */
function smallestCover(
  nodes: readonly string[],
  edges: readonly Pair[],
): number {
  let best = nodes.length;
  for (let mask = 0; mask < 1 << nodes.length; mask++) {
    const c = new Set(nodes.filter((_, k) => mask & (1 << k)));
    if (c.size < best && edges.every(([a, b]) => c.has(a) || c.has(b)))
      best = c.size;
  }
  return best;
}

const graphs = fc.integer({ min: 1, max: 9 }).chain((n) => {
  const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
  return fc.record({
    nodes: fc.constant(nodes),
    edges: fc.array(
      fc.tuple(fc.constantFrom(...nodes), fc.constantFrom(...nodes)),
      {
        maxLength: 16,
      },
    ),
  });
});

describe('approx-vertex-cover', () => {
  it('covers CLRS’s graph with 6 vertices, twice the 3 of the best', () => {
    const graph = 'a-b, b-c, c-d, c-e, d-e, d-f, d-g, e-f';
    const { results } = runOk('approx-vertex-cover', { graph });
    expect(results).toEqual([6]);
  });

  it('covers every edge, by disjoint edges, within twice the smallest', () => {
    fc.assert(
      fc.property(graphs, ({ nodes, edges }) => {
        const { document, results } = runOk('approx-vertex-cover', {
          graph: { nodes, edges },
        });
        const g = stateOf(replay(document), 'g', 'graph');
        const cover = new Set(
          Object.entries(g.marks.groups)
            .filter(([, group]) => group === 0)
            .map(([v]) => v),
        );
        expect(results).toEqual([cover.size]);
        for (const [a, b] of edges)
          expect(cover.has(a) || cover.has(b)).toBe(true);
        const taken = g.data.edges.filter(
          (e) => g.marks.edgeMarks[e.id] === 'selected',
        );
        const ends = taken.flatMap((e) =>
          e.from === e.to ? [e.from] : [e.from, e.to],
        );
        expect(new Set(ends).size).toBe(ends.length);
        expect(cover.size).toBe(ends.length);
        expect(cover.size).toBeLessThanOrEqual(2 * smallestCover(nodes, edges));
      }),
      fuzz,
    );
  });

  it('narrates a graph with no edges, and a loop', () => {
    const none = runOk('approx-vertex-cover', {
      graph: { nodes: ['a'], edges: [] },
    });
    expect(none.results).toEqual([0]);
    expect(none.document.steps.at(-1)!.meta?.narration).toMatch(/no edges/);
    const loop = runOk('approx-vertex-cover', { graph: 'a-a, a-b' });
    expect(loop.results).toEqual([1]);
    expect(loop.document.steps.at(-1)!.meta?.narration).toMatch(
      /the vertex a covers every edge/,
    );
  });
});
