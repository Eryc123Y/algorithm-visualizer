/**
 * Where small text beside a node goes (ADR 0013, 0031): a node's note (a
 * distance, a rank, a height) or a heap position's index. The box sits a
 * fixed gap outside the node's outline in its direction, so a note at a
 * diagonal is as close as one above; layouts turn it to the first
 * direction whose box clears every line, node and box around it, and
 * painters draw the text in the same box, so both agree.
 */
import type { LabelBox, Point } from './edge-label.ts';

/** Room between a node's outline and its note. */
export const NOTE_GAP = 4;

/** A node's centre and outline: a circle, or a stadium when wider. */
export interface NodeOutline {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Half the node's width; equal to `radius` for a circle. */
  readonly halfWidth: number;
}

/**
 * The box of text `halfWidth` wide and `fontSize` tall beside `node`, in
 * the direction `angle`, in degrees clockwise from straight up.
 */
export function noteBox(
  node: NodeOutline,
  angle: number,
  halfWidth: number,
  fontSize: number,
): LabelBox {
  const rad = (angle * Math.PI) / 180;
  const [dx, dy] = [Math.sin(rad), -Math.cos(rad)];
  // How far the outline reaches that way: a stadium's straight sides add
  // to the reach sideways.
  const outline = node.radius + (node.halfWidth - node.radius) * Math.abs(dx);
  const reach =
    outline +
    NOTE_GAP +
    Math.abs(dx) * halfWidth +
    Math.abs(dy) * (fontSize / 2);
  return {
    x: node.x + dx * reach,
    y: node.y + dy * reach,
    halfWidth,
    halfHeight: fontSize / 2,
  };
}

/**
 * Where a note of any width up to `halfWidth` may lie in the direction
 * `angle`: a narrower note sits closer to the node at a diagonal, so the
 * region spans the boxes of a note of no width and of the widest one.
 * Layouts choose a direction with it, so that every note of the trace
 * clears what the region clears.
 */
export function noteRegion(
  node: NodeOutline,
  angle: number,
  halfWidth: number,
  fontSize: number,
): LabelBox {
  const near = noteBox(node, angle, 0, fontSize);
  const far = noteBox(node, angle, halfWidth, fontSize);
  const left = Math.min(near.x - near.halfWidth, far.x - far.halfWidth);
  const right = Math.max(near.x + near.halfWidth, far.x + far.halfWidth);
  const top = Math.min(near.y - near.halfHeight, far.y - far.halfHeight);
  const bottom = Math.max(near.y + near.halfHeight, far.y + far.halfHeight);
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    halfWidth: (right - left) / 2,
    halfHeight: (bottom - top) / 2,
  };
}

/** What text beside a node must keep clear of. */
export interface Obstacles {
  /**
   * Lines, such as edges, from end to end, each with the half-width of
   * the band it may be drawn anywhere across (parallel edges spread
   * apart), or none.
   */
  readonly segments: readonly (
    readonly [Point, Point] | readonly [Point, Point, number]
  )[];
  /** Nodes, as circles. */
  readonly discs: readonly (Point & { readonly radius: number })[];
  /** Other text already placed. */
  readonly boxes: readonly LabelBox[];
}

/** Distance from a point to a box; 0 inside it. */
function pointToBox(p: Point, b: LabelBox): number {
  const dx = Math.max(0, Math.abs(p.x - b.x) - b.halfWidth);
  const dy = Math.max(0, Math.abs(p.y - b.y) - b.halfHeight);
  return Math.hypot(dx, dy);
}

/** Distance from a point to a segment. */
function pointToSegment(p: Point, a: Point, b: Point): number {
  const [vx, vy] = [b.x - a.x, b.y - a.y];
  const length2 = vx * vx + vy * vy;
  const t =
    length2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length2),
        );
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Whether a segment passes through a box (Liang–Barsky clipping). */
function crossesBox(a: Point, b: Point, box: LabelBox): boolean {
  let [t0, t1] = [0, 1];
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const sides: [number, number][] = [
    [-dx, a.x - (box.x - box.halfWidth)],
    [dx, box.x + box.halfWidth - a.x],
    [-dy, a.y - (box.y - box.halfHeight)],
    [dy, box.y + box.halfHeight - a.y],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Distance from a segment to a box; 0 where they touch. */
export function segmentToBox(a: Point, b: Point, box: LabelBox): number {
  if (crossesBox(a, b, box)) return 0;
  const corners: Point[] = [
    { x: box.x - box.halfWidth, y: box.y - box.halfHeight },
    { x: box.x + box.halfWidth, y: box.y - box.halfHeight },
    { x: box.x - box.halfWidth, y: box.y + box.halfHeight },
    { x: box.x + box.halfWidth, y: box.y + box.halfHeight },
  ];
  return Math.min(
    pointToBox(a, box),
    pointToBox(b, box),
    ...corners.map((c) => pointToSegment(c, a, b)),
  );
}

/** How far a box stays from every obstacle; 0 where it touches one. */
export function clearance(box: LabelBox, obstacles: Obstacles): number {
  let least = Infinity;
  for (const [a, b, half = 0] of obstacles.segments)
    least = Math.min(least, Math.max(0, segmentToBox(a, b, box) - half));
  for (const d of obstacles.discs)
    least = Math.min(least, Math.max(0, pointToBox(d, box) - d.radius));
  for (const o of obstacles.boxes)
    least = Math.min(
      least,
      Math.hypot(
        Math.max(0, Math.abs(o.x - box.x) - o.halfWidth - box.halfWidth),
        Math.max(0, Math.abs(o.y - box.y) - o.halfHeight - box.halfHeight),
      ),
    );
  return least;
}

/** Room a box keeps from a line or another box to count as clear of it. */
export const CLEAR = 2;

/**
 * The first of `candidates`, in order of preference, whose box clears
 * every obstacle by `CLEAR`; failing that, the one with the most room.
 */
export function clearestAngle(
  candidates: readonly number[],
  boxAt: (angle: number) => LabelBox,
  obstacles: Obstacles,
): number {
  let best = candidates[0] ?? 0;
  let room = -Infinity;
  for (const angle of candidates) {
    const free = clearance(boxAt(angle), obstacles);
    if (free >= CLEAR) return angle;
    if (free > room) [best, room] = [angle, free];
  }
  return best;
}
