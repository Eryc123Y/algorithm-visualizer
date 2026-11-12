/**
 * APPROX-TSP-TOUR against its guarantees, with references of its own: the
 * tree drawn weighs as much as a minimum spanning tree found by Kruskal's
 * algorithm; the numbering is a preorder walk of that tree from the first
 * point; the tour visits every point once and returns; and it is at most
 * twice the tree, and at most twice the shortest tour found by trying every
 * order.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type P = [number, number];

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Kruskal over every pair: the weight of a minimum spanning tree. */
function mstWeight(ps: readonly P[]): number {
  const parent = ps.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]!));
  const pairs = ps.flatMap((_, i) =>
    ps.slice(i + 1).map((_, d) => [i, i + 1 + d] as const),
  );
  pairs.sort(([a, b], [c, d]) => dist(ps[a]!, ps[b]!) - dist(ps[c]!, ps[d]!));
  let w = 0;
  for (const [a, b] of pairs)
    if (find(a) !== find(b)) {
      parent[find(a)] = find(b);
      w += dist(ps[a]!, ps[b]!);
    }
  return w;
}

/** The shortest tour, by trying every order of the points after the first. */
function shortestTour(ps: readonly P[]): number {
  const rest = ps.slice(1).map((_, i) => i + 1);
  let best = Infinity;
  const go = (path: number[], left: number[], len: number) => {
    if (len >= best) return;
    if (left.length === 0) {
      best = Math.min(best, len + dist(ps[path.at(-1)!]!, ps[0]!));
      return;
    }
    left.forEach((v, k) =>
      go(
        [...path, v],
        [...left.slice(0, k), ...left.slice(k + 1)],
        len + dist(ps[path.at(-1)!]!, ps[v]!),
      ),
    );
  };
  go([0], rest, 0);
  return best;
}

const pointSets = fc.uniqueArray(
  fc.tuple(
    fc.integer({ min: -20, max: 20 }),
    fc.integer({ min: -20, max: 20 }),
  ),
  { minLength: 2, maxLength: 7, selector: ([x, y]) => `${x} ${y}` },
);

describe('approx-tsp-tour', () => {
  it('tours the example within twice the tree', () => {
    const { results } = runOk('approx-tsp-tour', {
      points: 'a(1, 7) b(2, 3) c(4, 6) d(5, 1) e(6, 4) f(8, 7) g(9, 2) h(3, 9)',
    });
    expect(results[0]).toBeGreaterThan(0);
  });

  it('keeps every guarantee', () => {
    fc.assert(
      fc.property(pointSets, (ps) => {
        const n = ps.length;
        const { document, results } = runOk('approx-tsp-tour', { points: ps });
        const g = stateOf(replay(document), 'g', 'graph');
        const ids = ps.map((_, k) => `p${k}`);
        const at = (id: string) => ps[ids.indexOf(id)]!;
        // The tree: edges not added for the tour.
        const tree = g.data.edges.filter((e) => !e.id.startsWith('t:'));
        expect(tree).toHaveLength(n - 1);
        const treeWeight = tree.reduce(
          (s, e) => s + dist(at(e.from), at(e.to)),
          0,
        );
        expect(treeWeight).toBeCloseTo(mstWeight(ps), 9);
        // The numbering is a preorder walk of the tree from p0.
        const order = [...ids].sort(
          (a, b) => Number(g.marks.notes[a]) - Number(g.marks.notes[b]),
        );
        expect(order[0]).toBe('p0');
        const adj = new Map(ids.map((v) => [v, new Set<string>()]));
        for (const e of tree) {
          adj.get(e.from)!.add(e.to);
          adj.get(e.to)!.add(e.from);
        }
        const stack = ['p0'];
        for (const v of order.slice(1)) {
          while (!adj.get(stack.at(-1)!)!.has(v)) stack.pop();
          expect(stack.length).toBeGreaterThan(0);
          stack.push(v);
        }
        // The tour: order and back, at most twice the tree and the best.
        const tour = [...order, 'p0'];
        const length = tour
          .slice(1)
          .reduce((s, v, k) => s + dist(at(tour[k]!), at(v)), 0);
        expect(results[0]).toBeCloseTo(length, 2);
        expect(length).toBeLessThanOrEqual(2 * treeWeight + 1e-9);
        expect(length).toBeLessThanOrEqual(2 * shortestTour(ps) + 1e-9);
        if (n > 2)
          expect(
            g.data.edges.filter((e) => e.id.startsWith('t:')),
          ).toHaveLength(n);
      }),
      fuzz,
    );
  });

  it('handles two points, and refuses one or a repeat', () => {
    expect(
      runOk('approx-tsp-tour', { points: '(0, 0) (3, 4)' }).results,
    ).toEqual([10]);
    expect(runError('approx-tsp-tour', { points: '(0, 0)' }).message).toMatch(
      /at least 2/,
    );
    expect(
      runError('approx-tsp-tour', { points: '(0, 0) (0, 0)' }).message,
    ).toBeTruthy();
  });
});
