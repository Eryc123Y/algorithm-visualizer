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
  /** Draw each structure's title. */
  readonly showTitles: boolean;
  /** Draw index labels above array cells. */
  readonly showIndices: boolean;
}

export const defaultLayoutOptions: LayoutOptions = {
  padding: 20,
  structureGap: 28,
  cellHeight: 52,
  minCellWidth: 52,
  cellGap: 8,
  cellPadding: 14,
  valueFontSize: 20,
  titleFontSize: 13,
  indexFontSize: 12,
  pointerFontSize: 12,
  charWidthRatio: 0.6,
  showTitles: true,
  showIndices: true,
};

/**
 * Geometry for showing only the structures themselves, without titles or
 * indices, e.g. as a decorative animation.
 */
export const bareLayoutOptions: LayoutOptions = {
  ...defaultLayoutOptions,
  padding: 8,
  showTitles: false,
  showIndices: false,
};
