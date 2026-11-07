import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceRuns, encodePath, type PathCommand } from '../src/encode.ts';

/** fast-check settings, deepened with FUZZ_RUNS and replayed with FUZZ_SEED. */
const fuzz = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 200),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

/**
 * An independent reading of path data: absolute end points of each
 * command, with `z` returning to the start of its contour. Implied
 * commands repeat the previous one, and pairs after a move are lines, as
 * SVG specifies.
 */
function ends(path: string): [string, number, number][] {
  const out: [string, number, number][] = [];
  const tokens = path.match(/[a-zA-Z]|-?\d+/g) ?? [];
  const arity: Record<string, number> = { M: 2, m: 2, l: 2, q: 4, c: 6, z: 0 };
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let command = '';
  let k = 0;
  while (k < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[k]!)) command = tokens[k++]!;
    else if (command === 'm' || command === 'M') command = 'l';
    const n = arity[command]!;
    const args = tokens.slice(k, k + n).map(Number);
    k += n;
    if (command === 'z') [x, y] = [sx, sy];
    else if (command === 'M') [x, y] = [args[0]!, args[1]!];
    else [x, y] = [x + args[n - 2]!, y + args[n - 1]!];
    if (command === 'M' || command === 'm') [sx, sy] = [x, y];
    out.push([command.toUpperCase(), x, y]);
  }
  return out;
}

/** End points of the commands, as SVG would draw them, y flipped. */
function expected(
  commands: readonly PathCommand[],
): [string, number, number][] {
  let [sx, sy, x, y] = [0, 0, 0, 0];
  return commands.flatMap((c): [string, number, number][] => {
    if (c.type === 'Z') {
      [x, y] = [sx, sy];
      return [['Z', x, y]];
    }
    // `+ 0` turns -0 into 0, as the path's digits do.
    [x, y] = [Math.round(c.x), -Math.round(c.y) + 0];
    if (c.type === 'M') [sx, sy] = [x, y];
    return [[c.type, x, y]];
  });
}

describe('encodePath', () => {
  it('starts with an absolute move and continues relatively', () => {
    expect(
      encodePath([
        { type: 'M', x: 10, y: 0 },
        { type: 'L', x: 10, y: 700 },
        { type: 'L', x: 300, y: 700 },
        { type: 'Z' },
      ]),
    ).toBe('M10 0l0-700 290 0z');
  });

  it('rounds to font units and flips y', () => {
    expect(
      encodePath([
        { type: 'M', x: 0.4, y: -0.6 },
        { type: 'Q', x1: 50.5, y1: 100.2, x: 100, y: 0 },
      ]),
    ).toBe('M0 1q51-101 100-1');
  });

  it('drops empty lines and the line that closes a contour', () => {
    expect(
      encodePath([
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 0, y: 0 },
        { type: 'L', x: 100, y: 0 },
        { type: 'L', x: 100, y: 100 },
        { type: 'L', x: 0, y: 0 },
        { type: 'Z' },
      ]),
    ).toBe('M0 0l100 0 0-100z');
  });

  it('measures a new contour from where the last one closed', () => {
    expect(
      encodePath([
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 100, y: 0 },
        { type: 'L', x: 100, y: 100 },
        { type: 'Z' },
        { type: 'M', x: 20, y: 20 },
        { type: 'L', x: 30, y: 20 },
        { type: 'Z' },
      ]),
    ).toBe('M0 0l100 0 0-100zm20-20l10 0z');
  });

  it('never leaves a move implied, even after another move', () => {
    const path = encodePath([
      { type: 'M', x: 0, y: 0 },
      { type: 'M', x: 10, y: 10 },
      { type: 'M', x: 20, y: 20 },
      { type: 'L', x: 30, y: 30 },
    ]);
    expect(path).toBe('M0 0m10-10m10-10l10-10');
    expect(ends(path).map(([c]) => c)).toEqual(['M', 'M', 'M', 'L']);
  });

  it('draws the same points as the commands, for any glyph', () => {
    const coord = fc.integer({ min: -2000, max: 2000 });
    const point = { x: coord, y: coord };
    const segment = fc.oneof(
      fc.record({ type: fc.constant('L' as const), ...point }),
      fc.record({
        type: fc.constant('Q' as const),
        x1: coord,
        y1: coord,
        ...point,
      }),
      fc.record({
        type: fc.constant('C' as const),
        x1: coord,
        y1: coord,
        x2: coord,
        y2: coord,
        ...point,
      }),
    );
    const contour = fc
      .tuple(
        fc.record({ type: fc.constant('M' as const), ...point }),
        fc.array(segment, { maxLength: 6 }),
      )
      .map(([move, rest]): PathCommand[] => [move, ...rest, { type: 'Z' }]);
    fc.assert(
      fc.property(fc.array(contour, { maxLength: 4 }), (contours) => {
        const commands = contours.flat();
        const drawn = ends(encodePath(commands));
        // Dropped lines are those that do not move the pen.
        const kept = expected(commands).filter(
          ([c, x, y], k, all) =>
            c !== 'L' ||
            (!(all[k - 1]![1] === x && all[k - 1]![2] === y) &&
              !(commands[k + 1]?.type === 'Z' && closesAt(all, k, x, y))),
        );
        expect(drawn).toEqual(kept);
      }),
      fuzz,
    );
  });
});

/** Whether the point at `k` is the start of the contour it belongs to. */
function closesAt(
  all: readonly [string, number, number][],
  k: number,
  x: number,
  y: number,
): boolean {
  let j = k;
  while (j > 0 && all[j]![0] !== 'M') j--;
  return all[j]![1] === x && all[j]![2] === y;
}

describe('advanceRuns', () => {
  it('stores runs of one width as ranges, others as lists', () => {
    expect(
      advanceRuns([
        [32, 600],
        [33, 600],
        [34, 600],
        [65, 700],
        [66, 650],
        [68, 500],
      ]),
    ).toEqual([
      [32, 34, 600],
      [65, [700, 650]],
      [68, 68, 500],
    ]);
  });

  it('is empty for no code points', () => {
    expect(advanceRuns([])).toEqual([]);
  });
});
