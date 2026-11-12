/**
 * The closest pair of points (ADR 0038; CLRS 3rd edition, 33.4), by
 * divide and conquer. The points are presorted by x and by y; each call
 * splits its points by position in the x order at a line l, solves both
 * halves, and then looks for a closer pair across l in the strip of
 * width 2δ, comparing each point there with the next few in y order.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import type { Handle } from '../../recorder.ts';
import type { Trace } from '../../trace.ts';
import { dist2, planeOf, pointsField, show, type Pt } from './common.ts';

/** Most points the module takes. */
export const MAX_PAIR_POINTS = 16;

const byX = (a: Pt, b: Pt) => a.x - b.x || a.y - b.y;
const byY = (a: Pt, b: Pt) => a.y - b.y || a.x - b.x;
const fmt = (d: number) => String(Math.round(d * 100) / 100);

interface Best {
  readonly a: Pt;
  readonly b: Pt;
  readonly d: number;
}

export const closestPair = defineAlgorithm({
  id: 'closest-pair',
  title: 'Closest pair of points',
  topic: 'geometry',
  summary:
    'Finds the two nearest points by divide and conquer: split at a vertical line, solve both halves, then check the strip around the line, where each point has only a few neighbours to compare.',
  input: z.strictObject({ points: pointsField(2, MAX_PAIR_POINTS) }),
  main: 'points',
  examples: [
    {
      points: '(0, 0) (7, 1) (2, 5) (5, 3) (9, 6) (3, 1) (8, 3) (1, 8) (6, 7)',
    },
    {
      points: [
        [0, 0],
        [10, 0],
        [5, 1],
        [5, 9],
      ],
    },
  ],
  code: {
    pseudocode: `
      CLOSEST-PAIR(X, Y)  // X sorted by x, Y by y
          if |X| ≤ 3
              compare every pair  // @brute
              return the closest
          l = the x of the middle point of X; split X and Y at it  // @divide
          δ = min(CLOSEST-PAIR(XL, YL), CLOSEST-PAIR(XR, YR))
          Y' = the points of Y within δ of the line x = l  // @strip
          for each p in Y'
              for each of the next 7 points q in Y' after p, closer than δ in y
                  if dist(p, q) < δ  // @compare
                      δ = dist(p, q)
          return δ  // @done
    `,
    python: `
      def closest_pair(X, Y):
          # X sorted by x, Y by y
          if len(X) <= 3:
              return min(dist(p, q) for p, q in pairs(X))  # @brute
          mid = len(X) // 2
          l = X[mid - 1].x  # @divide
          XL, XR = X[:mid], X[mid:]
          YL = [p for p in Y if p in XL]
          YR = [p for p in Y if p not in XL]
          d = min(closest_pair(XL, YL), closest_pair(XR, YR))
          strip = [p for p in Y if abs(p.x - l) < d]  # @strip
          for i, p in enumerate(strip):
              for q in strip[i + 1:i + 8]:
                  if q.y - p.y >= d:
                      break
                  if dist(p, q) < d:  # @compare
                      d = dist(p, q)
          return d  # @done
    `,
  },
  run({ points }, trace) {
    const P = trace.add('P', planeOf(points));
    const X = [...points].sort(byX);
    const Y = [...points].sort(byY);
    trace.add('X', {
      kind: 'array',
      place: 'side',
      label: 'sorted by x',
      initial: X.map((p) => p.id),
    });
    trace.add('Y', {
      kind: 'array',
      place: 'side',
      label: 'sorted by y',
      initial: Y.map((p) => p.id),
    });
    const ctx: Ctx = { trace, P, best: undefined, found: 0 };
    solve(ctx, X, Y, undefined);
    const { a, b, d } = ctx.best!;
    trace.step(
      'done',
      `The closest pair is ${show(a)} and ${show(b)}, ${fmt(d)} apart.`,
    );
    P.line({ name: 'l', x: null });
    return { results: [d] };
  },
});

interface Ctx {
  readonly trace: Trace;
  readonly P: Handle<'plane'>;
  /** The closest pair so far. */
  best: Best | undefined;
  /** How many pairs have been the closest; ids are never reused. */
  found: number;
}

/** δ so far: the distance of the closest pair found. */
const deltaOf = (ctx: Ctx) => ctx.best?.d ?? Infinity;

/** Compares two points in a step, keeping them if they are closer. */
function consider(ctx: Ctx, a: Pt, b: Pt, step: string, why: string): void {
  const { trace, P, best } = ctx;
  const d = Math.sqrt(dist2(a, b));
  const closer = best === undefined || d < best.d;
  const verdict =
    best === undefined
      ? ': the closest pair so far.'
      : closer
        ? `, closer than ${fmt(best.d)}: the closest pair so far.`
        : `, not closer than ${fmt(best.d)}.`;
  trace.step(step, `${why} ${a.id} and ${b.id} are ${fmt(d)} apart${verdict}`);
  P.compare({ points: [a.id, b.id] });
  if (!closer) return;
  if (best !== undefined) P.removeSegment({ id: `best${ctx.found}` });
  ctx.found++;
  const id = `best${ctx.found}`;
  P.addSegment({
    segment: { id, from: a.id, to: b.id, label: fmt(d) },
  }).select({ segment: id, on: true });
  ctx.best = { a, b, d };
}

/** One call: brute force, or divide, solve both halves and check the strip. */
function solve(
  ctx: Ctx,
  X: readonly Pt[],
  Y: readonly Pt[],
  parentLine: number | undefined,
): void {
  const { trace, P } = ctx;
  if (X.length <= 3) {
    for (let i = 0; i < X.length; i++)
      for (let j = i + 1; j < X.length; j++)
        consider(
          ctx,
          X[i]!,
          X[j]!,
          'brute',
          `${X.length} points: compare every pair.`,
        );
    return;
  }
  const half = Math.ceil(X.length / 2);
  const l = X[half - 1]!.x;
  const XL = X.slice(0, half);
  const left = new Set(XL);
  trace.step(
    'divide',
    `${X.length} points: split them at the line x = ${l}, the first ${half} in x order (${XL.map((p) => p.id).join(' ')}) on the left and ${X.length - half} on the right.`,
  );
  P.line({ name: 'l', x: l }).highlight({ points: XL.map((p) => p.id) });
  solve(
    ctx,
    XL,
    Y.filter((p) => left.has(p)),
    l,
  );
  solve(
    ctx,
    X.slice(half),
    Y.filter((p) => !left.has(p)),
    l,
  );
  // The strip around the line, where a closer pair may cross it.
  const delta = deltaOf(ctx);
  const strip = Y.filter((p) => Math.abs(p.x - l) < delta);
  trace.step(
    'strip',
    `Back at the ${X.length} points split at x = ${l}, with δ = ${fmt(delta)}: a closer pair would have to lie within δ of the line, where ${strip.length === 0 ? 'there is no point' : `the points are ${strip.map((p) => p.id).join(' ')}`}.`,
  );
  P.line({ name: 'l', x: l })
    .line({ name: 'l − δ', x: l - delta })
    .line({ name: 'l + δ', x: l + delta });
  if (strip.length > 0) P.highlight({ points: strip.map((p) => p.id) });
  strip.forEach((p, i) => {
    for (const q of strip.slice(i + 1, i + 8)) {
      if (q.y - p.y >= deltaOf(ctx)) break;
      consider(ctx, p, q, 'compare', 'In the strip, in y order:');
    }
  });
  P.line({ name: 'l − δ', x: null }).line({ name: 'l + δ', x: null });
  if (parentLine !== undefined) P.line({ name: 'l', x: parentLine });
}
