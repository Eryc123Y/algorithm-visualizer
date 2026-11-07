/**
 * The small part of opentype.js 2.0 that scripts/fonts.ts uses; the
 * package ships no types.
 */
declare module 'opentype.js' {
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

  export interface Glyph {
    readonly index: number;
    readonly advanceWidth: number;
    readonly path: { readonly commands: readonly PathCommand[] };
  }

  export interface Font {
    readonly unitsPerEm: number;
    charToGlyphIndex(char: string): number;
    charToGlyph(char: string): Glyph;
  }

  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
