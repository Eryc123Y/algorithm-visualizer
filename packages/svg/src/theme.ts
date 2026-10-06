/**
 * Colours and fonts for the SVG painter. Scenes only carry semantic roles;
 * this is where roles become colours (ADR 0003).
 */
import type { BoxRole } from '@algoviz/core';

export interface SvgTheme {
  /** Fill behind the whole scene, or null for transparent. */
  readonly background: string | null;
  readonly fontFamily: string;
  /** Title text. */
  readonly text: string;
  /** Index labels. */
  readonly muted: string;
  readonly pointer: string;
  readonly cell: Readonly<
    Record<
      BoxRole,
      { readonly fill: string; readonly stroke: string; readonly text: string }
    >
  >;
}

const fontFamily =
  "ui-monospace, 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace";

export const lightTheme: SvgTheme = {
  background: null,
  fontFamily,
  text: '#1d2421',
  muted: '#5d6a64',
  pointer: '#0f7b6c',
  cell: {
    default: { fill: '#e6f1ee', stroke: '#9cbdb5', text: '#1d2421' },
    compare: { fill: '#fbefd5', stroke: '#b7791f', text: '#1d2421' },
    highlight: { fill: '#e2eafb', stroke: '#3b6fd4', text: '#1d2421' },
    settled: { fill: '#e2efdf', stroke: '#3f7d3a', text: '#2f6a2b' },
  },
};

export const darkTheme: SvgTheme = {
  background: null,
  fontFamily,
  text: '#e3e9e6',
  muted: '#9aa8a1',
  pointer: '#4fc4b0',
  cell: {
    default: { fill: '#1f2b28', stroke: '#3f5a53', text: '#e3e9e6' },
    compare: { fill: '#3a2e17', stroke: '#e0a84a', text: '#f3e3c3' },
    highlight: { fill: '#1c2a45', stroke: '#7aa2f0', text: '#dde7fb' },
    settled: { fill: '#1f3320', stroke: '#7cc072', text: '#c9e8c3' },
  },
};
