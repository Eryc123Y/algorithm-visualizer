/**
 * Visual themes for the SVG painter (ADR 0009). Scenes carry semantic roles;
 * a theme turns them into colours, strokes and fonts.
 *
 * Every role is distinguishable without colour: compare has a heavy border,
 * swap a heavy dashed border, highlight a tinted fill, and settled a solid
 * fill with a check mark. This keeps figures readable in print, on
 * projectors and for colour-blind learners.
 */
import type { BoxRole } from '@algoviz/core';

export interface CellStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  /** SVG `stroke-dasharray`, or null for a solid border. */
  readonly dash: string | null;
  readonly text: string;
}

export interface SvgTheme {
  readonly fonts: {
    /** Cell values, indices and pointer names; should be monospace. */
    readonly value: string;
    /** Titles. */
    readonly label: string;
  };
  /** Corner radius of cells. */
  readonly radius: number;
  /** Fill behind the whole scene, or null for transparent. */
  readonly background: string | null;
  /** Colour of the soft shadow under cells, or null for none. */
  readonly shadow: string | null;
  readonly title: string;
  readonly index: string;
  readonly pointer: {
    readonly line: string;
    readonly fill: string;
    readonly text: string;
  };
  readonly cell: Readonly<Record<BoxRole, CellStyle>>;
  /** Colour of the check mark on settled cells, or null to hide it. */
  readonly settledMark: string | null;
}

const fonts = {
  value:
    "'JetBrains Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace",
  label:
    "'Inter', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const lightTheme: SvgTheme = {
  fonts,
  radius: 8,
  background: null,
  shadow: 'rgba(20, 45, 38, 0.10)',
  title: '#1f2a26',
  index: '#8a9590',
  pointer: { line: '#0f7b6c', fill: '#0f7b6c', text: '#ffffff' },
  cell: {
    default: {
      fill: '#ffffff',
      stroke: '#c9d3cf',
      strokeWidth: 1.25,
      dash: null,
      text: '#1f2a26',
    },
    compare: {
      fill: '#fff4dc',
      stroke: '#d08a18',
      strokeWidth: 2.5,
      dash: null,
      text: '#5c3b06',
    },
    swap: {
      fill: '#ffebe4',
      stroke: '#d4552b',
      strokeWidth: 2.5,
      dash: '5 3',
      text: '#6b2410',
    },
    highlight: {
      fill: '#e8efff',
      stroke: '#4a74d9',
      strokeWidth: 1.75,
      dash: null,
      text: '#1b3270',
    },
    settled: {
      fill: '#2f7d4f',
      stroke: '#2f7d4f',
      strokeWidth: 1.25,
      dash: null,
      text: '#ffffff',
    },
  },
  settledMark: '#ffffff',
};

export const darkTheme: SvgTheme = {
  fonts,
  radius: 8,
  background: null,
  shadow: 'rgba(0, 0, 0, 0.35)',
  title: '#e4ebe8',
  index: '#7f8c87',
  pointer: { line: '#4fc4b0', fill: '#4fc4b0', text: '#0d1a17' },
  cell: {
    default: {
      fill: '#1c2522',
      stroke: '#34433e',
      strokeWidth: 1.25,
      dash: null,
      text: '#e4ebe8',
    },
    compare: {
      fill: '#3b2c12',
      stroke: '#e9a53a',
      strokeWidth: 2.5,
      dash: null,
      text: '#fbe3b8',
    },
    swap: {
      fill: '#3d1e15',
      stroke: '#f07a52',
      strokeWidth: 2.5,
      dash: '5 3',
      text: '#ffd6c8',
    },
    highlight: {
      fill: '#1b2846',
      stroke: '#7c9ef0',
      strokeWidth: 1.75,
      dash: null,
      text: '#dbe5ff',
    },
    settled: {
      fill: '#3f9a63',
      stroke: '#3f9a63',
      strokeWidth: 1.25,
      dash: null,
      text: '#0d1a13',
    },
  },
  settledMark: '#0d1a13',
};

/** Greyscale theme for handouts, LaTeX and Typst documents. */
export const printTheme: SvgTheme = {
  fonts,
  radius: 4,
  background: null,
  shadow: null,
  title: '#000000',
  index: '#555555',
  pointer: { line: '#000000', fill: '#000000', text: '#ffffff' },
  cell: {
    default: {
      fill: '#ffffff',
      stroke: '#555555',
      strokeWidth: 1,
      dash: null,
      text: '#000000',
    },
    compare: {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2.5,
      dash: null,
      text: '#000000',
    },
    swap: {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2.5,
      dash: '5 3',
      text: '#000000',
    },
    highlight: {
      fill: '#e4e4e4',
      stroke: '#555555',
      strokeWidth: 1,
      dash: null,
      text: '#000000',
    },
    settled: {
      fill: '#3a3a3a',
      stroke: '#3a3a3a',
      strokeWidth: 1,
      dash: null,
      text: '#ffffff',
    },
  },
  settledMark: '#ffffff',
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
  print: printTheme,
} as const;

export type ThemeName = keyof typeof themes;

/**
 * Every property optional, recursively. Strings, numbers and null are leaves
 * that replace the base value.
 */
export type DeepPartial<T> = T extends object
  ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export type ThemeOverrides = DeepPartial<SvgTheme>;

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function deepMerge<T>(base: T, overrides: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) return overrides as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out as T;
}

/**
 * Derives a theme from a base theme and partial overrides, e.g.
 * `createTheme(lightTheme, { cell: { compare: { stroke: '#c00' } } })`.
 */
export function createTheme(
  base: SvgTheme | ThemeName,
  overrides: ThemeOverrides = {},
): SvgTheme {
  return deepMerge(typeof base === 'string' ? themes[base] : base, overrides);
}
