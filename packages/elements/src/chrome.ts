/**
 * The player's chrome in each built-in theme (ADR 0030): the values of the
 * `--algo-*` custom properties, as one table keyed by theme name, so that
 * a theme without chrome does not compile. `chromeStyles` turns the table
 * into `:host([data-resolved-theme="…"])` rules; a page's own properties on
 * the element still win over them.
 */
import { unsafeCSS, type CSSResult } from 'lit';

import { isThemeName, type ThemeName } from '@algoviz/svg';

/** The custom properties of one theme's chrome. */
export interface ChromeTokens {
  /** `light` or `dark`, for the browser's own controls and scroll bars. */
  readonly scheme: 'light' | 'dark';
  readonly bg: string;
  readonly fg: string;
  readonly muted: string;
  readonly border: string;
  readonly surface: string;
  readonly accent: string;
  readonly accentFg: string;
  /** The current code line: its background and its left edge. */
  readonly lineBg: string;
  readonly lineEdge: string;
  readonly error: string;
  readonly radius: string;
  /** Running text, and code and counters. */
  readonly font: string;
  readonly mono: string;
  readonly code: {
    readonly keyword: string;
    readonly builtin: string;
    readonly function: string;
    readonly string: string;
    readonly number: string;
    readonly comment: string;
  };
}

const INTER =
  "'Inter', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
const JETBRAINS =
  "'JetBrains Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace";
const STIX =
  "'STIX Two Text', 'Times New Roman', Times, 'Songti SC', 'Noto Serif SC', SimSun, serif";
const NOTO_MONO =
  "'Noto Sans Mono', 'DejaVu Sans Mono', ui-monospace, Menlo, Consolas, monospace";
const LEXEND =
  "'Lexend', 'Avenir Next', 'Segoe UI', system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const DM_MONO =
  "'DM Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace";
const NOTO_SANS =
  "'Noto Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif";
const PIXEL =
  "'DotGothic16', 'Courier New', ui-monospace, Menlo, 'PingFang SC', 'Microsoft YaHei', monospace";

const light: ChromeTokens = {
  scheme: 'light',
  bg: '#ffffff',
  fg: '#1f2a26',
  muted: '#66736d',
  border: '#dfe5e2',
  surface: '#f5f7f6',
  accent: '#0f7b6c',
  accentFg: '#ffffff',
  lineBg: '#fff4dc',
  lineEdge: '#d08a18',
  error: '#b42318',
  radius: '14px',
  font: INTER,
  mono: JETBRAINS,
  code: {
    keyword: '#8a2f6b',
    builtin: '#0b6b5e',
    function: '#1f56a8',
    string: '#9a4a10',
    number: '#8a5a00',
    comment: '#5f6e68',
  },
};

const dark: ChromeTokens = {
  ...light,
  scheme: 'dark',
  bg: '#151b19',
  fg: '#e4ebe8',
  muted: '#95a39d',
  border: '#2b3633',
  surface: '#1c2422',
  accent: '#4fc4b0',
  accentFg: '#0d1a17',
  lineBg: '#3b2c12',
  lineEdge: '#e9a53a',
  error: '#ff8a7a',
  code: {
    keyword: '#e7a0d4',
    builtin: '#5fd0bd',
    function: '#93b9ff',
    string: '#f2a874',
    number: '#e9c86f',
    comment: '#97a59f',
  },
};

/** Greyscale: only keywords (bold) and comments (italic) stand out. */
const print: ChromeTokens = {
  ...light,
  code: {
    keyword: light.fg,
    builtin: light.fg,
    function: light.fg,
    string: light.fg,
    number: light.fg,
    comment: light.muted,
  },
};

/** Ink for keywords, the pens for names and literals, pencil for comments. */
const textbook: ChromeTokens = {
  scheme: 'light',
  bg: '#ffffff',
  fg: '#000000',
  muted: '#5c5c5c',
  border: '#cfcfcf',
  surface: '#f5f5f3',
  accent: '#1f4fb4',
  accentFg: '#ffffff',
  lineBg: '#fff2a8',
  lineEdge: '#e0b500',
  error: '#b3261e',
  radius: '2px',
  font: STIX,
  mono: NOTO_MONO,
  code: {
    keyword: '#000000',
    builtin: '#6a3fa0',
    function: '#1f4fb4',
    string: '#b3261e',
    number: '#8a5a00',
    comment: '#5c5c5c',
  },
};

const textbookDark: ChromeTokens = {
  scheme: 'dark',
  bg: '#1b1b1a',
  fg: '#ecebe6',
  muted: '#a3a29b',
  border: '#3a3a37',
  surface: '#242422',
  accent: '#93b2ff',
  accentFg: '#0b1a3d',
  lineBg: '#3d3613',
  lineEdge: '#f2d23c',
  error: '#ff8577',
  radius: '2px',
  font: STIX,
  mono: NOTO_MONO,
  code: {
    keyword: '#f6f5f0',
    builtin: '#c8b0f4',
    function: '#93b2ff',
    string: '#ff8577',
    number: '#e8cb52',
    comment: '#a3a29b',
  },
};

