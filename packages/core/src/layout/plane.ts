/**
 * Layout for the `plane` kind (ADR 0038). One region, the bounding box of
 * every point and line over the trace padded by a tenth, is scaled
 * uniformly into a square of side `PLOT`, y up. Points are small nodes
 * with their labels turned away from what is near, the badges of pointers
 * included; segments, lines and axes are edges; pointers are badges
 * under their points. A margin
 * around the square keeps labels and badges inside the block.
 */
import type { PlaneDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { PlaneState } from '../kinds/plane.ts';
import {
  badgeHeight,
  badgeWidthFor,
  maxWidth,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { LabelBox } from './edge-label.ts';
import { CLEAR, clearance, clearestAngle, noteRegion } from './notes.ts';
import type { LayoutFonts } from './options.ts';
import type { EdgeRole, ElementRole, SceneItem } from './scene.ts';

/** Side of the square the region is scaled into. */
const PLOT = 320;
/** Radius of a point. */
const RADIUS = 5;
/** From a point's centre to the top of the badges under it. */
const BADGE_GAP = RADIUS + 6;

/** Sizes over the trace, so the region and margins never change. */
export interface PlaneMetrics {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  /** Widest point label, segment label or line name, in em. */
  readonly labelWidth: number;
  /** Widest pointer name, in em, and most pointers at one point. */
  readonly pointerWidth: number;
  readonly pointerRows: number;
  /**
   * Each point a pointer names in some frame, with the most pointers it
   * holds at once and its widest pointer name, in em: the badges its
   * label keeps clear of.
   */
  readonly pointed: readonly (readonly [string, number, number])[];
  /**
   * Every point, segment and line position of the trace, so that labels
   * keep one place in every frame, clear of all of them.
   */
  readonly points: readonly (readonly [string, number, number])[];
  readonly links: readonly (readonly [string, string])[];
  readonly lineXs: readonly number[];
}

/** `a` and then what `b` adds, by key, in order. */
function union<T>(
  a: readonly T[],
  b: readonly T[],
  key: (t: T) => string,
): T[] {
  const seen = new Set(a.map(key));
  return [...a, ...b.filter((t) => !seen.has(key(t)))];
}

/** Each point's badges over both: the most rows, the widest name. */
function mergePointed(
  a: PlaneMetrics['pointed'],
  b: PlaneMetrics['pointed'],
): PlaneMetrics['pointed'] {
  const merged = new Map(a.map(([id, rows, em]) => [id, [rows, em]] as const));
  for (const [id, rows, em] of b) {
    const [r, e] = merged.get(id) ?? [0, 0];
    merged.set(id, [Math.max(r, rows), Math.max(e, em)]);
  }
  return [...merged].map(([id, [rows, em]]) => [id, rows, em] as const);
}

const labelOf = (p: { id: string; label?: string | undefined }) =>
  p.label ?? p.id;

export function measurePlane(
  state: PlaneState,
  _decl: PlaneDecl,
  fonts: LayoutFonts,
): PlaneMetrics {
  const xs = [
    ...state.data.points.map((p) => p.x),
    ...Object.values(state.marks.lines),
  ];
  const ys = state.data.points.map((p) => p.y);
  const perPoint = new Map<string, number>();
  const widest = new Map<string, number>();
  for (const [name, id] of Object.entries(state.marks.pointers)) {
    perPoint.set(id, (perPoint.get(id) ?? 0) + 1);
    widest.set(
      id,
      Math.max(widest.get(id) ?? 0, maxWidth([name], fonts.value)),
    );
  }
  return {
    minX: Math.min(Infinity, ...xs),
    maxX: Math.max(-Infinity, ...xs),
    minY: Math.min(Infinity, ...ys),
    maxY: Math.max(-Infinity, ...ys),
    labelWidth: maxWidth(
      [
        ...state.data.points.map(labelOf),
        ...state.data.segments.flatMap((s) => s.label ?? []),
        ...Object.keys(state.marks.lines),
      ],
      fonts.value,
    ),
    pointerWidth: maxWidth(Object.keys(state.marks.pointers), fonts.value),
    pointerRows: Math.max(0, ...perPoint.values()),
    pointed: [...perPoint].map(
      ([id, rows]) => [id, rows, widest.get(id)!] as const,
    ),
    points: state.data.points.map((p) => [p.id, p.x, p.y] as const),
    links: state.data.segments.map((x) => [x.from, x.to] as const),
    lineXs: [...new Set(Object.values(state.marks.lines))],
  };
}

export const mergePlaneMetrics = (
  a: PlaneMetrics,
  b: PlaneMetrics,
): PlaneMetrics => ({
  minX: Math.min(a.minX, b.minX),
  maxX: Math.max(a.maxX, b.maxX),
  minY: Math.min(a.minY, b.minY),
  maxY: Math.max(a.maxY, b.maxY),
  labelWidth: Math.max(a.labelWidth, b.labelWidth),
  pointerWidth: Math.max(a.pointerWidth, b.pointerWidth),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  pointed: mergePointed(a.pointed, b.pointed),
  points: union(a.points, b.points, ([id]) => id),
  links: union(a.links, b.links, ([f, t]) => `${f} ${t}`),
  lineXs: union(a.lineXs, b.lineXs, String),
});

/** The region drawn: the bounds padded by a tenth, at least 1 unit. */
function regionOf(m: PlaneMetrics) {
  // With no point (or no line), an axis spans 0 to 1.
  const [x0, x1] = Number.isFinite(m.minX) ? [m.minX, m.maxX] : [0, 1];
  const [y0, y1] = Number.isFinite(m.minY) ? [m.minY, m.maxY] : [0, 1];
  const pad = Math.max(0.1 * Math.max(x1 - x0, y1 - y0), 1);
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
}

function pointRole(m: PlaneState['marks'], id: string): ElementRole {
  if (m.compare.includes(id)) return 'compare';
  if (m.highlight.includes(id)) return 'highlight';
  if (m.settled.includes(id)) return 'settled';
  if (m.visited.includes(id)) return 'visited';
  return 'default';
}

function segmentRole(m: PlaneState['marks'], id: string): EdgeRole {
  if (m.highlight.includes(id)) return 'highlight';
  if (m.selected.includes(id)) return 'selected';
  return 'default';
}

type Spot = { readonly x: number; readonly y: number };
type Line = readonly [Spot, Spot];

/** Where a point's label may go, in the order it is tried. */
export const LABEL_ANGLES = [0, 45, 315, 90, 270, 135, 225, 180] as const;

/**
 * Each point's label direction for the whole trace: the first that
 * clears every segment, line position, axis and point of the trace, the
 * badges any pointer puts under a point, and the labels placed before
 * it, points in the order they appear.
 */
function labelAngles(
  m: PlaneMetrics,
  at: (x: number, y: number) => Spot,
  axes: readonly Line[],
  font: number,
  badgesAt: (point: Spot, rows: number, em: number) => LabelBox,
): Map<string, number> {
  const r = regionOf(m);
  const where = new Map(m.points.map(([id, x, y]) => [id, at(x, y)]));
  const lines: Line[] = [
    ...axes,
    ...m.lineXs.map((x): Line => [at(x, r.y0), at(x, r.y1)]),
    ...m.links.flatMap(([f, t]): Line[] => {
      const [a, b] = [where.get(f), where.get(t)];
      return a === undefined || b === undefined ? [] : [[a, b]];
    }),
  ];
  const discs = [...where.values()].map((c) => ({ ...c, radius: RADIUS }));
  const labelHalf = (m.labelWidth * font) / 2;
  const badges = m.pointed.flatMap(([id, rows, em]) => {
    const c = where.get(id);
    return c === undefined ? [] : [badgesAt(c, rows, em)];
  });
  const placed: LabelBox[] = [];
  const angles = new Map<string, number>();
  for (const [id, c] of where) {
    const outline = { ...c, radius: RADIUS, halfWidth: RADIUS };
    const boxAt = (angle: number) =>
      noteRegion(outline, angle, labelHalf, font);
    const others = discs.filter((d) => d.x !== c.x || d.y !== c.y);
    // In order of what text must not go under (ADR 0042): a badge, which
    // hides it; then a point or another label; then the clearest of lines.
    let pool: readonly number[] = LABEL_ANGLES;
    for (const tier of [
      { segments: [], discs: [], boxes: badges },
      { segments: [], discs: others, boxes: [...badges, ...placed] },
    ]) {
      const clear = pool.filter((a) => clearance(boxAt(a), tier) >= CLEAR);
      if (clear.length > 0) pool = clear;
    }
    const angle = clearestAngle(pool, boxAt, {
      segments: lines,
      discs: others,
      boxes: [...badges, ...placed],
    });
    placed.push(boxAt(angle));
    angles.set(id, angle);
  }
  return angles;
}

export function layoutPlane(
  input: LayoutInput<PlaneDecl, PlaneState, PlaneMetrics>,
): Block {
  const { name, title, decl, state, metrics, origin, options: o } = input;
  const font = o.indexFontSize;
  const r = regionOf(metrics);
  const scale = PLOT / Math.max(r.x1 - r.x0, r.y1 - r.y0);
  const plotW = (r.x1 - r.x0) * scale;
  const plotH = (r.y1 - r.y0) * scale;
  // Room around the plot for labels on any side, badges under points.
  const labelRoom = Math.ceil(metrics.labelWidth * font) + 12;
  const badgeRoom =
    metrics.pointerRows === 0
      ? 0
      : RADIUS + 6 + metrics.pointerRows * (badgeHeight(o) + 2);
  const margin = Math.max(
    24,
    labelRoom,
    badgeRoom,
    Math.ceil(badgeWidthFor(metrics.pointerWidth, o) / 2) + 4,
  );
  const left = origin.x + margin;
  const top = origin.y + titleRowHeight(o) + margin;
  const at = (x: number, y: number) => ({
    x: left + (x - r.x0) * scale,
    y: top + (r.y1 - y) * scale,
  });
  const items: SceneItem[] = titleItems(name, title, origin, o);
  const edge = (
    key: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    role: EdgeRole,
    directed: boolean,
    label?: string,
    labelAt?: number,
  ): SceneItem => ({
    type: 'edge',
    key,
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    role,
    directed,
    ...(label === undefined ? {} : { label }),
    ...(labelAt === undefined ? {} : { labelAt }),
    fontSize: font,
  });

  // The axes, which point labels keep clear of with every segment and
  // line of the trace.
  const axisLines: Line[] = [];
  if (decl.axes === true) {
    const ax = r.x0 <= 0 && 0 <= r.x1 ? 0 : r.x0;
    const ay = r.y0 <= 0 && 0 <= r.y1 ? 0 : r.y0;
    axisLines.push([at(r.x0, ay), at(r.x1, ay)], [at(ax, r.y0), at(ax, r.y1)]);
    items.push(
      edge(
        `${name}/axis/x`,
        at(r.x0, ay),
        at(r.x1, ay),
        'default',
        true,
        'x',
        1,
      ),
      edge(
        `${name}/axis/y`,
        at(ax, r.y0),
        at(ax, r.y1),
        'default',
        true,
        'y',
        1,
      ),
    );
  }
  for (const [line, x] of Object.entries(state.marks.lines)) {
    items.push(
      edge(
        `${name}/line/${line}`,
        at(x, r.y0),
        at(x, r.y1),
        'highlight',
        false,
        line,
        1,
      ),
    );
  }

  const byId = new Map(state.data.points.map((p) => [p.id, at(p.x, p.y)]));
  for (const s of state.data.segments) {
    const [a, b] = [byId.get(s.from)!, byId.get(s.to)!];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    // Trimmed to the points' circles, unless the points nearly touch.
    const trim = length > 2 * RADIUS + 2 ? RADIUS / length : 0;
    const from = { x: a.x + (b.x - a.x) * trim, y: a.y + (b.y - a.y) * trim };
    const to = { x: b.x - (b.x - a.x) * trim, y: b.y - (b.y - a.y) * trim };
    items.push(
      edge(
        `${name}/segment/${s.id}`,
        from,
        to,
        segmentRole(state.marks, s.id),
        false,
        s.label,
      ),
    );
  }

  // Where the badges under a point stand in some frame: `rows` of them,
  // as wide as its widest pointer name.
  const badgesAt = (c: Spot, rows: number, em: number): LabelBox => {
    const stack = rows * (badgeHeight(o) + 2) - 2;
    return {
      x: c.x,
      y: c.y + BADGE_GAP + stack / 2,
      halfWidth: badgeWidthFor(em, o) / 2,
      halfHeight: stack / 2,
    };
  };
  const angles = labelAngles(metrics, at, axisLines, font, badgesAt);
  for (const p of state.data.points) {
    const c = byId.get(p.id)!;
    const angle = angles.get(p.id) ?? 0;
    const role = pointRole(state.marks, p.id);
    const settled = role !== 'settled' && state.marks.settled.includes(p.id);
    items.push({
      type: 'node',
      key: `${name}/point/${p.id}`,
      x: c.x,
      y: c.y,
      radius: RADIUS,
      role,
      ...(settled ? { settled: true as const } : {}),
      text: '',
      fontSize: font,
      label: labelOf(p),
      ...(angle === 0 ? {} : { labelAngle: angle }),
    });
  }

  // Pointers: badges stacked under their point.
  const rows = new Map<string, number>();
  const height = badgeHeight(o);
  for (const [pointer, id] of Object.entries(state.marks.pointers)) {
    const c = byId.get(id);
    if (c === undefined) continue;
    const row = rows.get(id) ?? 0;
    rows.set(id, row + 1);
    items.push({
      type: 'badge',
      key: `${name}/pointer/${pointer}`,
      x: c.x,
      y: c.y + BADGE_GAP + row * (height + 2) + height / 2,
      width: badgeWidthFor(maxWidth([pointer], o.fonts.value), o),
      height,
      role: 'pointer',
      text: pointer,
      fontSize: o.pointerFontSize,
    });
  }

  return {
    items,
    width: Math.max(plotW + 2 * margin, titleWidth(title, o)),
    height: titleRowHeight(o) + plotH + 2 * margin,
  };
}
