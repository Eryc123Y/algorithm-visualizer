/**
 * Hopcroft–Karp against a brute force that tries every set of edges, on
 * random bipartite graphs with the nodes in any order, edges either way
 * round and parallel edges. Beyond the size, the trace keeps the
 * algorithm's own promises: in each phase the paths found are augmenting,
 * vertex-disjoint and of one length, the shortest there is; that length
 * grows from phase to phase; and there are at most 2√V + 2 phases.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Pair = [string, string];

/** The largest matching, by trying each edge in or out. */
function maxMatching(edges: readonly Pair[]): number {
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
  .tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }))
  .chain(([l, r]) => {
    const left = Array.from({ length: l }, (_, k) => `l${k}`);
    const right = Array.from({ length: r }, (_, k) => `r${k}`);
    return fc.record({
      nodes: fc.shuffledSubarray([...left, ...right], { minLength: l + r }),
      edges: fc.array(
        fc
          .tuple(
            fc.constantFrom(...left),
            fc.constantFrom(...right),
            fc.boolean(),
          )
          .map(([a, b, flip]): Pair => (flip ? [b, a] : [a, b])),
        { maxLength: 14 },
      ),
    });
  });

/** The paths each phase highlights, read from its `path` steps. */
function phases(document: ReturnType<typeof runOk>['document']) {
  const out: string[][][] = [];
  for (const step of document.steps) {
    const at = step.meta?.at;
    if (at === 'layer') out.push([]);
    if (at !== 'path') continue;
    const lit = step.actions.find((a) => a.type === 'highlight') as
      { nodes: string[] } | undefined;
    out.at(-1)!.push(lit!.nodes);
  }
  return out.filter((p) => p.length > 0);
}

describe('hopcroft-karp', () => {
  it('matches the example in three pairs', () => {
    const { results } = runOk('hopcroft-karp', {
      graph: 'a-p, b-p, b-r, c-q, c-r, c-s, d-r, e-r',
    });
    expect(results).toEqual([3]);
  });

  it('finds a largest matching, by disjoint shortest paths in phases', () => {
    fc.assert(
      fc.property(bipartite, ({ nodes, edges }) => {
        const want = maxMatching(edges);
        const { document, results } = runOk('hopcroft-karp', {
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

        const joined = new Set(
          edges.flatMap(([a, b]) => [`${a} ${b}`, `${b} ${a}`]),
        );
        const found = phases(document);
        let last = 0;
        let size = 0;
        for (const paths of found) {
          const length = paths[0]!.length - 1;
          expect(length).toBeGreaterThan(last);
          last = length;
          const seen = paths.flat();
          expect(new Set(seen).size).toBe(seen.length);
          for (const p of paths) {
            expect(p.length - 1).toBe(length);
            p.slice(1).forEach((v, k) =>
              expect(joined.has(`${p[k]} ${v}`)).toBe(true),
            );
          }
          size += paths.length;
        }
        expect(size).toBe(want);
        expect(found.length).toBeLessThanOrEqual(
          2 * Math.sqrt(nodes.length) + 2,
        );
      }),
      fuzz,
    );
  });

  it('augments along several paths in one phase', () => {
    // Four disjoint edges: the first phase finds all four paths of length 1.
    const { document } = runOk('hopcroft-karp', {
      graph: 'a-p, b-q, c-r, d-s',
    });
    expect(phases(document).map((p) => p.length)).toEqual([4]);
  });

  it('handles parallel edges, no edges and 40 vertices', () => {
    const { document, results } = runOk('hopcroft-karp', {
      graph: 'a-p, p-a, a-p',
    });
    expect(results).toEqual([1]);
    const g = stateOf(replay(document), 'g', 'graph');
    expect(
      g.data.edges.filter((e) => g.marks.edgeMarks[e.id] === 'selected'),
    ).toHaveLength(1);
    const lone = Array.from({ length: 40 }, (_, k) => `v${k}`);
    expect(
      runOk('hopcroft-karp', { graph: { nodes: lone, edges: [] } }).results,
    ).toEqual([0]);
    // A ladder of 20 rungs and 19 crossings: every step stays in bounds.
    const ladder = Array.from({ length: 20 }, (_, k): Pair[] => [
      [`l${k}`, `r${k}`],
      ...(k > 0 ? [[`l${k}`, `r${k - 1}`] as Pair] : []),
    ]).flat();
    const big = runOk('hopcroft-karp', {
      graph: ladder.map(([a, b]) => `${a}-${b}`).join(', '),
    });
    expect(big.results).toEqual([20]);
    for (const step of big.document.steps)
      expect(step.actions.length).toBeLessThanOrEqual(100);
  });

  it('refuses a graph that is not bipartite', () => {
    expect(
      runError('hopcroft-karp', { graph: 'a-b, b-c, c-a' }).message,
    ).toMatch(/not bipartite/);
    expect(runError('hopcroft-karp', { graph: 'a-a' }).message).toMatch(
      /joins a vertex to itself/,
    );
  });
});
