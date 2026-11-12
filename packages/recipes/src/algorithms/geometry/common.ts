/**
 * What the geometry modules share (ADR 0038): points and segments in a
 * notation, `(0, 0) (4, 3)` or `a(0, 0) b(4, 3)`, and
 * `(0, 0)-(4, 3), s2: (1, 4)-(5, 0)`, or in a structured form; integer
 * coordinates from −999 to 999, so cross products are exact; and the
 * orientation test every module uses.
 */
import { z } from 'zod';

import { NotationError, quoted } from '../../notation/error.ts';
import { parseIn } from '../../notation/error.ts';

export interface Pt {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface Seg {
  readonly id: string;
  readonly from: Pt;
  readonly to: Pt;
}

const COORD = 999;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,7}$/;

/** The cross product of a − o and b − o: positive for a left turn. */
export const cross = (o: Pt, a: Pt, b: Pt): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export const dist2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** A short reading of a cross product's sign. */
export const turn = (c: number) =>
  c > 0
    ? 'a left turn'
    : c < 0
      ? 'a right turn'
      : 'no turn: they are on one line';

/** Names for the unnamed, `prefix` and a number, skipping names given. */
function namer(given: Iterable<string>, prefix: string, from: number) {
  const taken = new Set(given);
  let k = from;
  return () => {
    while (taken.has(`${prefix}${k}`)) k++;
    return `${prefix}${k++}`;
  };
}

/** A reader of the notation: names, numbers and punctuation. */
class Reader {
  at = 0;
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  skip(): void {
    while (this.at < this.text.length && /[\s,;]/.test(this.text[this.at]!))
      this.at++;
  }
  done(): boolean {
    this.skip();
    return this.at >= this.text.length;
  }
  expect(c: string): void {
    while (/\s/.test(this.text[this.at] ?? '')) this.at++;
    if (this.text[this.at] !== c)
      throw new NotationError(
        this.at >= this.text.length
          ? `Expected ${quoted(c)}`
          : `Expected ${quoted(c)}, not ${quoted(this.text[this.at]!)}`,
        this.at,
      );
    this.at++;
  }
  name(): string | undefined {
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(this.at));
    if (m === null) return undefined;
    if (!NAME.test(m[0]))
      throw new NotationError(
        `A name is at most 8 letters, digits and _, not ${quoted(m[0])}`,
        this.at,
      );
    this.at += m[0].length;
    return m[0];
  }
  coordinate(): number {
    while (/\s/.test(this.text[this.at] ?? '')) this.at++;
    const m = /^-?\d+/.exec(this.text.slice(this.at));
    if (m === null || Math.abs(Number(m[0])) > COORD)
      throw new NotationError(
        `Expected a whole number from −${COORD} to ${COORD}`,
        this.at,
      );
    this.at += m[0].length;
    return Number(m[0]);
  }
  /** `(x, y)`, the comma required inside the parentheses. */
  pair(): [number, number] {
    this.expect('(');
    const x = this.coordinate();
    this.expect(',');
    const y = this.coordinate();
    this.expect(')');
    return [x, y];
  }
}

/** Points in the notation, `a(0, 0) (4, 3)`. */
export function parsePoints(text: string): Pt[] {
  const r = new Reader(text);
  const raw: { name?: string; x: number; y: number }[] = [];
  while (!r.done()) {
    const name = r.name();
    const [x, y] = r.pair();
    raw.push({ ...(name === undefined ? {} : { name }), x, y });
  }
  const fresh = namer(
    raw.flatMap((p) => p.name ?? []),
    'p',
    0,
  );
  return raw.map((p) => ({ id: p.name ?? fresh(), x: p.x, y: p.y }));
}

