/**
 * Where an edge's label goes: beside a point along the edge, on the side
 * `labelSide` names (else above), far enough out to clear the line. Layouts
 * use it to keep labels apart; painters use it to draw them, so both agree.
 */
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

/** Characters are drawn about 0.6 em wide. */
export const labelHalfWidth = (text: string, fontSize: number) =>
  ([...text].length * fontSize * 0.6) / 2;

/** The segment a label sits beside: the middle one of a routed edge. */
export function labelSegment(e: SceneEdge): [Point, Point] {
  const points = [{ x: e.x1, y: e.y1 }, ...(e.via ?? []), { x: e.x2, y: e.y2 }];
  const k = Math.floor((points.length - 1) / 2);
  return [points[k]!, points[k + 1]!];
}

export function edgeLabelBox(
  e: SceneEdge,
  a: Point,
  b: Point,
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
  const halfWidth = labelHalfWidth(e.label ?? '', e.fontSize);
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
const CANDIDATES = [0.5, 0.38, 0.62, 0.28, 0.72];

const overlaps = (p: LabelBox, q: LabelBox) =>
  Math.abs(p.x - q.x) < p.halfWidth + q.halfWidth + 2 &&
  Math.abs(p.y - q.y) < p.halfHeight + q.halfHeight + 2;

/**
 * Moves edge labels along their edges so that they do not cover each other
 * or a node, where a nearby position is free. Labels that cannot move stay
 * in the middle. Self-loops keep their labels beyond the loop.
 */
export function separateEdgeLabels(items: readonly SceneItem[]): SceneItem[] {
  const placed: LabelBox[] = items.flatMap((i) =>
    i.type === 'node'
      ? [
          {
            x: i.x,
            y: i.y,
            halfWidth: Math.max(i.radius, (i.width ?? 0) / 2),
            halfHeight: i.radius,
          },
        ]
      : [],
  );
  return items.map((item) => {
    if (item.type !== 'edge' || item.label === undefined) return item;
    const [a, b] = labelSegment(item);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) return item;
    for (const at of CANDIDATES) {
      const box = edgeLabelBox(item, a, b, at);
      if (placed.some((p) => overlaps(p, box))) continue;
      placed.push(box);
      return at === 0.5 ? item : { ...item, labelAt: at };
    }
    placed.push(edgeLabelBox(item, a, b, 0.5));
    return item;
  });
}
