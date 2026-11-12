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
  title: 'Any segments intersect',
  topic: 'geometry',
  summary:
    'Decides whether any two segments intersect by sweeping a vertical line left to right, testing only segments that are next to each other along the line.',
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
    const P = trace.add('P', planeOf(points, segments));
    const T = trace.add('T', {
      kind: 'array',
      place: 'side',
      label: 'sweep-line status, bottom to top',
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
    const test = (a: Seg, b: Seg, step: string, lead: string): boolean => {
      const hit = segmentsIntersect(a, b);
      trace.step(
        step,
        `${lead} ${hit ? 'they intersect.' : 'they do not intersect.'}`,
      );
      P.highlight({ segments: [a.id, b.id] });
      return hit;
    };
    const found = (a: Seg, b: Seg) => {
      trace.step(
        'found',
        `${a.id} and ${b.id} intersect, so some two segments do: the answer is yes.`,
      );
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
        trace.step(
          'event',
          `The sweep line reaches x = ${e.x}, the left end of ${s.id}.`,
        );
        P.line({ name: 'sweep', x: e.x }).highlight({ segments: [s.id] });
        trace.step(
          'insert',
          `Insert ${s.id} into the order at the line: ${at === 0 ? 'at the bottom' : `above ${order[at - 1]!.id}`}${at < order.length ? `, below ${order[at]!.id}` : ''}.`,
        );
        order.splice(at, 0, s);
        T.insert({ index: at, element: s.id }).highlight({ indices: [at] });
        const above = order[at + 1];
        const below = order[at - 1];
        if (
          above !== undefined &&
          test(
            s,
            above,
            'test',
            `Test ${s.id} against ${above.id}, just above it:`,
          )
        )
          return found(s, above);
        if (
          below !== undefined &&
          test(
            s,
            below,
            'test',
            `Test ${s.id} against ${below.id}, just below it:`,
          )
        )
          return found(s, below);
      } else {
        const at = order.indexOf(s);
        trace.step(
          'event',
          `The sweep line reaches x = ${e.x}, the right end of ${s.id}.`,
        );
        P.line({ name: 'sweep', x: e.x }).highlight({ segments: [s.id] });
        T.highlight({ indices: [at] });
        const [above, below] = [order[at + 1], order[at - 1]];
        if (
          above !== undefined &&
          below !== undefined &&
          test(
            above,
            below,
            'test-around',
            `${s.id} ends, so ${above.id} and ${below.id}, on either side of it, become neighbours: test them, and`,
          )
        )
          return found(above, below);
        trace.step('delete', `Delete ${s.id} from the order.`);
        order.splice(at, 1);
        T.remove({ index: at });
      }
    }
    trace.step(
      'done',
      'The sweep has passed every endpoint without finding an intersection: the answer is no.',
    );
    P.line({ name: 'sweep', x: null });
    return { results: [false] };
  },
});
