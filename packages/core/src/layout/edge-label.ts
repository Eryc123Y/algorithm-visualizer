/**
 * Where an edge's label goes: beside a point along the edge, on the side
 * `labelSide` names (else above), far enough out to clear the line. Layouts
 * use it to keep labels apart; painters use it to draw them, so both agree.
 */
import { textWidth, type FontMetrics } from '@algomotion/fonts';

import { CLEAR, clearance, noteBox, type Obstacles } from './notes.ts';
import type { SceneEdge, SceneItem } from './scene.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LabelBox {
  /** Centre of the label. */
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** Half the width of `text` set in `font` at `fontSize`. */
export const labelHalfWidth = (
  text: string,
  fontSize: number,
  font: FontMetrics,
): number => (textWidth(text, font) * fontSize) / 2;

/** The segment a label sits beside: the middle one of a routed edge. */
export function labelSegment(e: SceneEdge): [Point, Point] {
  const points = [{ x: e.x1, y: e.y1 }, ...(e.via ?? []), { x: e.x2, y: e.y2 }];
  const k = Math.floor((points.length - 1) / 2);
  return [points[k]!, points[k + 1]!];
}

/**
 * The box of an edge's label, set in `font` (the value font of the layout
 * or theme), at `at` along the segment from `a` to `b`.
 */
export function edgeLabelBox(
  e: SceneEdge,
  a: Point,
  b: Point,
  font: FontMetrics,
  at = e.labelAt ?? 0.5,
): LabelBox {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [-dy / length, dx / length];
  const side =
    e.labelSide !== undefined
      ? e.labelSide === 'right'
        ? 1
        : -1
      : ny > 0 || (ny === 0 && nx < 0)
        ? -1
        : 1; // prefer above
  const halfWidth = labelHalfWidth(e.label ?? '', e.fontSize, font);
  const clearance =
    4 + Math.abs(nx) * halfWidth + Math.abs(ny) * (e.fontSize / 2);
  return {
    x: a.x + dx * at + nx * clearance * side,
    y: a.y + dy * at + ny * clearance * side,
    halfWidth,
    halfHeight: e.fontSize / 2,
  };
}

/** Positions along an edge to try for its label, nearest the middle first. */
export const LABEL_POSITIONS: readonly number[] = [0.5, 0.38, 0.62, 0.28, 0.72];

const overlaps = (p: LabelBox, q: LabelBox) =>
  Math.abs(p.x - q.x) < p.halfWidth + q.halfWidth + 2 &&
  Math.abs(p.y - q.y) < p.halfHeight + q.halfHeight + 2;

/** An edge's line, as segments from end to end; none for a self-loop. */
function edgeLines(e: SceneEdge): [Point, Point][] {
  const points = [{ x: e.x1, y: e.y1 }, ...(e.via ?? []), { x: e.x2, y: e.y2 }];
  if (points.length === 2 && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) < 0.5)
    return [];
  return points.slice(1).map((p, k) => [points[k]!, p]);
}

/**
 * Moves edge labels along their edges so that they do not cover each other,
 * a node, a node's note or another edge, where a nearby position is free
 * (ADR 0013, 0031). A label with no free position goes where it keeps the
 * most room from other edges among those that cover nothing, else in the
 * middle. Self-loops keep their labels beyond the loop.
 */
export function separateEdgeLabels(
  items: readonly SceneItem[],
  font: FontMetrics,
): SceneItem[] {
  const placed: LabelBox[] = items.flatMap((i) => {
    if (i.type !== 'node') return [];
    const halfWidth = Math.max(i.radius, (i.width ?? 0) / 2);
    const node = { x: i.x, y: i.y, halfWidth, halfHeight: i.radius };
    if (i.label === undefined) return [node];
    const fontSize = Math.max(10, i.fontSize * 0.7);
    return [
      node,
      noteBox(
        { x: i.x, y: i.y, radius: i.radius, halfWidth },
        i.labelAngle ?? 0,
        labelHalfWidth(i.label, fontSize, font),
        fontSize,
      ),
    ];
  });
  const lines = items.flatMap((i) =>
    i.type === 'edge' ? edgeLines(i).map((line) => ({ key: i.key, line })) : [],
  );
  return items.map((item) => {
    if (item.type !== 'edge' || item.label === undefined) return item;
    const [a, b] = labelSegment(item);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) return item;
    const others: Obstacles = {
      segments: lines.flatMap((l) => (l.key === item.key ? [] : [l.line])),
      discs: [],
      boxes: [],
    };
    let fallback: { at: number; room: number } | undefined;
    for (const at of LABEL_POSITIONS) {
      const box = edgeLabelBox(item, a, b, font, at);
      if (placed.some((p) => overlaps(p, box))) continue;
      const room = clearance(box, others);
      if (room >= CLEAR) {
        placed.push(box);
        return at === 0.5 ? item : { ...item, labelAt: at };
      }
      if (fallback === undefined || room > fallback.room)
        fallback = { at, room };
    }
    const at = fallback?.at ?? 0.5;
    placed.push(edgeLabelBox(item, a, b, font, at));
    return at === 0.5 ? item : { ...item, labelAt: at };
  });
}
