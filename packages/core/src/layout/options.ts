/**
 * Geometry settings shared by all kinds' layouts.
 */
export interface LayoutOptions {
  /** Margin around the whole scene. */
  readonly padding: number;
  /** Vertical space between structures. */
  readonly structureGap: number;
  readonly cellHeight: number;
  readonly minCellWidth: number;
  readonly cellGap: number;
  /** Horizontal padding inside a cell, on each side. */
  readonly cellPadding: number;
  readonly valueFontSize: number;
  readonly titleFontSize: number;
  readonly indexFontSize: number;
  readonly pointerFontSize: number;
  /**
   * Average glyph width as a fraction of the font size. Layout cannot measure
   * text without a DOM, so it estimates widths for a monospace font.
   */
  readonly charWidthRatio: number;
}

export const defaultLayoutOptions: LayoutOptions = {
  padding: 16,
  structureGap: 24,
  cellHeight: 48,
  minCellWidth: 48,
  cellGap: 6,
  cellPadding: 12,
  valueFontSize: 18,
  titleFontSize: 14,
  indexFontSize: 12,
  pointerFontSize: 13,
  charWidthRatio: 0.6,
};
