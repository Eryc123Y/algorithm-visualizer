/**
 * Graham's scan (ADR 0038; CLRS 3rd edition, 33.3). From the lowest
 * point p0, the others are sorted by polar angle with cross products,
 * keeping the farthest of points at one angle; a stack holds the hull
 * so far, and a point that would not make a left turn pops the top.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  cross,
  dist2,
  lowest,
  planeOf,
  pointsField,
  show,
  turn,
  turnZh,
  type Pt,
} from './common.ts';
import { parsePoints } from './common.ts';

/** Most points a hull module takes. */
export const MAX_HULL_POINTS = 24;

export const hullInput = z
  .strictObject({ points: pointsField(3, MAX_HULL_POINTS) })
  .superRefine(({ points }, ctx) => {
    const [a, b] = [points[0]!, points[1]!];
    if (points.every((p) => cross(a, b, p) === 0))
      ctx.addIssue({
        code: 'custom',
        path: ['points'],
        message: 'The points are all on one line, so they have no hull',
      });
  });

/** The others sorted by polar angle about p0, the farthest kept per angle. */
export function polarOrder(p0: Pt, others: readonly Pt[]) {
  const sorted = [...others].sort((a, b) => {
    const c = cross(p0, a, b);
    return c !== 0 ? -c : dist2(p0, a) - dist2(p0, b);
  });
  const kept: Pt[] = [];
  const dropped: Pt[] = [];
  sorted.forEach((p, k) => {
    const next = sorted[k + 1];
    if (next !== undefined && cross(p0, p, next) === 0) dropped.push(p);
    else kept.push(p);
  });
  return { kept, dropped };
}

const edgeId = (a: Pt, b: Pt) => `${a.id}-${b.id}`;

