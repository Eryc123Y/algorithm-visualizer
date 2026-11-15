/**
 * Whether any two segments intersect (ADR 0038; CLRS 3rd edition, 33.2),
 * by a sweep line. The endpoints are the events, left to right; the
 * segments the line crosses are kept in order from bottom to top, and
 * only segments next to each other in that order are tested: a new one
 * against those just above and below it, and when one ends, the two it
 * separated.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import type { Localized } from '../../text.ts';
import {
  cross,
  planeOf,
  segmentsField,
  segmentsOf,
  type Pt,
  type Seg,
} from './common.ts';
import { parseSegments } from './common.ts';

/** Most segments the module takes. */
export const MAX_SEGMENTS_SWEPT = 12;

const between = (a: number, b: number, v: number) =>
  Math.min(a, b) <= v && v <= Math.max(a, b);

/** Whether `p`, on the line through `s`, lies on the segment. */
const onSegment = (s: Seg, p: Pt) =>
  between(s.from.x, s.to.x, p.x) && between(s.from.y, s.to.y, p.y);

/** SEGMENTS-INTERSECT: the ends of each straddle the other, or touch. */
export function segmentsIntersect(s: Seg, t: Seg): boolean {
  const d1 = cross(t.from, t.to, s.from);
  const d2 = cross(t.from, t.to, s.to);
  const d3 = cross(s.from, s.to, t.from);
  const d4 = cross(s.from, s.to, t.to);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
    return true;
  return (
    (d1 === 0 && onSegment(t, s.from)) ||
    (d2 === 0 && onSegment(t, s.to)) ||
    (d3 === 0 && onSegment(s, t.from)) ||
    (d4 === 0 && onSegment(s, t.to))
  );
}

/** A segment with its left and right ends. */
const ends = (s: Seg) =>
  s.from.x < s.to.x || (s.from.x === s.to.x && s.from.y <= s.to.y)
    ? [s.from, s.to]
    : [s.to, s.from];

/** The y of `s` where the sweep line crosses it at x. */
const yAt = (s: Seg, x: number) => {
  const [l, r] = ends(s);
  return l!.y + ((r!.y - l!.y) * (x - l!.x)) / (r!.x - l!.x);
};

const slope = (s: Seg) => {
  const [l, r] = ends(s);
  return (r!.y - l!.y) / (r!.x - l!.x);
};

