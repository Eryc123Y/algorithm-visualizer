import {
  interSemiBold,
  jetbrainsMonoSemiBold,
  type FontMetrics,
} from '@algoviz/fonts';

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
  structureGap: 28,
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
