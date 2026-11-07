/**
 * Placing painted shapes on the canvas. The SVG painter draws each item
 * around its origin and positions it with a transform (ADR 0003); TikZ
 * output writes every point in scene coordinates instead, so the same
 * shapes land in the same places without TikZ's own transforms, whose
 * rotation runs the other way once the y axis points down.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** An affine map `p ↦ (a·x + c·y + e, b·x + d·y + f)`, as in SVG. */
export interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/**
 * The transform of a painted item: translate, then rotate by `rotate`
 * degrees (clockwise on screen, as SVG's y axis points down), then stretch
 * horizontally by `scaleX`.
 */
export function itemTransform(
  x: number,
  y: number,
  rotate = 0,
  scaleX = 1,
): Affine {
  const rad = (rotate * Math.PI) / 180;
  // Exact for the right angles that self-loops use.
  const cos = rotate % 90 === 0 ? Math.round(Math.cos(rad)) : Math.cos(rad);
  const sin = rotate % 90 === 0 ? Math.round(Math.sin(rad)) : Math.sin(rad);
  return { a: cos * scaleX, b: sin * scaleX, c: -sin, d: cos, e: x, f: y };
}

export const apply = (m: Affine, p: Point): Point => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

/** Whether a transform only moves shapes, so lengths and angles stay. */
export const isTranslation = (m: Affine): boolean =>
  m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1;

/** One segment of a path, in absolute coordinates. */
export type PathSegment =
  | { readonly type: 'move'; readonly to: Point }
  | { readonly type: 'line'; readonly to: Point }
  | {
      readonly type: 'curve';
      readonly c1: Point;
      readonly c2: Point;
      readonly to: Point;
    };

const COMMAND = /([MLCml])([^MLCml]*)/g;

/**
 * Reads the path data the painter writes: `M`, `L`, `C` and relative `m`
 * and `l`, with numbers separated by spaces or commas.
 * @throws Error for anything else, which would be a painter bug.
 */
export function parsePath(d: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let at: Point = { x: 0, y: 0 };
  let read = 0;
  for (const match of d.matchAll(COMMAND)) {
    if (match.index !== read) break;
    read += match[0].length;
    const command = match[1]!;
    const numbers = (
      match[2]!.trim().match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
    ).map(Number);
    const stride = command === 'C' ? 6 : 2;
    if (numbers.length === 0 || numbers.length % stride !== 0)
      throw new Error(`Cannot read the path "${d}"`);
    for (let k = 0; k < numbers.length; k += stride) {
      const n = numbers.slice(k, k + stride);
      const relative = command === 'm' || command === 'l';
      const point = (i: number): Point => ({
        x: n[i]! + (relative ? at.x : 0),
        y: n[i + 1]! + (relative ? at.y : 0),
      });
      if (command === 'C') {
        segments.push({
          type: 'curve',
          c1: point(0),
          c2: point(2),
          to: point(4),
        });
      } else {
        const first = k === 0 && (command === 'M' || command === 'm');
        segments.push({ type: first ? 'move' : 'line', to: point(0) });
      }
      at = segments.at(-1)!.to;
    }
  }
  if (read !== d.length) throw new Error(`Cannot read the path "${d}"`);
  return segments;
}
