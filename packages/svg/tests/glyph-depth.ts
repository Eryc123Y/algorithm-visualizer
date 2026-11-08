/** Glyph depths below the baseline, measured from the bundled outlines. */
import { bundledOutlines } from '../src/outline.ts';

/**
 * How far a glyph's outline goes below the baseline, in font units (y
 * points down). Control points count, so this is never less than the ink.
 */
export function glyphDepth(path: string): number {
  let x = 0;
  let y = 0;
  let start = { x: 0, y: 0 };
  let deepest = 0;
  const arity: Record<string, number> = {
    M: 2,
    L: 2,
    H: 1,
    V: 1,
    Q: 4,
    C: 6,
    T: 2,
    S: 4,
  };
  for (const [, c, args] of path.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const command = c!.toUpperCase();
    const relative = c !== command;
    if (command === 'Z') {
      ({ x, y } = start);
      continue;
    }
    const n = (args!.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? []).map(
      Number,
    );
    const stride = arity[command]!;
    for (let k = 0; k < n.length; k += stride) {
      const a = n.slice(k, k + stride);
      if (command === 'H') x = (relative ? x : 0) + a[0]!;
      else if (command === 'V') y = (relative ? y : 0) + a[0]!;
      else {
        for (let i = 1; i < stride; i += 2)
          deepest = Math.max(deepest, (relative ? y : 0) + a[i]!);
        x = (relative ? x : 0) + a[stride - 2]!;
        y = (relative ? y : 0) + a[stride - 1]!;
      }
      deepest = Math.max(deepest, y);
      if (command === 'M' && k === 0) start = { x, y };
    }
  }
  return deepest;
}

/** How far the ink of `text` goes below the baseline in a bundled face, in em. */
export function inkDepth(text: string, face: string): number {
  const outlines = bundledOutlines.find((f) => f.id === face)!;
  const glyphs = new Map(outlines.glyphs);
  return Math.max(
    0,
    ...[...text].map(
      (ch) =>
        glyphDepth(glyphs.get(ch.codePointAt(0)!) ?? '') / outlines.unitsPerEm,
    ),
  );
}
