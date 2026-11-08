import { describe, expect, it } from 'vitest';

import { defaultFonts, type Scene } from '@algoviz/core';
import { uniformFont } from '@algoviz/fonts';

import { readFileSync } from 'node:fs';

import {
  bundledOutlines,
  createTheme,
  isThemeName,
  lightTheme,
  resolveTheme,
  type SvgTheme,
  printTheme,
  renderSvg,
  themeNames,
  themes,
} from '../src/index.ts';

const OFL = readFileSync(
  new URL('../../fonts/OFL.txt', import.meta.url),
  'utf8',
);

const cell = (role: 'compare' | 'swap' | 'settled' | 'default'): Scene => ({
  width: 100,
  height: 100,
  title: 't',
  items: [
    {
      type: 'box',
      key: 'k',
      x: 0,
      y: 0,
      width: 52,
      height: 52,
      role,
      text: '1',
      fontSize: 20,
    },
  ],
});

describe('createTheme', () => {
  it('overrides only the given leaves and keeps the base intact', () => {
    const theme = createTheme('light', {
      radius: 14,
      cell: { compare: { stroke: '#e11d48' } },
    });
    expect(theme.radius).toBe(14);
    expect(theme.cell.compare.stroke).toBe('#e11d48');
    expect(theme.cell.compare.fill).toBe(lightTheme.cell.compare.fill);
    expect(theme.cell.swap).toEqual(lightTheme.cell.swap);
    expect(lightTheme.radius).toBe(8);
  });

  it('replaces the face of a role whole and keeps the other', () => {
    const wide = uniformFont(1);
    const theme = createTheme('light', { fontMetrics: { value: wide } });
    expect(theme.fontMetrics.value).toBe(wide);
    expect(theme.fontMetrics.label).toBe(defaultFonts.label);
    expect(lightTheme.fontMetrics).toBe(defaultFonts);
    // Without a font override, the theme keeps the base's pair.
    expect(createTheme('dark', { radius: 2 }).fontMetrics).toBe(defaultFonts);
  });

  it('gives a theme object without font metrics the default faces', () => {
    const old = Object.fromEntries(
      Object.entries(lightTheme).filter(([key]) => key !== 'fontMetrics'),
    );
    const theme = resolveTheme(old as unknown as SvgTheme);
    expect(theme.fontMetrics).toBe(defaultFonts);
    expect(resolveTheme(lightTheme)).toBe(lightTheme);
  });

  it('lets null replace a value, e.g. to remove shadows', () => {
    expect(createTheme(lightTheme, { shadow: null }).shadow).toBeNull();
  });
});

describe('role cues that do not rely on colour', () => {
  it('dashes the border of swapped cells', () => {
    expect(renderSvg(cell('swap'))).toContain('stroke-dasharray');
    expect(renderSvg(cell('compare'))).not.toContain('stroke-dasharray');
  });

  it('draws a check mark on settled cells unless the theme hides it', () => {
    // Text stays text here, so the only path is the check mark.
    const asText = { outlineText: false };
    expect(renderSvg(cell('settled'), asText)).toContain('<path');
    expect(renderSvg(cell('default'), asText)).not.toContain('<path');
    const hidden = createTheme('light', { settledMark: null });
    expect(
      renderSvg(cell('settled'), { ...asText, theme: hidden }),
    ).not.toContain('<path');
  });

  it('keeps every role distinct in the greyscale print theme', () => {
    const cues = (
      ['compare', 'swap', 'highlight', 'settled', 'default'] as const
    ).map((r) => {
      const c = printTheme.cell[r];
      return `${c.fill}|${c.strokeWidth}|${c.dash}`;
    });
    expect(new Set(cues).size).toBe(cues.length);
  });

  it('accepts theme names', () => {
    expect(renderSvg(cell('default'), { theme: 'print' })).not.toContain(
      'rgba',
    );
    expect(renderSvg(cell('default'), { theme: 'light' })).toContain('rgba');
  });
});

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two #rrggbb colours. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * The paper a theme is drawn on: its background, or for a transparent
 * theme the colour its label halos assume (ADR 0030).
 */
const paper = (t: SvgTheme) => t.background ?? t.labelHalo;

type Pair = readonly [what: string, fg: string, bg: string];

