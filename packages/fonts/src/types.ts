/**
 * Data describing a bundled font face (ADR 0024): its advance widths, which
 * layout measures text with, and its glyph outlines, which standalone SVG
 * draws text with. Both are plain values, so they can travel in layout
 * options and be loaded by other implementations.
 */

/**
 * Advance widths of consecutive code points, in font units:
 * `[first, last, width]` when they share one width, `[first, widths]`
 * otherwise (`widths[k]` belongs to code point `first + k`).
 */
export type AdvanceRun =
  | readonly [first: number, last: number, width: number]
  | readonly [first: number, widths: readonly number[]];

export interface FontMetrics {
  /** Names the face, e.g. "jetbrains-mono-semibold"; its outlines carry the same id. */
  readonly id: string;
  /** CSS family name. */
  readonly family: string;
  /** CSS font weight. */
  readonly weight: number;
  readonly unitsPerEm: number;
  /** Code points the face has, with their advances. */
  readonly advances: readonly AdvanceRun[];
  /**
   * Advance, in font units, of every code point the table lacks. It
   * replaces the fallbacks for wide glyphs, emoji and other scripts, for
   * faces whose glyphs all have one width (see `uniformFont`).
   */
  readonly defaultAdvance?: number;
}

/**
 * A glyph: its code point and SVG path data in font units, with y pointing
 * down and the origin on the baseline at the pen position. The first
 * command is an absolute move (`M`); the rest are relative, so the glyph
 * moves by changing that one command. Blank glyphs have empty data.
 */
export type GlyphOutline = readonly [codePoint: number, path: string];

export interface FontOutlines {
  /** The id of the face's metrics. */
  readonly id: string;
  readonly unitsPerEm: number;
  readonly glyphs: readonly GlyphOutline[];
}
