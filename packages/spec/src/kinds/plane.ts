/**
 * The `plane` kind (ADR 0038): points at coordinates and the segments
 * between them, with named vertical lines (a sweep line, a dividing line)
 * and optional axes, for computational geometry. Points and segments have
 * ids, unique within the structure; a segment names its two end points.
 *
 * Marks: `highlight` and `compare` last one step; `visit`, `settle`,
 * `select`, `pointer` and `line` persist.
 */
import { z } from 'zod';

import { ElementId, isSafeKey, LIMITS, Place, PointerName } from '../common.ts';
import { typesOf, type DeclIssue, type IdRef, type KindSpec } from './kind.ts';

/** Most points, segments and lines a plane holds. */
export const MAX_POINTS = 64;
export const MAX_SEGMENTS = 128;
export const MAX_LINES = 8;

/** A coordinate: a finite number from −10⁶ to 10⁶. */
export const Coordinate = z.number().min(-1e6).max(1e6);

const Label = z.string().min(1).max(16);

export const PlanePoint = z
  .strictObject({
    id: ElementId,
    x: Coordinate,
    y: Coordinate,
    label: Label.optional().describe(
      'Shown beside the point; its id if absent.',
    ),
  })
  .describe('A point at (x, y).');
export type PlanePoint = z.infer<typeof PlanePoint>;

export const PlaneSegment = z
  .strictObject({
    id: ElementId,
    from: ElementId.describe('The id of one end point.'),
    to: ElementId.describe('The id of the other end point.'),
    label: Label.optional().describe('Shown beside the segment.'),
  })
  .describe('A segment between two points.');
export type PlaneSegment = z.infer<typeof PlaneSegment>;

const shape = {
  kind: z.literal('plane'),
  label: z.string().max(LIMITS.textLength).optional(),
  place: Place.optional(),
  axes: z
    .boolean()
    .optional()
    .describe('Draw the x and y axes (default false).'),
};

export const PlaneDecl = z
  .strictObject({
    ...shape,
    points: z.array(PlanePoint).max(MAX_POINTS),
    segments: z.array(PlaneSegment).max(MAX_SEGMENTS).optional(),
  })
  .describe('Points and segments in the plane, for computational geometry.');
export type PlaneDecl = z.infer<typeof PlaneDecl>;

export const PlaneDeclInput = z
  .strictObject({
    ...shape,
    points: z
      .array(PlanePoint)
      .max(MAX_POINTS)
      .optional()
      .describe('The points; none by default.'),
    segments: z.array(PlaneSegment).max(MAX_SEGMENTS).optional(),
  })
  .describe('Points and segments in the plane, for computational geometry.');
export type PlaneDeclInput = z.infer<typeof PlaneDeclInput>;

/** A segment's two ends, in either order. */
const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);

/** Points apart, segment ends known and distinct, one segment per pair. */
export function validatePlaneDecl(decl: PlaneDecl): DeclIssue[] {
  const issues: DeclIssue[] = [];
  const at = new Map<string, string>();
  decl.points.forEach((p, k) => {
    const where = `${p.x} ${p.y}`;
    const other = at.get(where);
    if (other !== undefined)
      issues.push({
        path: ['points', k],
        message: `Points "${other}" and "${p.id}" are both at (${p.x}, ${p.y}); they would draw as one`,
      });
    else at.set(where, p.id);
  });
  const ids = new Set(decl.points.map((p) => p.id));
  const pairs = new Set<string>();
  (decl.segments ?? []).forEach((s, k) => {
    for (const end of ['from', 'to'] as const)
      if (!ids.has(s[end]))
        issues.push({
          path: ['segments', k, end],
          message: `Segment "${s.id}" ends at "${s[end]}", which is not a point`,
        });
    if (s.from === s.to)
      issues.push({
        path: ['segments', k, 'to'],
        message: `Segment "${s.id}" goes from "${s.from}" to itself`,
      });
    const pair = pairKey(s.from, s.to);
    if (pairs.has(pair))
      issues.push({
        path: ['segments', k],
        message: `Two segments join "${s.from}" and "${s.to}"`,
      });
    pairs.add(pair);
  });
  return issues;
}

