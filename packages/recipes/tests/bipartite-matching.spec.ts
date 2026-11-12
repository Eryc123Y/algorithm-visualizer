/**
 * Maximum bipartite matching against a brute force that tries every set
 * of edges, on random bipartite graphs with the nodes in any order, edges
 * either way round and parallel edges: the size, a valid matching drawn,
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
      nodes: fc.shuffledSubarray([...left, ...right], {
        minLength: l + r,
      }),
      edges: fc.array(
        fc
          .tuple(
            fc.constantFrom(...left),
            fc.constantFrom(...right),
            fc.boolean(),
          )
          .map(([a, b, flip]): [string, string] => (flip ? [b, a] : [a, b])),
        { maxLength: 12 },
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

  it('marks one of parallel edges, and draws 40 vertices in bounds', () => {
    const { document, results } = runOk('bipartite-matching', {
      graph: 'a-p, p-a, a-p',
    });
    expect(results).toEqual([1]);
    const g = stateOf(replay(document), 'g', 'graph');
    expect(
      g.data.edges.filter((e) => g.marks.edgeMarks[e.id] === 'selected'),
    ).toHaveLength(1);
    // 40 vertices with no edges split 20 and 20, in rows 44 apart.
    const lone = Array.from({ length: 40 }, (_, k) => `v${k}`);
    const big = runOk('bipartite-matching', {
      graph: { nodes: lone, edges: [] },
    });
    expect(big.results).toEqual([0]);
    const ys = stateOf(replay(big.document), 'g', 'graph').data.nodes.map(
      (n) => n.y ?? 0,
    );
    expect(Math.max(...ys)).toBe(40 + 19 * 44);
    expect(big.document.steps[0]!.meta?.narration).toMatch(/none can be/);
  });

  it('refuses a graph with an odd cycle or a loop', () => {
    expect(
      runError('bipartite-matching', { graph: 'a-b, b-c, c-a' }).message,
    ).toMatch(/not bipartite/);
    expect(
      runError('bipartite-matching', { graph: 'a-b, b-b' }).message,
    ).toMatch(/joins a vertex to itself/);
  });
});
