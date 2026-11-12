/**
 * The `plane` kind in the property tests (ADR 0038): random declarations
 * and actions on a small integer grid, so that points collide and
 * segments repeat; a plain model of the points and segments written from
 * the ADR's table rather than from the reducer; and the invariants every
 * state keeps.
 */
import type { StructureDecl } from '@algoviz/spec';

import type { PlaneState } from '../../src/index.ts';
import type { Dice } from './random.ts';

type Fields = Record<string, unknown>;
type Point = { id: string; x: number; y: number; label?: string | undefined };
type Segment = {
  id: string;
  from: string;
  to: string;
  label?: string | undefined;
};

export interface PlaneModel {
  readonly kind: 'plane';
  readonly points: readonly Point[];
  readonly segments: readonly Segment[];
}

const coordinate = (r: Dice) => r.int(7) - 3;

export function planeDecl(r: Dice, label: object): StructureDecl {
  const points: Point[] = [];
  const taken = new Set<string>();
  for (let k = r.int(6 * r.scale); k > 0; k--) {
    const [x, y] = [coordinate(r), coordinate(r)];
    if (taken.has(`${x} ${y}`)) continue;
    taken.add(`${x} ${y}`);
    points.push({
      id: `p${points.length}`,
      x,
      y,
      ...(r.chance(0.3) ? { label: r.pick(['A', 'p0', 'top', 'δ']) } : {}),
    });
  }
  const segments: Segment[] = [];
  if (points.length > 1)
    for (let k = r.int(4); k > 0; k--) {
      const [a, b] = [r.pick(points).id, r.pick(points).id];
      const pair = (s: Segment) =>
        (s.from === a && s.to === b) || (s.from === b && s.to === a);
      if (a !== b && !segments.some(pair))
        segments.push({ id: `s${segments.length}`, from: a, to: b });
    }
  return {
    kind: 'plane',
    ...label,
    points,
    ...(segments.length > 0 ? { segments } : {}),
    ...(r.chance(0.3) ? { axes: true } : {}),
  };
}

export function planeAction(s: PlaneState, r: Dice): Fields {
  const points = s.data.points.map((p) => p.id);
  const segments = s.data.segments.map((x) => x.id);
  const all = [...points, ...segments];
  const point = () =>
    points.length === 0 || r.chance(0.03) ? 'missing' : r.pick(points);
  const segment = () =>
    segments.length === 0 || r.chance(0.05) ? 'missing' : r.pick(segments);
  switch (r.int(12)) {
    case 0:
    case 1:
      return {
        type: 'addPoint',
        point: { id: r.id(all, 'p'), x: coordinate(r), y: coordinate(r) },
      };
    case 2:
      return { type: 'removePoint', id: point() };
    case 3:
    case 4:
      return {
        type: 'addSegment',
        segment: { id: r.id(all, 's'), from: point(), to: point() },
      };
    case 5:
      return { type: 'removeSegment', id: segment() };
    case 6:
      return {
        type: 'label',
        segment: segment(),
        text: r.chance(0.3) ? null : r.pick(['1.41', 'd', 'δ = 2']),
      };
    case 7:
      return r.chance(0.5)
        ? { type: 'highlight', points: [point()], segments: [segment()] }
        : { type: 'compare', points: [point(), point(), point()] };
    case 8:
      return { type: r.pick(['visit', 'settle']), point: point() };
    case 9:
      return { type: 'select', segment: segment(), on: r.chance(0.7) };
    case 10:
      return {
        type: 'pointer',
        name: r.pick(['p', 'top', 'q']),
        point: r.chance(0.2) ? null : point(),
      };
    default:
      return {
        type: 'line',
        name: r.pick(['sweep', 'l', 'l + δ']),
        x: r.chance(0.2) ? null : coordinate(r) + 0.5,
      };
  }
}

export function initPlaneModel(
  decl: StructureDecl & { kind: 'plane' },
): PlaneModel {
  return {
    kind: 'plane',
    points: [...decl.points],
    segments: [...(decl.segments ?? [])],
  };
}

