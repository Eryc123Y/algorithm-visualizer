/**
 * Maximum bipartite matching against a brute force that tries every set
 * of edges, on random bipartite graphs: the size, a valid matching drawn,
 * and the refusal of a graph that is not bipartite.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** The largest matching, by trying each edge in or out. */
function maxMatching(edges: readonly [string, string][]): number {
  const best = (k: number, used: Set<string>): number => {
    if (k === edges.length) return 0;
    const [a, b] = edges[k]!;
    const without = best(k + 1, used);
    if (used.has(a) || used.has(b)) return without;
    const next = new Set(used);
    next.add(a).add(b);
    return Math.max(without, 1 + best(k + 1, next));
  };
  return best(0, new Set());
}

const bipartite = fc
  .tuple(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }))
  .chain(([l, r]) => {
    const left = Array.from({ length: l }, (_, k) => `l${k}`);
    const right = Array.from({ length: r }, (_, k) => `r${k}`);
    return fc.record({
      nodes: fc.constant([...left, ...right]),
      edges: fc.uniqueArray(
        fc.tuple(fc.constantFrom(...left), fc.constantFrom(...right)),
        { maxLength: 12, selector: ([a, b]) => `${a} ${b}` },
      ),
    });
  });

describe('bipartite-matching', () => {
  it('matches CLRS-style example in three pairs', () => {
    const { results } = runOk('bipartite-matching', {
      graph: 'a-p, b-p, b-r, c-q, c-r, c-s, d-r, e-r',
    });
    expect(results).toEqual([3]);
  });

  it('finds a largest matching, drawn as marked edges', () => {
    fc.assert(
      fc.property(bipartite, ({ nodes, edges }) => {
        const want = maxMatching(edges);
        const { document, results } = runOk('bipartite-matching', {
          graph: { nodes, edges },
        });
        expect(results).toEqual([want]);
        const g = stateOf(replay(document), 'g', 'graph');
        const marked = g.data.edges.filter(
          (e) => g.marks.edgeMarks[e.id] === 'selected',
        );
        expect(marked).toHaveLength(want);
        const ends = marked.flatMap((e) => [e.from, e.to]);
        expect(new Set(ends).size).toBe(ends.length);
      }),
      fuzz,
    );
  });

  it('refuses a graph with an odd cycle', () => {
    expect(
      runError('bipartite-matching', { graph: 'a-b, b-c, c-a' }).message,
    ).toMatch(/not bipartite/);
  });
});