/** Pairs below `min`, described. */
const below = (pairs: readonly Pair[], min: number) =>
  pairs
    .filter(([, fg, bg]) => ratio(fg, bg) < min)
    .map(
      ([what, fg, bg]) =>
        `${what}: ${fg} on ${bg} is ${ratio(fg, bg).toFixed(2)}:1`,
    );

describe.each(Object.entries(themes))('the %s theme', (name, t) => {
  it('gives all text at least 4.5:1 against what it sits on (WCAG AA)', () => {
    const pairs: Pair[] = [
      ['title', t.title, paper(t)],
      ['index', t.index, paper(t)],
      ['edge label', t.title, t.labelHalo],
      ['node note', t.index, t.labelHalo],
      ['pointer', t.pointer.text, t.pointer.fill],
      ...Object.entries(t.cell).map(([role, s]): Pair => [
        `cell ${role}`,
        s.text,
        s.fill,
      ]),
      ...t.groups.map((g, k): Pair => [`group ${k}`, g.text, g.fill]),
      ['red node', t.rb.red.text, t.rb.red.fill],
      ['black node', t.rb.black.text, t.rb.black.fill],
    ];
    expect(below(pairs, 4.5)).toEqual([]);
  });

  it('gives the check mark and pointers 3:1 (non-text contrast)', () => {
    const pairs: Pair[] = [
      ['pointer line', t.pointer.line, paper(t)],
      ['pointer badge', t.pointer.fill, paper(t)],
    ];
    if (t.settledMark !== null)
      pairs.push(['check mark', t.settledMark, t.cell.settled.fill]);
    expect(below(pairs, 3)).toEqual([]);
  });

  it('paints its paper unless the paper is light', () => {
    if (t.background === null)
      expect(luminance(t.labelHalo)).toBeGreaterThan(0.8);
    else expect(t.labelHalo).toBe(t.background);
  });

  it('never relies on colour alone (ADR 0009)', () => {
    const { cell, edge } = t;
    expect(cell.compare.strokeWidth).toBeGreaterThan(cell.default.strokeWidth);
    expect(cell.swap.strokeWidth).toBeGreaterThan(cell.default.strokeWidth);
    expect(cell.swap.dash).not.toBeNull();
    expect(cell.visited.dash).not.toBeNull();
    expect(cell.default.dash).toBeNull();
    expect(cell.compare.dash).toBeNull();
    expect(t.settledMark).not.toBeNull();
    // Highlight shows by lightness or by its border.
    const lighter = ratio(cell.highlight.fill, cell.default.fill) >= 1.15;
    const heavier = cell.highlight.strokeWidth > cell.default.strokeWidth;
    expect(lighter || heavier).toBe(true);
    expect(edge.highlight.width).toBeGreaterThan(edge.default.width);
    expect(edge.selected.width).toBeGreaterThan(edge.default.width);
    expect(edge.rejected.width).toBeLessThanOrEqual(edge.default.width);
  });

  it('draws with bundled faces whose families its CSS lists name first', () => {
    const ids = new Set(bundledOutlines.map((o) => o.id));
    for (const role of ['value', 'label'] as const) {
      const face = t.fontMetrics[role];
      expect(ids.has(face.id)).toBe(true);
      expect(t.fonts[role].startsWith(`'${face.family}'`)).toBe(true);
      expect(OFL).toContain(`${face.family} `);
    }
  });

  it('names a TeX family for each role', () => {
    for (const family of [t.tex.value, t.tex.label])
      expect(['normal', 'rm', 'sf', 'tt']).toContain(family);
    expect(name).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('the registry', () => {
  it('lists every theme once, light first', () => {
    expect(themeNames[0]).toBe('light');
    expect(themeNames).toEqual(Object.keys(themes));
    expect(themeNames.every(isThemeName)).toBe(true);
    expect(isThemeName('neon')).toBe(false);
    expect(isThemeName('toString')).toBe(false);
  });

  it('keeps the TeX families of ADR 0027 for the default themes', () => {
    for (const t of [themes.light, themes.dark, themes.print])
      expect(t.tex).toEqual({ value: 'normal', label: 'sf' });
  });

  it('draws text at the weight of the theme’s face', () => {
    const svg = renderSvg(cell('compare'), {
      theme: 'turbo-c',
      outlineText: false,
    });
    expect(svg).toContain('font-weight="400"');
    expect(svg).not.toContain('font-weight="600"');
    expect(renderSvg(cell('compare'), { outlineText: false })).toContain(
      'font-weight="600"',
    );
  });
});