export const anySegmentsIntersect = defineAlgorithm({
  id: 'any-segments-intersect',
  title: { en: 'Any segments intersect', zh: '任意线段相交' },
  topic: 'geometry',
  summary: {
    en: 'Decides whether any two segments intersect by sweeping a vertical line left to right, testing only segments that are next to each other along the line.',
    zh: '用一条从左往右扫过的竖线判定是否有两条线段相交，只检查沿扫描线相邻的线段。',
  },
  input: z
    .strictObject({ segments: segmentsField(MAX_SEGMENTS_SWEPT) })
    .superRefine(({ segments }, ctx) => {
      segments.forEach((s, k) => {
        if (s.from[0] === s.to[0])
          ctx.addIssue({
            code: 'custom',
            path: ['segments', k],
            message: `Segment ${k + 1} is vertical (or a point); the sweep assumes no segment is vertical`,
          });
      });
      const pairs = segments.map((s) =>
        [s.from.join(' '), s.to.join(' ')].sort().join(' '),
      );
      if (new Set(pairs).size !== pairs.length)
        ctx.addIssue({
          code: 'custom',
          path: ['segments'],
          message: 'Two segments have the same ends',
        });
      const names = segments.flatMap((s) => s.id ?? []);
      if (new Set(names).size !== names.length)
        ctx.addIssue({
          code: 'custom',
          path: ['segments'],
          message: 'A segment name is given twice',
        });
    }),
  main: 'segments',
  examples: [
    {
      segments: parseSegments(
        '(0, 1)-(6, 3), (1, 4)-(5, 0), (3, 6)-(7, 5), (6, 0)-(9, 2)',
      ),
    },
    { segments: parseSegments('(0, 0)-(4, 1), (1, 3)-(6, 4), (5, 0)-(9, 2)') },
  ],
  code: {
    pseudocode: `
      ANY-SEGMENTS-INTERSECT(S)
          T = an empty order of segments, bottom to top
          sort the endpoints by x, left ends first, then by y
          for each endpoint p in that order  // @event
              if p is the left end of a segment s
                  INSERT(T, s)  // @insert
                  if ABOVE(T, s) or BELOW(T, s) exists and intersects s  // @test
                      return TRUE  // @found
              if p is the right end of a segment s
                  if ABOVE(T, s) and BELOW(T, s) exist and intersect  // @test-around
                      return TRUE
                  DELETE(T, s)  // @delete
          return FALSE  // @done
    `,
    python: `
      def any_segments_intersect(S):
          T = []  # bottom to top
          for x, kind, s in sorted_endpoints(S):  # @event
              if kind == 'left':
                  insert(T, s, x)  # @insert
                  for t in neighbours(T, s):
                      if intersect(s, t):  # @test
                          return True  # @found
              else:
                  a, b = above(T, s), below(T, s)
                  if a and b and intersect(a, b):  # @test-around
                      return True
                  T.remove(s)  # @delete
          return False  # @done
    `,
  },
  run({ segments: raw }, trace) {
    const { points, segments } = segmentsOf(raw);
    const P = trace.add(
      'P',
      planeOf(points, segments, trace.say({ en: 'points', zh: '点' })),
    );
    const T = trace.add('T', {
      kind: 'array',
      place: 'side',
      label: trace.say({
        en: 'sweep-line status, bottom to top',
        zh: '扫描线状态，从下到上',
      }),
      initial: [],
    });
    type Event = { x: number; y: number; left: boolean; s: Seg };
    const events: Event[] = segments
      .flatMap((s) => {
        const [l, r] = ends(s);
        return [
          { x: l!.x, y: l!.y, left: true, s },
          { x: r!.x, y: r!.y, left: false, s },
        ];
      })
      .sort(
        (a, b) => a.x - b.x || Number(b.left) - Number(a.left) || a.y - b.y,
      );
    const order: Seg[] = [];
    const test = (a: Seg, b: Seg, step: string, lead: Localized): boolean => {
      const hit = segmentsIntersect(a, b);
      trace.step(step, {
        en: `${lead.en} ${hit ? 'they intersect.' : 'they do not intersect.'}`,
        zh: `${lead.zh}${hit ? '它们相交。' : '它们不相交。'}`,
      });
      P.highlight({ segments: [a.id, b.id] });
      return hit;
    };
    const found = (a: Seg, b: Seg) => {
      trace.step('found', {
        en: `${a.id} and ${b.id} intersect, so some two segments do: the answer is yes.`,
        zh: `${a.id} 和 ${b.id} 相交，所以有两条线段相交：答案是肯定的。`,
      });
      P.select({ segment: a.id, on: true }).select({ segment: b.id, on: true });
      return { results: [true] };
    };
    for (const e of events) {
      const s = e.s;
      if (e.left) {
        // Below s: the segments lower at x, or as low and less steep.
        const at = order.filter((t) => {
          const dy = yAt(t, e.x) - e.y;
          return (
            dy < 0 ||
            (dy === 0 &&
              (slope(t) < slope(s) || (slope(t) === slope(s) && t.id < s.id)))
          );
        }).length;
        trace.step('event', {
          en: `The sweep line reaches x = ${e.x}, the left end of ${s.id}.`,
          zh: `扫描线到达 x = ${e.x}，即 ${s.id} 的左端点。`,
        });
        P.line({ name: 'sweep', x: e.x }).highlight({ segments: [s.id] });
        trace.step('insert', {
          en: `Insert ${s.id} into the order at the line: ${at === 0 ? 'at the bottom' : `above ${order[at - 1]!.id}`}${at < order.length ? `, below ${order[at]!.id}` : ''}.`,
          zh: `把 ${s.id} 插入扫描线上的次序中：${at === 0 ? '放在最下面' : `在 ${order[at - 1]!.id} 上面`}${at < order.length ? `，在 ${order[at]!.id} 下面` : ''}。`,
        });
        order.splice(at, 0, s);
        T.insert({ index: at, element: s.id }).highlight({ indices: [at] });
        const above = order[at + 1];
        const below = order[at - 1];
        if (
          above !== undefined &&
          test(s, above, 'test', {
            en: `Test ${s.id} against ${above.id}, just above it:`,
            zh: `检查 ${s.id} 和紧挨在它上面的 ${above.id}：`,
          })
        )
          return found(s, above);
        if (
          below !== undefined &&
          test(s, below, 'test', {
            en: `Test ${s.id} against ${below.id}, just below it:`,
            zh: `检查 ${s.id} 和紧挨在它下面的 ${below.id}：`,
          })
        )
          return found(s, below);
      } else {
        const at = order.indexOf(s);
        trace.step('event', {
          en: `The sweep line reaches x = ${e.x}, the right end of ${s.id}.`,
          zh: `扫描线到达 x = ${e.x}，即 ${s.id} 的右端点。`,
        });
        P.line({ name: 'sweep', x: e.x }).highlight({ segments: [s.id] });
        T.highlight({ indices: [at] });
        const [above, below] = [order[at + 1], order[at - 1]];
        if (
          above !== undefined &&
          below !== undefined &&
          test(above, below, 'test-around', {
            en: `${s.id} ends, so ${above.id} and ${below.id}, on either side of it, become neighbours: test them, and`,
            zh: `${s.id} 结束了，它两边的 ${above.id} 和 ${below.id} 成为相邻的线段：检查它们，`,
          })
        )
          return found(above, below);
        trace.step('delete', {
          en: `Delete ${s.id} from the order.`,
          zh: `从次序中删除 ${s.id}。`,
        });
        order.splice(at, 1);
        T.remove({ index: at });
      }
    }
    trace.step('done', {
      en: 'The sweep has passed every endpoint without finding an intersection: the answer is no.',
      zh: '扫描线经过了所有端点，没有发现相交：答案是否定的。',
    });
    P.line({ name: 'sweep', x: null });
    return { results: [false] };
  },
});