/** A segment as given: its ends, and a name if it has one. */
export interface SegmentInput {
  readonly id?: string | undefined;
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

/** Segments in the notation, `(0, 0)-(4, 3), s2: (1, 4)-(5, 0)`. */
export function parseSegments(text: string): SegmentInput[] {
  const r = new Reader(text);
  const out: SegmentInput[] = [];
  while (!r.done()) {
    const start = r.at;
    const name = r.name();
    if (name !== undefined) r.expect(':');
    else r.at = start;
    const from = r.pair();
    r.expect('-');
    const to = r.pair();
    out.push(name === undefined ? { from, to } : { id: name, from, to });
  }
  return out;
}

const Coord = z.int().min(-COORD).max(COORD);

const pointsForm =
  'points as (x, y) pairs, optionally named, e.g. "(0, 0) (4, 3) a(2, 5)"';

/** A list of points: the notation, `[x, y]` pairs, or `{ id, x, y }`. */
export const pointsField = (min: number, max: number) =>
  z
    .union([
      z
        .string()
        .transform((s, ctx) =>
          parseIn(s, ctx, parsePoints, `Write ${pointsForm}.`),
        ),
      z
        .array(z.tuple([Coord, Coord]))
        .transform((ps) => ps.map(([x, y], k): Pt => ({ id: `p${k}`, x, y }))),
      z.array(
        z.strictObject({
          id: z.string().regex(NAME),
          x: Coord,
          y: Coord,
        }),
      ),
    ])
    .pipe(
      z
        .array(z.custom<Pt>())
        .min(min, `Give at least ${min} points`)
        .max(max, `Give at most ${max} points`)
        .superRefine((ps, ctx) => {
          const ids = new Set<string>();
          const at = new Set<string>();
          for (const p of ps) {
            if (ids.has(p.id))
              ctx.addIssue({
                code: 'custom',
                message: `The name ${p.id} is given twice`,
              });
            if (at.has(`${p.x} ${p.y}`))
              ctx.addIssue({
                code: 'custom',
                message: `Two points are at (${p.x}, ${p.y})`,
              });
            ids.add(p.id);
            at.add(`${p.x} ${p.y}`);
          }
        }),
    )
    .describe(
      `The points: ${pointsForm}, or [x, y] pairs; whole numbers from −${COORD} to ${COORD}.`,
    );

const segmentsForm =
  'segments as pairs of points, optionally named, e.g. "(0, 0)-(4, 3), s2: (1, 4)-(5, 0)"';

/** Segments, with equal end coordinates made one point. */
export function segmentsOf(raw: readonly SegmentInput[]): {
  points: Pt[];
  segments: Seg[];
} {
  const points: Pt[] = [];
  // Point names skip the segments' names: they share one set of ids.
  const pointName = namer(
    raw.flatMap((s) => s.id ?? []),
    'p',
    0,
  );
  const pointAt = ([x, y]: readonly [number, number]) => {
    const there = points.find((p) => p.x === x && p.y === y);
    if (there !== undefined) return there;
    const p = { id: pointName(), x, y };
    points.push(p);
    return p;
  };
  const fresh = namer(
    raw.flatMap((s) => s.id ?? []),
    's',
    1,
  );
  const segments = raw.map((s) => ({
    id: s.id ?? fresh(),
    from: pointAt(s.from),
    to: pointAt(s.to),
  }));
  return { points, segments };
}

/** A list of segments: the notation or `[[x1, y1], [x2, y2]]` pairs. */
export const segmentsField = (max: number) =>
  z
    .union([
      z
        .string()
        .transform((s, ctx) =>
          parseIn(s, ctx, parseSegments, `Write ${segmentsForm}.`),
        ),
      z
        .array(z.tuple([z.tuple([Coord, Coord]), z.tuple([Coord, Coord])]))
        .transform((ss) =>
          ss.map(([from, to]): SegmentInput => ({ from, to })),
        ),
      z.array(
        z.strictObject({
          id: z.string().regex(NAME).optional(),
          from: z.tuple([Coord, Coord]),
          to: z.tuple([Coord, Coord]),
        }),
      ),
    ])
    .pipe(
      z
        .array(z.custom<SegmentInput>())
        .min(1, 'Give at least one segment')
        .max(max, `Give at most ${max} segments`),
    )
    .describe(`The segments: ${segmentsForm}, or [[x1, y1], [x2, y2]] pairs.`);

/** The plane declaration of a set of points. */
export const planeOf = (
  points: readonly Pt[],
  segments: readonly Seg[] = [],
) => ({
  kind: 'plane' as const,
  label: 'points',
  points: points.map((p) => ({ id: p.id, x: p.x, y: p.y })),
  ...(segments.length === 0
    ? {}
    : {
        segments: segments.map((s) => ({
          id: s.id,
          from: s.from.id,
          to: s.to.id,
        })),
      }),
  axes: true,
});

/** The lowest point, the leftmost of the lowest. */
export const lowest = (ps: readonly Pt[]) =>
  ps.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a));

export const show = (p: Pt) => `${p.id} (${p.x}, ${p.y})`;
