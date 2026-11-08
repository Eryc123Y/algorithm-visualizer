/**
 * The part of subset-font 2.9 that scripts/fonts.ts uses; the package
 * ships no types. It runs HarfBuzz compiled to WebAssembly.
 */
declare module 'subset-font' {
  export interface SubsetOptions {
    readonly targetFormat?: 'sfnt' | 'woff' | 'woff2';
    /** Pins each named axis of a variable font at a value. */
    readonly variationAxes?: Readonly<Record<string, number>>;
  }

  /** `font` cut down to the glyphs `text` needs, in `targetFormat`. */
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: SubsetOptions,
  ): Promise<Buffer>;
}
