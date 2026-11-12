/**
 * Reducer for the `plane` kind (ADR 0038). Points and segments are kept
 * in the order they were added; marks name them by id, and go with them
 * when they are removed. Lines and pointers are by name.
 */
import {
  err,
  MAX_LINES,
  MAX_POINTS,
  MAX_SEGMENTS,
  ok,
  type PlaneAction,
  type PlaneDecl,
  type PlanePoint,
  type PlaneSegment,
  type Result,
} from '@algomotion/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind, StructureState } from '../kind.ts';
import { checkCapacity, notFound, without } from './common.ts';

export interface PlaneData {
  readonly points: readonly PlanePoint[];
  readonly segments: readonly PlaneSegment[];
}

export interface PlaneMarks {
  /** Points and segments highlighted in this step. */
  readonly highlight: readonly string[];
  /** Points compared in this step. */
  readonly compare: readonly string[];
  /** Points considered. */
  readonly visited: readonly string[];
  /** Points final, such as hull vertices. */
  readonly settled: readonly string[];
  /** Segments chosen, such as hull edges or a closest pair. */
  readonly selected: readonly string[];
  /** Named badges at point ids. */
  readonly pointers: Readonly<Record<string, string>>;
  /** Named vertical lines at x. */
  readonly lines: Readonly<Record<string, number>>;
}

export type PlaneState = StructureState<PlaneData, PlaneMarks>;

type Reduced = Result<PlaneState, ReduceError>;

const invalid = (
  path: readonly PropertyKey[],
  message: string,
  hint?: string,
): ReduceError => ({
  code: 'INVALID_OPERATION',
  path,
  message,
  ...(hint === undefined ? {} : { hint }),
});

const EMPTY_MARKS: PlaneMarks = {
  highlight: [],
  compare: [],
  visited: [],
  settled: [],
  selected: [],
  pointers: {},
  lines: {},
};

/** Marks without anything that names `id`. */
const forget = (m: PlaneMarks, id: string): PlaneMarks => ({
  ...m,
  highlight: m.highlight.filter((x) => x !== id),
  compare: m.compare.filter((x) => x !== id),
  visited: m.visited.filter((x) => x !== id),
  settled: m.settled.filter((x) => x !== id),
  selected: m.selected.filter((x) => x !== id),
  pointers: Object.fromEntries(
    Object.entries(m.pointers).filter(([, p]) => p !== id),
  ),
});

const samePair = (s: PlaneSegment, a: string, b: string) =>
  (s.from === a && s.to === b) || (s.from === b && s.to === a);

/** Adds `x` to a list of ids once. */
const plus = (xs: readonly string[], x: string) =>
  xs.includes(x) ? xs : [...xs, x];

function addPoint(s: PlaneState, p: PlanePoint): Reduced {
  const { points, segments } = s.data;
  const full = checkCapacity('plane', points.length, MAX_POINTS);
  if (full) return err({ ...full, path: ['point'] });
  if ([...points, ...segments].some((x) => x.id === p.id))
    return err({
      code: 'DUPLICATE_ID',
      path: ['point', 'id'],
      message: `The id "${p.id}" is already used`,
      hint: 'Give the new point a new id.',
    });
  const there = points.find((q) => q.x === p.x && q.y === p.y);
  if (there !== undefined)
    return err(
      invalid(
        ['point'],
        `Point "${there.id}" is already at (${p.x}, ${p.y}); two points there would draw as one`,
      ),
    );
  return ok({ ...s, data: { ...s.data, points: [...points, p] } });
}

function addSegment(s: PlaneState, seg: PlaneSegment): Reduced {
  const { points, segments } = s.data;
  const full = checkCapacity('plane', segments.length, MAX_SEGMENTS);
  if (full) return err({ ...full, path: ['segment'] });
  if ([...points, ...segments].some((x) => x.id === seg.id))
    return err({
      code: 'DUPLICATE_ID',
      path: ['segment', 'id'],
      message: `The id "${seg.id}" is already used`,
      hint: 'Give the new segment a new id.',
    });
  for (const end of ['from', 'to'] as const)
    if (!points.some((p) => p.id === seg[end]))
      return err(notFound(['segment', end], seg[end], 'point'));
  if (seg.from === seg.to)
    return err(
      invalid(
        ['segment', 'to'],
        `A segment joins two points, not "${seg.from}" to itself`,
      ),
    );
  const twin = segments.find((x) => samePair(x, seg.from, seg.to));
  if (twin !== undefined)
    return err(
      invalid(
        ['segment'],
        `Segment "${twin.id}" already joins "${seg.from}" and "${seg.to}"`,
      ),
    );
  return ok({ ...s, data: { ...s.data, segments: [...segments, seg] } });
}

