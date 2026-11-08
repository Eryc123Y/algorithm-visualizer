/**
 * How far a value's glyphs go below the baseline, which places the check
 * mark under them (ADR 0031). Painters know a face by its metrics, which
 * carry no glyph bounds, so the bundled faces' depths are listed here; a
 * test measures them again from the outlines.
 */
import type { FontMetrics } from '@algoviz/fonts';

/**
 * Characters whose ink stays on or above the baseline in every bundled
 * face, give or take the overshoot of round letters. Any other character
 * may descend: g, j, p, q, y, J, Q, brackets, commas and the like.
 */
const ON_BASELINE = /^[ !"#%&'*\-.0-9:=?A-IK-PR-Z^`a-fhik-or-xz~]*$/;

const ASCII = /^[\x20-\x7e]*$/;

/**
 * Depth of the deepest glyph of each bundled face, in em: among its ASCII
 * characters, and among all of them.
 */
export const FACE_DESCENTS: Readonly<
  Record<string, readonly [ascii: number, any: number]>
> = {
  'dotgothic16-regular': [0.12, 0.12],
  'inter-semibold': [0.235, 0.32],
  'jetbrains-mono-semibold': [0.18, 0.21],
  'lexend-semibold': [0.23, 0.246],
  'noto-sans-mono-semibold': [0.245, 0.245],
  'noto-sans-semibold': [0.24, 0.241],
  'stix-two-text-semibold': [0.235, 0.251],
};

/** For other faces: as deep as most fonts' descenders go. */
const OTHER_FACE: readonly [number, number] = [0.25, 0.32];

/** How far the glyphs of `text` may go below the baseline in `face`, in em. */
export function descentOf(text: string, face: FontMetrics): number {
  if (ON_BASELINE.test(text)) return 0;
  const [ascii, any] = FACE_DESCENTS[face.id] ?? OTHER_FACE;
  return ASCII.test(text) ? ascii : any;
}
