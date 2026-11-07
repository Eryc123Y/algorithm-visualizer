/**
 * Encodings of the generated faces (ADR 0024), used by scripts/fonts.ts:
 * advance widths as runs, and glyph outlines as compact SVG path data.
 */
import type { AdvanceRun } from './types.ts';

/** A drawing command of a glyph, in font units with y pointing up. */
export type PathCommand =
  | { readonly type: 'M' | 'L'; readonly x: number; readonly y: number }
  | {
      readonly type: 'Q';
      readonly x1: number;
      readonly y1: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'C';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'Z' };

/**
 * Path data in integer font units with y pointing down: an absolute `M`
 * first, relative commands after it. Zero-length lines, and lines back to
 * the start of a contour just before it closes, are dropped. A repeated
 * line or curve drops its letter; a number is separated by a space only
 * from a number before it, unless its minus sign separates it.
 */
export function encodePath(commands: readonly PathCommand[]): string {
  let d = '';
  let [cx, cy, sx, sy] = [0, 0, 0, 0];
  let last = '';
  const emit = (letter: string, numbers: readonly number[]) => {
    // Pairs after a move continue as lines, so a move is never implied.
    if (letter !== last || letter === 'z' || letter === 'm') d += letter;
    for (const n of numbers)
      d += d === '' || /[a-zA-Z]$/.test(d) || n < 0 ? `${n}` : ` ${n}`;
    last = letter;
  };
  // Offsets from the current point to a point, rounded to font units.
  const rel = (x: number, y: number): [number, number] => [
    Math.round(x) - cx,
    -Math.round(y) - cy,
  ];
  const advance = ([dx, dy]: readonly [number, number]) => {
    cx += dx;
    cy += dy;
  };
  commands.forEach((c, k) => {
    switch (c.type) {
      case 'M': {
        const delta = rel(c.x, c.y);
        emit(d === '' ? 'M' : 'm', delta);
        advance(delta);
        [sx, sy] = [cx, cy];
        break;
      }
      case 'L': {
        const delta = rel(c.x, c.y);
        const closes =
          commands[k + 1]?.type === 'Z' &&
          cx + delta[0] === sx &&
          cy + delta[1] === sy;
        if ((delta[0] === 0 && delta[1] === 0) || closes) break;
        emit('l', delta);
        advance(delta);
        break;
      }
      case 'Q': {
        const delta = rel(c.x, c.y);
        emit('q', [...rel(c.x1, c.y1), ...delta]);
        advance(delta);
        break;
      }
      case 'C': {
        const delta = rel(c.x, c.y);
        emit('c', [...rel(c.x1, c.y1), ...rel(c.x2, c.y2), ...delta]);
        advance(delta);
        break;
      }
      case 'Z':
        emit('z', []);
        [cx, cy] = [sx, sy];
        break;
    }
  });
  return d;
}

/**
 * Advances of code points, in ascending order, as runs of consecutive code
 * points: `[first, last, width]` when they share a width, else
 * `[first, widths]`.
 */
export function advanceRuns(
  advances: readonly (readonly [codePoint: number, width: number])[],
): AdvanceRun[] {
  const runs: { first: number; widths: number[] }[] = [];
  for (const [cp, width] of advances) {
    const run = runs.at(-1);
    if (run !== undefined && run.first + run.widths.length === cp)
      run.widths.push(width);
    else runs.push({ first: cp, widths: [width] });
  }
  return runs.map(({ first, widths }) =>
    widths.every((w) => w === widths[0])
      ? [first, first + widths.length - 1, widths[0]!]
      : [first, widths],
  );
}