function reducePlane(s: PlaneState, a: PlaneAction): Reduced {
  const { points, segments } = s.data;
  const m = s.marks;
  const point = (id: string) => points.find((p) => p.id === id);
  const segment = (id: string) => segments.find((x) => x.id === id);
  const marks = (next: Partial<PlaneMarks>): Reduced =>
    ok({ ...s, marks: { ...m, ...next } });
  /** The first id in `ids` that is not a point (or segment), as an error. */
  const missing = (
    ids: readonly string[],
    field: string,
    what: 'point' | 'segment',
  ): ReduceError | undefined => {
    const k = ids.findIndex((id) =>
      what === 'point' ? point(id) === undefined : segment(id) === undefined,
    );
    return k < 0 ? undefined : notFound([field, k], ids[k]!, what);
  };

  switch (a.type) {
    case 'addPoint':
      return addPoint(s, a.point);
    case 'removePoint': {
      if (point(a.id) === undefined)
        return err(notFound(['id'], a.id, 'point'));
      const used = segments.find((x) => x.from === a.id || x.to === a.id);
      if (used !== undefined)
        return err(
          invalid(
            ['id'],
            `Point "${a.id}" ends segment "${used.id}"`,
            'Remove the segment first.',
          ),
        );
      return ok({
        data: { ...s.data, points: points.filter((p) => p.id !== a.id) },
        marks: forget(m, a.id),
      });
    }
    case 'addSegment':
      return addSegment(s, a.segment);
    case 'removeSegment':
      if (segment(a.id) === undefined)
        return err(notFound(['id'], a.id, 'segment'));
      return ok({
        data: { ...s.data, segments: segments.filter((x) => x.id !== a.id) },
        marks: forget(m, a.id),
      });
    case 'label': {
      const seg = segment(a.segment);
      if (seg === undefined)
        return err(notFound(['segment'], a.segment, 'segment'));
      const next: PlaneSegment = {
        id: seg.id,
        from: seg.from,
        to: seg.to,
        ...(a.text === null ? {} : { label: a.text }),
      };
      return ok({
        ...s,
        data: {
          ...s.data,
          segments: segments.map((x) => (x.id === seg.id ? next : x)),
        },
      });
    }
    case 'highlight': {
      const bad =
        missing(a.points ?? [], 'points', 'point') ??
        missing(a.segments ?? [], 'segments', 'segment');
      if (bad) return err(bad);
      return marks({ highlight: [...(a.points ?? []), ...(a.segments ?? [])] });
    }
    case 'compare': {
      const bad = missing(a.points, 'points', 'point');
      if (bad) return err(bad);
      return marks({ compare: a.points });
    }
    case 'visit':
    case 'settle': {
      if (point(a.point) === undefined)
        return err(notFound(['point'], a.point, 'point'));
      return a.type === 'visit'
        ? marks({ visited: plus(m.visited, a.point) })
        : marks({ settled: plus(m.settled, a.point) });
    }
    case 'select':
      if (segment(a.segment) === undefined)
        return err(notFound(['segment'], a.segment, 'segment'));
      return marks({
        selected: a.on
          ? plus(m.selected, a.segment)
          : m.selected.filter((x) => x !== a.segment),
      });
    case 'pointer':
      if (a.point === null)
        return marks({ pointers: without(m.pointers, a.name) });
      if (point(a.point) === undefined)
        return err(notFound(['point'], a.point, 'point'));
      return marks({ pointers: { ...m.pointers, [a.name]: a.point } });
    case 'line': {
      if (a.x === null) return marks({ lines: without(m.lines, a.name) });
      const count = Object.keys(m.lines).length;
      if (!Object.hasOwn(m.lines, a.name) && count >= MAX_LINES)
        return err({
          code: 'LIMIT_EXCEEDED',
          path: ['name'],
          message: `A plane shows at most ${MAX_LINES} lines`,
          hint: 'Remove a line with `x: null` first.',
        });
      return marks({ lines: { ...m.lines, [a.name]: a.x } });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const planeKind: StructureKind<PlaneDecl, PlaneState, PlaneAction> = {
  init: (decl) => ({
    data: { points: decl.points, segments: decl.segments ?? [] },
    marks: EMPTY_MARKS,
  }),
  beginStep: (s) =>
    s.marks.highlight.length === 0 && s.marks.compare.length === 0
      ? s
      : { ...s, marks: { ...s.marks, highlight: [], compare: [] } },
  reduce: reducePlane,
};
