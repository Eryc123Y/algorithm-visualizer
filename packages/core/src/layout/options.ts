import {
  interSemiBold,
  jetbrainsMonoSemiBold,
  type FontMetrics,
} from '@algomotion/fonts';

/**
 * Metrics of the two fonts a scene's text is set in (ADR 0024). Painters
 * must draw with the faces whose metrics laid the scene out; an SVG
 * theme's `fontMetrics` names them.
 */
export interface LayoutFonts {
  /** Values, indices, pointer names, notes and edge labels. */
  readonly value: FontMetrics;
  /** Titles, and labels such as "top" or "null". */
  readonly label: FontMetrics;
}

/** JetBrains Mono SemiBold for values, Inter SemiBold for titles. */
export const defaultFonts: LayoutFonts = {
  value: jetbrainsMonoSemiBold,
  label: interSemiBold,
};

/**
 * How a figure arranges structures declared with `place: "side"` (ADR
 * 0029): in a column right of the main ones (`wide`, for slides and the
 * player) or below them (`narrow`, for a column of notes).
 */
export type FigureLayout = 'wide' | 'narrow';

/**
 * Where a structure is drawn: `side` in the side column of a wide figure,
 * `main` everywhere else. Kinds that can draw either way, such as the
 * priority queue, follow it.
 */
export type Region = 'main' | 'side';

/**
 * Geometry settings shared by all kinds' layouts.
 */
export interface LayoutOptions {
  /** Margin around the whole scene. */
  readonly padding: number;
  /** Where side structures go; see `FigureLayout`. */
  readonly layout: FigureLayout;
  /** Vertical space between structures. */
  readonly structureGap: number;
  /** Horizontal space between the main and side columns of a wide figure. */
  readonly columnGap: number;
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
   * Metrics that text is measured with. Trace-wide metrics are measured
   * with them too, so a scene must be laid out with the fonts its metrics
   * were measured with.
   */
  readonly fonts: LayoutFonts;
  /** Draw each structure's title. */
  readonly showTitles: boolean;
  /** Draw index labels above array cells. */
  readonly showIndices: boolean;
}

export const defaultLayoutOptions: LayoutOptions = {
  padding: 20,
  layout: 'wide',
  structureGap: 28,
  columnGap: 40,
  cellHeight: 52,
  minCellWidth: 52,
  cellGap: 8,
  cellPadding: 14,
  valueFontSize: 20,
  titleFontSize: 13,
  indexFontSize: 12,
  pointerFontSize: 12,
  fonts: defaultFonts,
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