export const grahamScan = defineAlgorithm({
  id: 'graham-scan',
  title: { en: 'Graham’s scan', zh: 'Graham 扫描法' },
  topic: 'geometry',
  summary: {
    en: 'Finds the convex hull: sorts the points by polar angle about the lowest one, then keeps a stack of hull points, popping each that a new point shows is not a left turn.',
    zh: '求凸包：以最低的点为中心按极角给其他点排序，再用一个栈保存凸包上的点，新点表明某个点不构成左转时就把它弹出。',
  },
  input: hullInput,
  main: 'points',
  examples: [
    {
      points: parsePoints(
        '(0, 0) (4, 1) (6, 4) (3, 6) (-1, 4) (2, 2) (3, 3) (1, 4)',
      ),
    },
    { points: parsePoints('(0, 0) (2, 0) (4, 0) (4, 4) (2, 2) (0, 4)') },
  ],
  code: {
    pseudocode: `
      GRAHAM-SCAN(Q)
          p0 = the point of Q with the least y, the leftmost of those  // @p0
          sort the rest by polar angle about p0, farthest only at an angle  // @sort
          S = an empty stack
          PUSH(p0, S); PUSH(p1, S); PUSH(p2, S)  // @start
          let p1, …, pm be the rest, in that order
          for i = 3 to m
              while the turn from NEXT-TO-TOP(S) to TOP(S) to pi is not left  // @turn
                  POP(S)  // @pop
              PUSH(pi, S)  // @push
          return S  // @done
    `,
    python: `
      def graham_scan(Q):
          p0 = min(Q, key=lambda p: (p.y, p.x))  # @p0
          rest = by_polar_angle(p0, [p for p in Q if p is not p0])  # @sort
          S = [p0, rest[0], rest[1]]  # @start
          for p in rest[2:]:
              while cross(S[-2], S[-1], p) <= 0:  # @turn
                  S.pop()  # @pop
              S.append(p)  # @push
          return S  # @done
    `,
  },
  run({ points }, trace) {
    const P = trace.add(
      'P',
      planeOf(points, [], trace.say({ en: 'points', zh: '点' })),
    );
    const order = trace.add('order', {
      kind: 'array',
      place: 'side',
      label: trace.say({ en: 'by polar angle', zh: '按极角排序' }),
      initial: [],
    });
    const S = trace.add('S', {
      kind: 'stack',
      place: 'side',
      label: trace.say({ en: 'stack S', zh: '栈 S' }),
      initial: [],
    });
    const p0 = lowest(points);
    trace.step('p0', {
      en: `p0 is ${show(p0)}: the lowest point, the leftmost of the lowest. Every other point is above it or to its right, so it is on the hull.`,
      zh: `p0 是 ${show(p0)}：最低的点，最低的点中最左边的那个。其他每个点都在它上方或右边，所以它在凸包上。`,
    });
    P.pointer({ name: 'p0', point: p0.id });
    const { kept, dropped } = polarOrder(
      p0,
      points.filter((p) => p !== p0),
    );
    trace.step('sort', {
      en: `Sort the other points by polar angle about p0, comparing two points by the sign of a cross product rather than by angles${dropped.length === 0 ? '' : `; ${dropped.map((p) => p.id).join(', ')} ${dropped.length === 1 ? 'is' : 'are'} at the angle of a farther point and cannot be on the hull`}.`,
      zh: `以 p0 为中心按极角给其他点排序，用叉积的符号而不是角度比较两点${dropped.length === 0 ? '' : `；${dropped.map((p) => p.id).join(', ')} 与更远的点极角相同，不可能在凸包上`}。`,
    });
    kept.forEach((p, k) => order.insert({ index: k, element: p.id }));
    for (const p of dropped) P.visit({ point: p.id });
    const stack: Pt[] = [p0, kept[0]!, kept[1]!];
    trace.step('start', {
      en: `Push p0, ${kept[0]!.id} and ${kept[1]!.id}: the first and second in angle are on the hull so far.`,
      zh: `压入 p0、${kept[0]!.id} 和 ${kept[1]!.id}：极角最小的两个点目前在凸包上。`,
    });
    stack.forEach((p) => S.push({ element: p.id }));
    P.addSegment({
      segment: { id: edgeId(p0, kept[0]!), from: p0.id, to: kept[0]!.id },
    }).addSegment({
      segment: {
        id: edgeId(kept[0]!, kept[1]!),
        from: kept[0]!.id,
        to: kept[1]!.id,
      },
    });
    for (const p of kept.slice(2)) {
      for (;;) {
        const [a, b] = [stack.at(-2)!, stack.at(-1)!];
        const c = cross(a, b, p);
        trace.step('turn', {
          en: `From ${a.id} to ${b.id} to ${p.id}: the cross product of ${b.id} − ${a.id} and ${p.id} − ${a.id} is ${c}, ${turn(c)}.`,
          zh: `从 ${a.id} 到 ${b.id} 再到 ${p.id}：${b.id} − ${a.id} 与 ${p.id} − ${a.id} 的叉积是 ${c}，${turnZh(c)}。`,
        });
        P.compare({ points: [a.id, b.id, p.id] });
        if (c > 0) break;
        trace.step('pop', {
          en: `${b.id} is not a left turn on the way to ${p.id}, so it is inside the hull: pop it.`,
          zh: `在去往 ${p.id} 的路上，${b.id} 处不是左转，所以它在凸包内部：弹出它。`,
        });
        S.pop();
        P.removeSegment({ id: edgeId(a, b) }).visit({ point: b.id });
        stack.pop();
      }
      const top = stack.at(-1)!;
      trace.step('push', {
        en: `The turn at ${top.id} is left: push ${p.id}.`,
        zh: `${top.id} 处是左转：压入 ${p.id}。`,
      });
      S.push({ element: p.id });
      P.addSegment({ segment: { id: edgeId(top, p), from: top.id, to: p.id } });
      stack.push(p);
    }
    const last = stack.at(-1)!;
    trace.step('done', {
      en: `Every point is scanned: the stack holds the ${stack.length} hull vertices in counterclockwise order, and ${last.id} joins back to p0.`,
      zh: `每个点都扫描过了：栈中按逆时针顺序存放着凸包的 ${stack.length} 个顶点，${last.id} 再连回 p0。`,
    });
    P.addSegment({
      segment: { id: edgeId(last, p0), from: last.id, to: p0.id },
    });
    stack.forEach((p, k) => {
      P.settle({ point: p.id }).select({
        segment: edgeId(p, stack[(k + 1) % stack.length]!),
        on: true,
      });
    });
    P.pointer({ name: 'p0', point: null });
    return { results: [stack.length] };
  },
});
