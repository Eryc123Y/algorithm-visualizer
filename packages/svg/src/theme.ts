/**
 * Visual themes for the painters (ADR 0009, 0030). Scenes carry semantic
 * roles; a theme turns them into colours, strokes and fonts.
 *
 * Every role is distinguishable without colour: compare has a heavy border,
 * swap a heavy dashed border, highlight a tinted fill, visited a dotted
 * border, and settled a solid fill with a check mark. This keeps figures
 * readable in print, on projectors and for colour-blind learners.
 *
 * The built-in themes are in `themes/`, one file per direction, and are
 * chosen by name in every output: the player, the CLI, MCP, Typst and LaTeX.
 */
import {
  defaultFonts,
  type EdgeRole,
  type ElementRole,
  type LayoutFonts,
} from '@algoviz/core';

import { answerSheetTheme } from './themes/answer-sheet.ts';
import { blocksDarkTheme, blocksTheme } from './themes/blocks.ts';
import { darkTheme, lightTheme, printTheme } from './themes/default.ts';
import { textbookDarkTheme, textbookTheme } from './themes/textbook.ts';
import { turboCTheme } from './themes/turbo-c.ts';

export interface CellStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  /** SVG `stroke-dasharray`, or null for a solid border. */
  readonly dash: string | null;
  readonly text: string;
}

/**
 * The family a LaTeX document sets a role's text in (ADR 0030): its normal
 * font, or its serif, sans-serif or monospaced family.
 */
export type TexFamily = 'normal' | 'rm' | 'sf' | 'tt';

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
   * The faces the painter draws with, at their own weights. Lay scenes out
   * with the same metrics (`LayoutOptions.fonts`), so text fits what layout
   * measured (ADR 0024).
   */
  readonly fontMetrics: LayoutFonts;
  /**
   * The family of the LaTeX document that TikZ figures set each role in,
   * since they use the document's fonts (ADR 0027, 0030).
   */
  readonly tex: { readonly value: TexFamily; readonly label: TexFamily };
  /** Corner radius of cells. */
  readonly radius: number;
  /**
   * Fill behind the whole scene, or null for transparent. Themes with dark
   * paper paint it, so their text stays legible on a white page.
   */
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
  /**
   * Outline drawn behind edge labels so they stay legible over lines: the
   * colour of the paper the theme is drawn on.
   */
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

export {
  answerSheetTheme,
  blocksDarkTheme,
  blocksTheme,
  darkTheme,
  lightTheme,
  printTheme,
  textbookDarkTheme,
  textbookTheme,
  turboCTheme,
};

/** The built-in themes by name (ADR 0030). `light` is the default. */
export const themes = {
  light: lightTheme,
  dark: darkTheme,
  print: printTheme,
  textbook: textbookTheme,
  'textbook-dark': textbookDarkTheme,
  blocks: blocksTheme,
  'blocks-dark': blocksDarkTheme,
  'answer-sheet': answerSheetTheme,
  'turbo-c': turboCTheme,
} as const satisfies Record<string, SvgTheme>;

export type ThemeName = keyof typeof themes;

/** The names of the built-in themes, in the order they are listed. */
export const themeNames = Object.keys(themes) as readonly ThemeName[];

/** Whether `name` is a built-in theme's name. */
export const isThemeName = (name: string): name is ThemeName =>
  Object.hasOwn(themes, name);

/** The families of themes made before themes named them (ADR 0027). */
const DEFAULT_TEX: SvgTheme['tex'] = { value: 'normal', label: 'sf' };

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
 * `createTheme('textbook', { cell: { compare: { stroke: '#c00' } } })`.
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
 * match, and one made before `tex` gets the families of ADR 0027.
 */
export function resolveTheme(theme: SvgTheme | ThemeName = 'light'): SvgTheme {
  if (typeof theme === 'string') return themes[theme];
  const partial = theme as Partial<SvgTheme>;
  if (partial.fontMetrics !== undefined && partial.tex !== undefined)
    return theme;
  return {
    ...theme,
    fontMetrics: partial.fontMetrics ?? defaultFonts,
    tex: partial.tex ?? DEFAULT_TEX,
  };
}
