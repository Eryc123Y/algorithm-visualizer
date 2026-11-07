/**
 * Visual themes for the SVG painter (ADR 0009). Scenes carry semantic roles;
 * a theme turns them into colours, strokes and fonts.
 *
 * Every role is distinguishable without colour: compare has a heavy border,
 * swap a heavy dashed border, highlight a tinted fill, visited a dotted
 * border, and settled a solid fill with a check mark. This keeps figures readable in print, on
 * projectors and for colour-blind learners.
 */
import {
  defaultFonts,
  type EdgeRole,
  type ElementRole,
  type LayoutFonts,
} from '@algoviz/core';

export interface CellStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  /** SVG `stroke-dasharray`, or null for a solid border. */
  readonly dash: string | null;
  readonly text: string;
}

export interface SvgTheme {
  /**
   * CSS font families, for text drawn as text. Each list starts with the
   * family of the matching face in `fontMetrics`.
   */
  readonly fonts: {
    /** Values, indices, pointer names, notes and edge labels. */
    readonly value: string;
    /** Titles and labels. */
    readonly label: string;
  };
  /**
   * The faces the painter draws with. Lay scenes out with the same metrics
   * (`LayoutOptions.fonts`), so text fits what layout measured (ADR 0024).
   */
  readonly fontMetrics: LayoutFonts;
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
  /** Cells and nodes, by role. */
  readonly cell: Readonly<Record<ElementRole, CellStyle>>;
  /** Colour of the check mark on settled cells, or null to hide it. */
  readonly settledMark: string | null;
  /** Fills for categorical groups 0–5; used when no stronger role applies. */
  readonly groups: readonly [
    GroupStyle,
    GroupStyle,
    GroupStyle,
    GroupStyle,
    GroupStyle,
    GroupStyle,
  ];
  /** Red–black tree node colours. */
  readonly rb: { readonly red: GroupStyle; readonly black: GroupStyle };
  readonly edge: Readonly<Record<EdgeRole, EdgeStyle>>;
  /** Outline drawn behind edge labels so they stay legible over lines. */
  readonly labelHalo: string;
}

export interface GroupStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
}

export interface EdgeStyle {
  readonly stroke: string;
  readonly width: number;
  readonly opacity: number;
}

