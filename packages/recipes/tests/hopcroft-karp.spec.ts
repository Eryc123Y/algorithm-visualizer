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

/**
 * The length of the shortest augmenting path for `mate`, by its own
 * breadth-first search: from the free vertices of one colour, out by
 * unmatched edges and back by matched ones, to a free vertex.
 */
function shortestAugmenting(
  nodes: readonly string[],
  edges: readonly Pair[],
  mate: ReadonlyMap<string, string>,
): number {
  const adj = new Map(nodes.map((v) => [v, [] as string[]]));
  for (const [a, b] of edges) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const colour = new Map<string, number>();
  for (const s of nodes) {
    if (colour.has(s)) continue;
    colour.set(s, 0);
    const queue = [s];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const v of adj.get(u)!)
        if (!colour.has(v)) {
          colour.set(v, 1 - colour.get(u)!);
          queue.push(v);
        }
    }
  }
  const dist = new Map<string, number>();
  const queue = nodes.filter((v) => colour.get(v) === 0 && !mate.has(v));
  for (const v of queue) dist.set(v, 0);
  while (queue.length > 0) {
    const u = queue.shift()!;
    const d = dist.get(u)!;
    for (const v of adj.get(u)!) {
      // Odd steps leave by a matched edge, even ones by an unmatched one.
      if ((mate.get(u) === v) !== (d % 2 === 1) || dist.has(v)) continue;
      dist.set(v, d + 1);
      if (d % 2 === 0 && !mate.has(v)) return d + 1;
      queue.push(v);
    }
  }
  return Infinity;
}

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
        // Replay the phases on a matching of our own: each path is a
        // shortest augmenting one, the paths are disjoint, and after a
        // phase no augmenting path of its length is left (so the set was
        // maximal).
        const found = phases(document);
        const mate = new Map<string, string>();
        for (const paths of found) {
          const length = paths[0]!.length - 1;
          expect(length).toBe(shortestAugmenting(nodes, edges, mate));
          const seen = paths.flat();
          expect(new Set(seen).size).toBe(seen.length);
          for (const p of paths) {
            expect(p.length - 1).toBe(length);
            expect(mate.has(p[0]!) || mate.has(p.at(-1)!)).toBe(false);
            p.slice(1).forEach((v, k) => {
              expect(joined.has(`${p[k]} ${v}`)).toBe(true);
              expect(mate.get(p[k]!) === v).toBe(k % 2 === 1);
            });
          }
          for (const p of paths)
            for (let k = 0; k + 1 < p.length; k += 2) {
              mate.set(p[k]!, p[k + 1]!);
              mate.set(p[k + 1]!, p[k]!);
            }
          expect(shortestAugmenting(nodes, edges, mate)).toBeGreaterThan(
            length,
          );
        }
        expect(shortestAugmenting(nodes, edges, mate)).toBe(Infinity);
        expect(mate.size / 2).toBe(want);
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

  it('notes each vertex’s layer, dropping layers past the shortest', () => {
    // Phase 1 matches x–p and z–r; u's search in phase 2 reaches q in
    // layer 3, so z, which would be in layer 4, has no note.
    const { document } = runOk('hopcroft-karp', {
      graph: 'x-p, z-r, u-p, x-q, x-r',
    });
    const trace = replay(document);
    const layerSteps = document.steps.flatMap((s, k) =>
      s.meta?.at === 'layer' ? [k + 1] : [],
    );
    const notes = (frame: number) =>
      stateOf(trace, 'g', 'graph', frame).marks.notes;
    expect(notes(layerSteps[0]!)).toEqual({
      x: '0',
      z: '0',
      u: '0',
      p: '1',
      q: '1',
      r: '1',
    });
    expect(notes(layerSteps[1]!)).toEqual({
      u: '0',
      p: '1',
      x: '2',
      q: '3',
      r: '3',
    });
    expect(notes(trace.length)).toEqual({});
  });

  it('narrates each case', () => {
    const said = (graph: string) =>
      runOk('hopcroft-karp', { graph }).document.steps.map(
        (s) => s.meta?.narration ?? '',
      );
    const one = said('a-p, b-p');
    expect(one).toContain(
      'b has no such path that shares no vertex with these. Match the pair, so the matching grows from 0 to 1.',
    );
    expect(one.at(-2)).toMatch(/reaches no free vertex on the right/);
    expect(one.at(-1)).toBe(
      'The 1 marked edge forms a maximum matching, found in 1 phase.',
    );
    const two = said('a-p, b-q, c-p, c-q, d-p');
    expect(two).toContain(
      'c d have no such path that shares no vertex with these. Match the 2 pairs at once, so the matching grows from 0 to 2.',
    );
    const long = said('x-p, z-r, u-p, x-q, x-r');
    expect(long).toContain(
      'Flip the path: its unmatched edges go in and its matched ones out, so the matching grows from 2 to 3.',
    );
    expect(long.at(-2)).toMatch(/every vertex on the left is matched/);
    expect(said('a, b').at(-1)).toBe(
      'No augmenting path is left, and the matching is empty.',
    );
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
    // K10,20: the most edges a graph may have.
    const full = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 20 }, (_, j): Pair => [`a${i}`, `b${j}`]),
    ).flat();
    const dense = runOk('hopcroft-karp', {
      graph: {
        nodes: [...full.map(([a]) => a), ...full.map(([, b]) => b)].filter(
          (v, k, all) => all.indexOf(v) === k,
        ),
        edges: full,
      },
    });
    expect(dense.results).toEqual([10]);
    for (const step of dense.document.steps)
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
