import { describe, expect, it } from 'vitest';

import {
  interSemiBold,
  interSemiBoldOutlines,
  jetbrainsMonoSemiBold,
  jetbrainsMonoSemiBoldOutlines,
  textWidth,
  type FontMetrics,
  type FontOutlines,
} from '../src/index.ts';

const faces: readonly (readonly [FontMetrics, FontOutlines])[] = [
  [jetbrainsMonoSemiBold, jetbrainsMonoSemiBoldOutlines],
  [interSemiBold, interSemiBoldOutlines],
];

const ascii = Array.from({ length: 0x7f - 0x20 }, (_, k) => 0x20 + k);

/** Absolute points of path data, following its relative commands. */
function points(path: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const tokens = path.match(/[a-zA-Z]|-?\d+/g) ?? [];
  const arity: Record<string, number> = { M: 2, m: 2, l: 2, q: 4, c: 6, z: 0 };
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let command = '';
  let k = 0;
  while (k < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[k]!)) command = tokens[k++]!;
    else if (command === '' || command === 'z')
      throw new Error(`number without a command in ${path}`);
    const n = arity[command];
    if (n === undefined) throw new Error(`unknown command ${command}`);
    const args = tokens.slice(k, k + n).map(Number);
    if (args.length !== n || args.some(Number.isNaN))
      throw new Error(`bad arguments for ${command} in ${path}`);
    k += n;
    if (command === 'z') {
      [x, y] = [sx, sy];
      continue;
    }
    if (command === 'M') [x, y] = args as [number, number];
    else {
      for (let j = 0; j < n - 2; j += 2)
        out.push({ x: x + args[j]!, y: y + args[j + 1]! });
      x += args[n - 2]!;
      y += args[n - 1]!;
    }
    if (command === 'M' || command === 'm') [sx, sy] = [x, y];
    out.push({ x, y });
  }
  return out;
}

describe.each(faces)('%s', (metrics, outlines) => {
  const advance = (cp: number) =>
    textWidth(String.fromCodePoint(cp), metrics) * metrics.unitsPerEm;

  it('names the same face in its metrics and outlines', () => {
    expect(outlines.id).toBe(metrics.id);
    expect(outlines.unitsPerEm).toBe(metrics.unitsPerEm);
  });

  it('measures and outlines every printable ASCII character', () => {
    const outlined = new Set(outlines.glyphs.map(([cp]) => cp));
    for (const cp of ascii) {
      expect(outlined.has(cp)).toBe(true);
      expect(advance(cp)).toBeGreaterThan(0);
    }
  });

  it('outlines the symbols of algorithm figures', () => {
    const outlined = new Set(outlines.glyphs.map(([cp]) => cp));
    for (const char of '∞≤≥≠←→×÷±−αβπ')
      expect(outlined.has(char.codePointAt(0)!)).toBe(true);
  });

  it('measures every glyph it outlines with its own table', () => {
    const table = new Map<number, number>();
    for (const run of metrics.advances)
      if (typeof run[1] === 'number')
        for (let cp = run[0]; cp <= run[1]; cp++) table.set(cp, run[2]!);
      else run[1].forEach((w, k) => table.set(run[0] + k, w));
    for (const [cp] of outlines.glyphs) expect(table.has(cp)).toBe(true);
  });

  it('keeps every outline inside its glyph box', () => {
    // Integer deltas that drifted would push points far outside.
    const em = metrics.unitsPerEm;
    for (const [cp, path] of outlines.glyphs) {
      if (path === '') continue;
      expect(path).toMatch(/^M-?\d+[ -]?\d+/);
      for (const p of points(path)) {
        expect(p.x).toBeGreaterThanOrEqual(-0.25 * em);
        expect(p.x).toBeLessThanOrEqual(advance(cp) + 0.25 * em);
        expect(p.y).toBeGreaterThanOrEqual(-1.1 * em);
        expect(p.y).toBeLessThanOrEqual(0.4 * em);
      }
    }
  });
});

describe('the bundled faces', () => {
  it('JetBrains Mono is monospace: 0.6 em for everything it has', () => {
    for (const run of jetbrainsMonoSemiBold.advances)
      expect(run).toEqual([run[0], expect.any(Number), 600]);
    expect(textWidth('0123456789', jetbrainsMonoSemiBold)).toBe(6);
    expect(textWidth('∞≤←', jetbrainsMonoSemiBold)).toBeCloseTo(1.8, 12);
  });

  it('Inter is proportional', () => {
    expect(textWidth('W', interSemiBold)).toBeGreaterThan(
      2 * textWidth('i', interSemiBold),
    );
    expect(textWidth('D', interSemiBold)).toBe(1479 / 2048);
  });
});
