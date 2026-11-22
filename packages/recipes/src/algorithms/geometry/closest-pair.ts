/**
 * The closest pair of points (ADR 0038; CLRS 3rd edition, 33.4), by
 * divide and conquer. The points are presorted by x and by y; each call
 * splits its points by position in the x order at a line l, solves both
 * halves, and then looks for a closer pair across l in the strip of
 * width 2δ, comparing each point there with the next few in y order.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import type { Localized } from '../../text.ts';
import type { Handle } from '../../recorder.ts';
import type { Trace } from '../../trace.ts';
import { dist2, planeOf, pointsField, show, type Pt } from './common.ts';
import { parsePoints } from './common.ts';

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
  title: { en: 'Closest pair of points', zh: '最近点对' },
  topic: 'geometry',
  summary: {
    en: 'Finds the two nearest points by divide and conquer: split at a vertical line, solve both halves, then check the strip around the line, where each point has only a few neighbours to compare.',
    zh: '用分治法找出距离最近的两个点：用一条竖线分开点集，分别求解两半，再检查竖线附近的带状区域，那里每个点只需要和少数几个邻居比较。',
  },
  input: z.strictObject({ points: pointsField(2, MAX_PAIR_POINTS) }),
  main: 'points',
  examples: [
    {
      points: parsePoints(
        '(0, 0) (7, 1) (2, 5) (5, 3) (9, 6) (3, 1) (8, 3) (1, 8) (6, 7)',
      ),
    },
    { points: parsePoints('(0, 0) (10, 0) (5, 1) (5, 9)') },
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
          mid = (len(X) + 1) // 2
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
    const P = trace.add(
      'P',
      planeOf(points, [], trace.say({ en: 'points', zh: '点' })),
    );
    const X = [...points].sort(byX);
    const Y = [...points].sort(byY);
    trace.add('X', {
      kind: 'array',
      place: 'side',
      label: trace.say({ en: 'sorted by x', zh: '按 x 排序' }),
      initial: X.map((p) => p.id),
    });
    trace.add('Y', {
      kind: 'array',
      place: 'side',
      label: trace.say({ en: 'sorted by y', zh: '按 y 排序' }),
      initial: Y.map((p) => p.id),
    });
    const ctx: Ctx = { trace, P, best: undefined, found: 0 };
    solve(ctx, X, Y, undefined);
    const { a, b, d } = ctx.best!;
    trace.step('done', {
      en: `The closest pair is ${show(a)} and ${show(b)}, ${fmt(d)} apart.`,
      zh: `最近点对是 ${show(a)} 和 ${show(b)}，相距 ${fmt(d)}。`,
    });
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

/**
 * Compares two points in a step, keeping them as the closest pair so far
 * if they are closer; returns their distance.
 */
function consider(
  ctx: Ctx,
  a: Pt,
  b: Pt,
  step: string,
  why: Localized,
): number {
  const { trace, P, best } = ctx;
  const d = Math.sqrt(dist2(a, b));
  const closer = best === undefined || d < best.d;
  const verdict =
    best === undefined
      ? ': the closest pair so far.'
      : closer
        ? `, closer than ${fmt(best.d)}: the closest pair so far.`
        : `, not closer than ${fmt(best.d)}.`;
  const verdictZh =
    best === undefined
      ? '：目前最近的一对。'
      : closer
        ? `，比 ${fmt(best.d)} 近：目前最近的一对。`
        : `，不比 ${fmt(best.d)} 近。`;
  trace.step(step, {
    en: `${why.en} ${a.id} and ${b.id} are ${fmt(d)} apart${verdict}`,
    zh: `${why.zh}${a.id} 和 ${b.id} 相距 ${fmt(d)}${verdictZh}`,
  });
  P.compare({ points: [a.id, b.id] });
  if (!closer) return d;
  if (best !== undefined) P.removeSegment({ id: `best-${ctx.found}` });
  ctx.found++;
  const id = `best-${ctx.found}`;
  P.addSegment({
    segment: { id, from: a.id, to: b.id, label: fmt(d) },
  }).select({ segment: id, on: true });
  ctx.best = { a, b, d };
  return d;
}

/**
 * One call: brute force, or divide, solve both halves and check the
 * strip; returns δ, the least distance among its points.
 */
function solve(
  ctx: Ctx,
  X: readonly Pt[],
  Y: readonly Pt[],
  parentLine: number | undefined,
): number {
  const { trace, P } = ctx;
  if (X.length <= 3) {
    let least = Infinity;
    for (let i = 0; i < X.length; i++)
      for (let j = i + 1; j < X.length; j++)
        least = Math.min(
          least,
          consider(ctx, X[i]!, X[j]!, 'brute', {
            en: `${X.length} points: compare every pair.`,
            zh: `${X.length} 个点：比较每一对。`,
          }),
        );
    return least;
  }
  const half = Math.ceil(X.length / 2);
  const l = X[half - 1]!.x;
  const XL = X.slice(0, half);
  const left = new Set(XL);
  trace.step('divide', {
    en: `${X.length} points: split them at the line x = ${l}, the first ${half} in x order (${XL.map((p) => p.id).join(' ')}) on the left and ${X.length - half} on the right.`,
    zh: `${X.length} 个点：用直线 x = ${l} 分开它们，按 x 排序的前 ${half} 个（${XL.map((p) => p.id).join(' ')}）在左边，其余 ${X.length - half} 个在右边。`,
  });
  P.line({ name: 'l', x: l }).highlight({ points: XL.map((p) => p.id) });
  const dl = solve(
    ctx,
    XL,
    Y.filter((p) => left.has(p)),
    l,
  );
  const dr = solve(
    ctx,
    X.slice(half),
    Y.filter((p) => !left.has(p)),
    l,
  );
  // δ of the two halves; a closer pair would have to cross the line.
  let delta = Math.min(dl, dr);
  const strip = Y.filter((p) => Math.abs(p.x - l) < delta);
  trace.step('strip', {
    en: `Back at the ${X.length} points split at x = ${l}, with δ = ${fmt(delta)}, the least distance within either half: a closer pair would have to lie within δ of the line, where ${strip.length === 0 ? 'there is no point' : `the points are ${strip.map((p) => p.id).join(' ')}`}.`,
    zh: `回到在 x = ${l} 处分开的 ${X.length} 个点，δ = ${fmt(delta)} 是两半内部的最小距离：更近的一对只能在距直线 δ 以内，${strip.length === 0 ? '那里没有点' : `那里的点是 ${strip.map((p) => p.id).join(' ')}`}。`,
  });
  P.line({ name: 'l', x: l })
    .line({ name: 'l − δ', x: l - delta })
    .line({ name: 'l + δ', x: l + delta });
  if (strip.length > 0) P.highlight({ points: strip.map((p) => p.id) });
  strip.forEach((p, i) => {
    for (const q of strip.slice(i + 1, i + 8)) {
      if (q.y - p.y >= delta) break;
      delta = Math.min(
        delta,
        consider(ctx, p, q, 'compare', {
          en: 'In the strip, in y order:',
          zh: '在带状区域中，按 y 的顺序：',
        }),
      );
    }
  });
  P.line({ name: 'l − δ', x: null }).line({ name: 'l + δ', x: null });
  if (parentLine !== undefined) P.line({ name: 'l', x: parentLine });
  return delta;
}