const fonts = {
  value:
    "'JetBrains Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace",
  label:
    "'Inter', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const lightTheme: SvgTheme = {
  fonts,
  fontMetrics: defaultFonts,
  radius: 8,
  background: null,
  shadow: 'rgba(20, 45, 38, 0.10)',
  title: '#1f2a26',
  index: '#66736d',
  pointer: { line: '#0f7b6c', fill: '#0f7b6c', text: '#ffffff' },
  cell: {
    visited: {
      fill: '#f3f6f8',
      stroke: '#7b8b94',
      strokeWidth: 1.5,
      dash: '2 2.5',
      text: '#3d4a52',
    },
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
  groups: [
    { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e3a8a' },
    { fill: '#fce7f3', stroke: '#db2777', text: '#831843' },
    { fill: '#dcfce7', stroke: '#16a34a', text: '#14532d' },
    { fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
    { fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
    { fill: '#cffafe', stroke: '#0891b2', text: '#164e63' },
  ],
  rb: {
    red: { fill: '#d63c3c', stroke: '#a82525', text: '#ffffff' },
    black: { fill: '#2b2f2d', stroke: '#111312', text: '#ffffff' },
  },
  edge: {
    default: { stroke: '#9aa7a2', width: 1.75, opacity: 1 },
    link: { stroke: '#6b7772', width: 1.5, opacity: 1 },
    highlight: { stroke: '#d08a18', width: 3, opacity: 1 },
    selected: { stroke: '#0f7b6c', width: 3.5, opacity: 1 },
    rejected: { stroke: '#c9d3cf', width: 1.25, opacity: 0.6 },
  },
  labelHalo: '#ffffff',
};

export const darkTheme: SvgTheme = {
  fonts,
  fontMetrics: defaultFonts,
  radius: 8,
  background: null,
  shadow: 'rgba(0, 0, 0, 0.35)',
  title: '#e4ebe8',
  index: '#7f8c87',
  pointer: { line: '#4fc4b0', fill: '#4fc4b0', text: '#0d1a17' },
  cell: {
    visited: {
      fill: '#1a2226',
      stroke: '#7f939c',
      strokeWidth: 1.5,
      dash: '2 2.5',
      text: '#cfd8dc',
    },
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
  groups: [
    { fill: '#1e3a5f', stroke: '#60a5fa', text: '#dbeafe' },
    { fill: '#4a1d36', stroke: '#f472b6', text: '#fce7f3' },
    { fill: '#173d26', stroke: '#4ade80', text: '#dcfce7' },
    { fill: '#45330f', stroke: '#fbbf24', text: '#fef3c7' },
    { fill: '#33215c', stroke: '#a78bfa', text: '#ede9fe' },
    { fill: '#123d47', stroke: '#22d3ee', text: '#cffafe' },
  ],
  rb: {
    red: { fill: '#c23535', stroke: '#ff8080', text: '#ffffff' },
    black: { fill: '#0b0d0c', stroke: '#8a9590', text: '#ffffff' },
  },
  edge: {
    default: { stroke: '#5f6f69', width: 1.75, opacity: 1 },
    link: { stroke: '#8a9590', width: 1.5, opacity: 1 },
    highlight: { stroke: '#e9a53a', width: 3, opacity: 1 },
    selected: { stroke: '#4fc4b0', width: 3.5, opacity: 1 },
    rejected: { stroke: '#34433e', width: 1.25, opacity: 0.7 },
  },
  labelHalo: '#151b19',
};

/** Greyscale theme for handouts, LaTeX and Typst documents. */
export const printTheme: SvgTheme = {
  fonts,
  fontMetrics: defaultFonts,
  radius: 4,
  background: null,
  shadow: null,
  title: '#000000',
  index: '#555555',
  pointer: { line: '#000000', fill: '#000000', text: '#ffffff' },
  cell: {
    visited: {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      dash: '1.5 2',
      text: '#000000',
    },
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
  groups: [
    { fill: '#f2f2f2', stroke: '#555555', text: '#000000' },
    { fill: '#d9d9d9', stroke: '#555555', text: '#000000' },
    { fill: '#bfbfbf', stroke: '#555555', text: '#000000' },
    { fill: '#a6a6a6', stroke: '#333333', text: '#000000' },
    { fill: '#8c8c8c', stroke: '#333333', text: '#000000' },
    { fill: '#737373', stroke: '#333333', text: '#ffffff' },
  ],
  rb: {
    red: { fill: '#ffffff', stroke: '#000000', text: '#000000' },
    black: { fill: '#222222', stroke: '#000000', text: '#ffffff' },
  },
  edge: {
    default: { stroke: '#555555', width: 1.5, opacity: 1 },
    link: { stroke: '#333333', width: 1.25, opacity: 1 },
    highlight: { stroke: '#000000', width: 3, opacity: 1 },
    selected: { stroke: '#000000', width: 4, opacity: 1 },
    rejected: { stroke: '#bbbbbb', width: 1, opacity: 1 },
  },
  labelHalo: '#ffffff',
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

/**
 * Partial overrides of a theme. In `fontMetrics`, each role's face is
 * replaced whole, never merged field by field.
 */
export type ThemeOverrides = DeepPartial<Omit<SvgTheme, 'fontMetrics'>> & {
  readonly fontMetrics?: Partial<LayoutFonts>;
};

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
  const theme = resolveTheme(base);
  const { fontMetrics, ...rest } = overrides;
  return {
    ...deepMerge<Omit<SvgTheme, 'fontMetrics'>>(theme, rest),
    fontMetrics:
      fontMetrics === undefined
        ? theme.fontMetrics
        : { ...theme.fontMetrics, ...fontMetrics },
  };
}

/**
 * A theme by name, or a theme object. A theme object made before themes
 * had `fontMetrics` gets the default faces, which its fonts were meant to
 * match.
 */
export function resolveTheme(theme: SvgTheme | ThemeName = 'light'): SvgTheme {
  if (typeof theme === 'string') return themes[theme];
  return (theme.fontMetrics as LayoutFonts | undefined) === undefined
    ? { ...theme, fontMetrics: defaultFonts }
    : theme;
}
