/**
 * The descents painters place check marks with (ADR 0031) against the
 * bundled outlines, measured again here.
 */
import { describe, expect, it } from 'vitest';

import { descentOf, FACE_DESCENTS } from '../src/descent.ts';
import { bundledOutlines } from '../src/outline.ts';

import { glyphDepth } from './glyph-depth.ts';

const PRINTABLE = Array.from({ length: 95 }, (_, k) =>
  String.fromCodePoint(32 + k),
);

describe('descents of the bundled faces', () => {
  for (const outlines of bundledOutlines) {
    const depths = outlines.glyphs.map(
      ([c, path]) => [c, glyphDepth(path) / outlines.unitsPerEm] as const,
    );
    const deepest = (glyphs: typeof depths) =>
      Math.max(0, ...glyphs.map(([, d]) => d));
    const face = { id: outlines.id } as Parameters<typeof descentOf>[1];

    it(`lists ${outlines.id} as deep as its deepest glyph, and no deeper`, () => {
      const listed = FACE_DESCENTS[outlines.id];
      expect(listed).toBeDefined();
      const [ascii, any] = listed!;
      const measured = [
        deepest(depths.filter(([c]) => c < 127)),
        deepest(depths),
      ];
      expect(ascii).toBeGreaterThanOrEqual(measured[0]!);
      expect(ascii).toBeLessThan(measured[0]! + 0.005);
      expect(any).toBeGreaterThanOrEqual(measured[1]!);
      expect(any).toBeLessThan(measured[1]! + 0.005);
    });

    it(`counts only ${outlines.id}'s descending characters`, () => {
      const glyphs = new Map(depths);
      for (const ch of PRINTABLE) {
        const depth = glyphs.get(ch.codePointAt(0)!) ?? 0;
        // A character said to stay on the baseline overshoots it at most.
        if (descentOf(ch, face) === 0)
          expect(depth, ch).toBeLessThanOrEqual(0.03);
        else expect(descentOf(ch, face), ch).toBeGreaterThanOrEqual(depth);
      }
    });
  }

  it('assumes common descenders for other faces', () => {
    const other = { id: 'other' } as Parameters<typeof descentOf>[1];
    expect(descentOf('12', other)).toBe(0);
    expect(descentOf('y', other)).toBe(0.25);
    expect(descentOf('β', other)).toBe(0.32);
  });
});
