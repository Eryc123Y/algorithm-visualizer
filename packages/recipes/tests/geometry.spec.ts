/**
 * The geometry modules (ADR 0038) against independent references: the
 * hull by Andrew's monotone chain, intersections by testing every pair,
 * and the closest pair by measuring every pair. Random points come from a
 * small grid, so that collinear points, equal x and shared ends happen.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type P = readonly [number, number];
const cross = (o: P, a: P, b: P) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** The hull's vertices by Andrew's monotone chain, no collinear ones. */
function hullOf(points: readonly P[]): string[] {
  const ps = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const chain = (list: readonly P[]) => {
    const out: P[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...chain(ps), ...chain([...ps].reverse())]
    .map((p) => `${p[0]},${p[1]}`)
    .sort();
}

/** Whether any two of the segments meet, by testing every pair. */
function anyMeet(segments: readonly [P, P][]): boolean {
  const on = (a: P, b: P, p: P) =>
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1]);
  const meet = ([a, b]: [P, P], [c, d]: [P, P]) => {
    const [d1, d2, d3, d4] = [
      cross(c, d, a),
      cross(c, d, b),
      cross(a, b, c),
      cross(a, b, d),
    ];
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    return (
      (d1 === 0 && on(c, d, a)) ||
      (d2 === 0 && on(c, d, b)) ||
      (d3 === 0 && on(a, b, c)) ||
      (d4 === 0 && on(a, b, d))
    );
  };
  return segments.some((s, i) => segments.slice(i + 1).some((t) => meet(s, t)));
}

const grid = (n: number) =>
  fc.tuple(fc.integer({ min: 0, max: n }), fc.integer({ min: 0, max: n }));
const distinctPoints = (min: number, max: number) =>
  fc.uniqueArray(grid(8), {
    minLength: min,
    maxLength: max,
    selector: (p) => p.join(),
  });
const notCollinear = (ps: readonly P[]) =>
  ps.some((p) => cross(ps[0]!, ps[1]!, p) !== 0);

/** The settled points and the selected segments' ends, as `x,y`. */
function hullDrawn(trace: Trace): { vertices: string[]; edges: number } {
  const P = stateOf(trace, 'P', 'plane');
  const at = new Map(P.data.points.map((p) => [p.id, `${p.x},${p.y}`]));
  return {
    vertices: P.marks.settled.map((id) => at.get(id)!).sort(),
    edges: P.marks.selected.length,
  };
}

describe('geometry', () => {
  it('finds the hull as the monotone chain does, by both methods', () => {
    fc.assert(
      fc.property(distinctPoints(3, 24).filter(notCollinear), (points) => {
        const want = hullOf(points);
        for (const id of ['graham-scan', 'jarvis-march']) {
          const { document, results } = runOk(id, { points });
          expect(results, id).toEqual([want.length]);
          const drawn = hullDrawn(replay(document));
          expect(drawn.vertices, id).toEqual(want);
          expect(drawn.edges, id).toBe(want.length);
        }
      }),
      fuzz,
    );
  });

  it('decides intersection as testing every pair does', () => {
    const segment = fc
      .tuple(grid(8), grid(8))
      .filter(([a, b]) => a[0] !== b[0]);
    fc.assert(
      fc.property(
        fc.uniqueArray(segment, {
          minLength: 1,
          maxLength: 12,
          selector: ([a, b]) => [a.join(), b.join()].sort().join(' '),
        }),
        (segments) => {
          const { results } = runOk('any-segments-intersect', { segments });
          expect(results).toEqual([anyMeet(segments)]);
        },
      ),
      fuzz,
    );
  });

  it('finds the closest pair as measuring every pair does', () => {
    fc.assert(
      fc.property(distinctPoints(2, 16), (points) => {
        let d = Infinity;
        points.forEach((p, i) =>
          points.slice(i + 1).forEach((q) => {
            d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
          }),
        );
        const { document, results } = runOk('closest-pair', { points });
        expect(results[0]).toBeCloseTo(d, 9);
        // The selected segment joins a closest pair.
        const P = stateOf(replay(document), 'P', 'plane');
        const best = P.data.segments.filter((s) =>
          P.marks.selected.includes(s.id),
        );
        expect(best).toHaveLength(1);
        const at = new Map(P.data.points.map((p) => [p.id, p]));
        const [a, b] = [at.get(best[0]!.from)!, at.get(best[0]!.to)!];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(d, 9);
      }),
      fuzz,
    );
  });

  it('reads points and segments in the notation', () => {
    const { document } = runOk('graham-scan', {
      points: 'a(0, 0) (4, 1), b(2, 5)',
    });
    const P = stateOf(replay(document), 'P', 'plane');
    expect(P.data.points.map((p) => p.id)).toEqual(['a', 'p0', 'b']);
    const s = runOk('any-segments-intersect', {
      segments: 'r: (0, 0)-(4, 4), (0, 4)-(4, 0)',
    });
    expect(s.results).toEqual([true]);
    const shared = stateOf(replay(s.document), 'P', 'plane');
    expect(shared.data.segments.map((x) => x.id)).toEqual(['r', 's1']);
    // Segments that share an end share its point.
    const joined = runOk('any-segments-intersect', {
      segments: '(0, 0)-(2, 2), (2, 2)-(4, 0)',
    });
    expect(
      stateOf(replay(joined.document), 'P', 'plane').data.points,
    ).toHaveLength(3);
  });

  it('refuses what it cannot draw or solve', () => {
    expect(
      runError('graham-scan', { points: '(0, 0) (1, 1) (2, 2)' }).message,
    ).toMatch(/one line/);
    expect(
      runError('jarvis-march', { points: '(0, 0) (0, 0) (1, 2)' }).message,
    ).toMatch(/Two points are at/);
    expect(runError('closest-pair', { points: '(0, 0) (1, x)' }).code).toBe(
      'INVALID_NOTATION',
    );
    expect(runError('closest-pair', { points: '(0, 0) (1000, 1)' }).code).toBe(
      'INVALID_NOTATION',
    );
    expect(
      runError('any-segments-intersect', { segments: '(1, 0)-(1, 5)' }).message,
    ).toMatch(/vertical/);
    expect(
      runError('any-segments-intersect', {
        segments: '(0, 0)-(2, 1), (2, 1)-(0, 0)',
      }).message,
    ).toMatch(/same ends/);
  });
});