const PointRef = ElementId.describe('A point id.');
const SegmentRef = ElementId.describe('A segment id.');
const LineName = z
  .string()
  // No control characters, and no space at either end.
  .regex(/^[^\s\p{Cc}](?:[^\p{Cc}]{0,10}[^\s\p{Cc}])?$/u)
  .refine(isSafeKey, {
    message: 'Line names may not be the names of object properties',
  })
  .describe(
    'A line name of up to 12 characters, e.g. "sweep", "l" or "l + δ".',
  );

const actions = z.discriminatedUnion('type', [
  z
    .strictObject({ type: z.literal('addPoint'), point: PlanePoint })
    .describe('Add a point.'),
  z
    .strictObject({ type: z.literal('removePoint'), id: PointRef })
    .describe('Remove a point that ends no segment.'),
  z
    .strictObject({ type: z.literal('addSegment'), segment: PlaneSegment })
    .describe('Add a segment between two points.'),
  z
    .strictObject({ type: z.literal('removeSegment'), id: SegmentRef })
    .describe('Remove a segment.'),
  z
    .strictObject({
      type: z.literal('label'),
      segment: SegmentRef,
      text: Label.nullable(),
    })
    .describe("Change a segment's label, such as a distance; null removes it."),
  z
    .strictObject({
      type: z.literal('highlight'),
      points: z.array(PointRef).max(MAX_POINTS).optional(),
      segments: z.array(SegmentRef).max(MAX_SEGMENTS).optional(),
    })
    .refine((a) => a.points !== undefined || a.segments !== undefined, {
      message: 'Give `points`, `segments` or both',
    })
    .describe('Highlight points and segments (this step).'),
  z
    .strictObject({
      type: z.literal('compare'),
      points: z.array(PointRef).min(2).max(3),
    })
    .describe(
      'Mark two or three points as being compared, as an orientation test or a distance does (this step).',
    ),
  z
    .strictObject({ type: z.literal('visit'), point: PointRef })
    .describe('Mark a point as considered (persists).'),
  z
    .strictObject({ type: z.literal('settle'), point: PointRef })
    .describe('Mark a point as final, such as a hull vertex (persists).'),
  z
    .strictObject({
      type: z.literal('select'),
      segment: SegmentRef,
      on: z.boolean(),
    })
    .describe(
      'Mark a segment as chosen, such as a hull edge or a closest pair, or clear the mark (persists).',
    ),
  z
    .strictObject({
      type: z.literal('pointer'),
      name: PointerName,
      point: PointRef.nullable(),
    })
    .describe('A named badge at a point; null removes it (persists).'),
  z
    .strictObject({
      type: z.literal('line'),
      name: LineName,
      x: Coordinate.nullable(),
    })
    .describe(
      'A named vertical line at x, such as a sweep line; null removes it (persists).',
    ),
]);

export const PlaneAction = actions;
export type PlaneAction = z.infer<typeof PlaneAction>;
export const PlaneActionInput = actions;
export type PlaneActionInput = PlaneAction;

export const planeSpec: KindSpec<{
  decl: PlaneDecl;
  declInput: PlaneDeclInput;
  action: PlaneAction;
  actionInput: PlaneActionInput;
}> = {
  kind: 'plane',
  decl: PlaneDecl,
  declInput: PlaneDeclInput,
  action: PlaneAction,
  actionInput: PlaneActionInput,
  actionTypes: typesOf(PlaneAction),
  normalizeDecl: ({ points, ...rest }) => ({ ...rest, points: points ?? [] }),
  declIds: (decl) => [
    ...decl.points.map((p, k): IdRef => ({
      id: p.id,
      path: ['points', k, 'id'],
    })),
    ...(decl.segments ?? []).map((s, k): IdRef => ({
      id: s.id,
      path: ['segments', k, 'id'],
    })),
  ],
  validateDecl: validatePlaneDecl,
  normalizeAction: (input) => input,
  introducedIds: (action) =>
    action.type === 'addPoint'
      ? [{ id: action.point.id, path: ['point', 'id'] }]
      : action.type === 'addSegment'
        ? [{ id: action.segment.id, path: ['segment', 'id'] }]
        : [],
};