/** The rod colours, darkened until they read on the pale code panel. */
const blocks: ChromeTokens = {
  scheme: 'light',
  bg: '#ffffff',
  fg: '#1e2a4a',
  muted: '#5a6480',
  border: '#1e2a4a',
  surface: '#f4f6fb',
  accent: '#2f6fde',
  accentFg: '#ffffff',
  lineBg: '#fff1b8',
  lineEdge: '#ffd23f',
  error: '#c0291e',
  radius: '18px',
  font: LEXEND,
  mono: DM_MONO,
  code: {
    keyword: '#1e2a4a',
    builtin: '#7340b0',
    function: '#1f5fd0',
    string: '#c0291e',
    number: '#13733a',
    comment: '#5a6480',
  },
};

const blocksDark: ChromeTokens = {
  scheme: 'dark',
  bg: '#1b2342',
  fg: '#eef1fb',
  muted: '#a3add0',
  border: '#56628f',
  surface: '#232c50',
  accent: '#5b8ff2',
  accentFg: '#0c1124',
  lineBg: '#463c14',
  lineEdge: '#ffd23f',
  error: '#ff9b8f',
  radius: '18px',
  font: LEXEND,
  mono: DM_MONO,
  code: {
    keyword: '#ffffff',
    builtin: '#c9a8f5',
    function: '#8fb6ff',
    string: '#ff9b8f',
    number: '#7fdc9f',
    comment: '#a3add0',
  },
};

/** Pencil and pen for what the student writes, red for the printed form. */
const answerSheet: ChromeTokens = {
  scheme: 'light',
  bg: '#ffffff',
  fg: '#141414',
  muted: '#6b5f61',
  border: '#f0a9b4',
  surface: '#fdf4f5',
  accent: '#d7263d',
  accentFg: '#ffffff',
  lineBg: '#e9e9ea',
  lineEdge: '#2b2b2e',
  error: '#b0182f',
  radius: '0px',
  font: NOTO_SANS,
  mono: NOTO_MONO,
  code: {
    keyword: '#141414',
    builtin: '#b0182f',
    function: '#1d4e89',
    string: '#4d4d50',
    number: '#b0182f',
    comment: '#5f5f62',
  },
};

/** Like Borland's editor: reserved words white, identifiers yellow. */
const turboC: ChromeTokens = {
  scheme: 'dark',
  bg: '#0000aa',
  fg: '#ffff55',
  muted: '#aaaaaa',
  border: '#aaaaaa',
  surface: '#000000',
  accent: '#00aa00',
  accentFg: '#000000',
  lineBg: '#0000aa',
  lineEdge: '#ffff55',
  // CGA light red is 4.2:1 on blue; light magenta is the CGA red that reads.
  error: '#ff55ff',
  radius: '0px',
  font: PIXEL,
  mono: PIXEL,
  code: {
    keyword: '#ffffff',
    builtin: '#55ffff',
    function: '#55ff55',
    string: '#ff55ff',
    number: '#ff55ff',
    comment: '#aaaaaa',
  },
};

/** The chrome of every built-in theme. */
export const chromeThemes: Readonly<Record<ThemeName, ChromeTokens>> = {
  light,
  dark,
  print,
  textbook,
  'textbook-dark': textbookDark,
  blocks,
  'blocks-dark': blocksDark,
  'answer-sheet': answerSheet,
  'turbo-c': turboC,
};

/** The declarations of one theme's chrome. */
export function chromeDeclarations(t: ChromeTokens): string {
  const properties: [string, string][] = [
    ['--algo-bg', t.bg],
    ['--algo-fg', t.fg],
    ['--algo-muted', t.muted],
    ['--algo-border', t.border],
    ['--algo-surface', t.surface],
    ['--algo-accent', t.accent],
    ['--algo-accent-fg', t.accentFg],
    ['--algo-line-bg', t.lineBg],
    ['--algo-line-edge', t.lineEdge],
    ['--algo-error', t.error],
    ['--algo-radius', t.radius],
    ['--algo-font', t.font],
    ['--algo-mono', t.mono],
    ...Object.entries(t.code).map(([token, colour]): [string, string] => [
      `--algo-code-${token}`,
      colour,
    ]),
  ];
  return [
    ...properties.map(([name, value]) => `${name}: ${value};`),
    `color-scheme: ${t.scheme};`,
  ].join(' ');
}

/**
 * The chrome rules: the light theme's on the host, as the default, and each
 * other theme's when the player resolves to it.
 */
export function chromeStyles(): CSSResult {
  const rules = Object.entries(chromeThemes).map(([name, tokens]) =>
    name === 'light'
      ? `:host { ${chromeDeclarations(tokens)} }`
      : `:host([data-resolved-theme='${name}']) { ${chromeDeclarations(tokens)} }`,
  );
  return unsafeCSS(rules.join('\n'));
}

/**
 * The built-in theme a `theme` attribute names (ADR 0030): a theme's name;
 * `auto`, light or dark by the reader's colour scheme; or a pair such as
 * `textbook textbook-dark`, the first for a light scheme and the second
 * for a dark one. Anything else counts as `auto`.
 */
export function resolvePlayerTheme(value: string, dark: boolean): ThemeName {
  const words = value.trim().split(/\s+/);
  const [day, night] =
    words.length === 2 && words.every(isThemeName)
      ? (words as [ThemeName, ThemeName])
      : words.length === 1 && isThemeName(words[0]!)
        ? [words[0], words[0]]
        : (['light', 'dark'] as const);
  return dark ? night : day;
}