/** The model after an action, or undefined if it must be refused. */
export function applyPlaneModel(
  m: PlaneModel,
  a: Fields,
): PlaneModel | undefined {
  const isPoint = (id: unknown) => m.points.some((p) => p.id === id);
  const isSegment = (id: unknown) => m.segments.some((s) => s.id === id);
  const used = (id: unknown) => isPoint(id) || isSegment(id);
  switch (a['type']) {
    case 'addPoint': {
      const p = a['point'] as Point;
      if (m.points.length >= 64 || used(p.id)) return undefined;
      if (m.points.some((q) => q.x === p.x && q.y === p.y)) return undefined;
      return { ...m, points: [...m.points, p] };
    }
    case 'removePoint': {
      const id = a['id'];
      if (!isPoint(id)) return undefined;
      if (m.segments.some((s) => s.from === id || s.to === id))
        return undefined;
      return { ...m, points: m.points.filter((p) => p.id !== id) };
    }
    case 'addSegment': {
      const s = a['segment'] as Segment;
      if (m.segments.length >= 128 || used(s.id)) return undefined;
      if (!isPoint(s.from) || !isPoint(s.to) || s.from === s.to)
        return undefined;
      const twin = m.segments.some(
        (t) =>
          (t.from === s.from && t.to === s.to) ||
          (t.from === s.to && t.to === s.from),
      );
      return twin ? undefined : { ...m, segments: [...m.segments, s] };
    }
    case 'removeSegment':
      return isSegment(a['id'])
        ? { ...m, segments: m.segments.filter((s) => s.id !== a['id']) }
        : undefined;
    case 'label': {
      if (!isSegment(a['segment'])) return undefined;
      const text = a['text'] as string | null;
      return {
        ...m,
        segments: m.segments.map((s) =>
          s.id !== a['segment']
            ? s
            : text === null
              ? { id: s.id, from: s.from, to: s.to }
              : { id: s.id, from: s.from, to: s.to, label: text },
        ),
      };
    }
    case 'highlight':
      return ((a['points'] as unknown[] | undefined) ?? []).every(isPoint) &&
        ((a['segments'] as unknown[] | undefined) ?? []).every(isSegment)
        ? m
        : undefined;
    case 'compare':
      return (a['points'] as unknown[]).every(isPoint) ? m : undefined;
    case 'visit':
    case 'settle':
      return isPoint(a['point']) ? m : undefined;
    case 'select':
      return isSegment(a['segment']) ? m : undefined;
    case 'pointer':
      return a['point'] === null || isPoint(a['point']) ? m : undefined;
    case 'line':
      return m;
    default:
      throw new Error(`unmodelled plane action ${String(a['type'])}`);
  }
}

/** What is wrong with a state: ids, coordinates, segment ends, marks. */
export function planeProblems(s: PlaneState): string[] {
  const problems: string[] = [];
  const { points, segments } = s.data;
  const ids = [...points, ...segments].map((x) => x.id);
  if (new Set(ids).size !== ids.length) problems.push('two items share an id');
  const at = points.map((p) => `${p.x} ${p.y}`);
  if (new Set(at).size !== at.length) problems.push('two points coincide');
  const pointIds = new Set(points.map((p) => p.id));
  const segmentIds = new Set(segments.map((x) => x.id));
  for (const x of segments)
    if (!pointIds.has(x.from) || !pointIds.has(x.to) || x.from === x.to)
      problems.push(`segment ${x.id} has a bad end`);
  const m = s.marks;
  for (const id of [...m.compare, ...m.visited, ...m.settled])
    if (!pointIds.has(id))
      problems.push(`a mark names the missing point ${id}`);
  for (const id of Object.values(m.pointers))
    if (!pointIds.has(id)) problems.push(`a pointer names the missing ${id}`);
  for (const id of m.selected)
    if (!segmentIds.has(id)) problems.push(`selected names the missing ${id}`);
  for (const id of m.highlight)
    if (!pointIds.has(id) && !segmentIds.has(id))
      problems.push(`highlight names the missing ${id}`);
  if (Object.keys(m.lines).length > 8) problems.push('more than 8 lines');
  return problems;
}
