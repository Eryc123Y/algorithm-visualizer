import { describe, expect, it } from 'vitest';

import { defaultFonts, type Scene } from '@algoviz/core';
import { uniformFont } from '@algoviz/fonts';

import {
  createTheme,
  lightTheme,
  resolveTheme,
  type SvgTheme,
  printTheme,
  renderSvg,
  themes,
} from '../src/index.ts';

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
    expect(renderSvg(cell('settled'))).toContain('<path');
    expect(renderSvg(cell('default'))).not.toContain('<path');
    const hidden = createTheme('light', { settledMark: null });
    expect(renderSvg(cell('settled'), { theme: hidden })).not.toContain(
      '<path',
    );
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

describe('contrast', () => {
  /** WCAG relative luminance of a #rrggbb colour. */
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };
  // Scenes are transparent; the player draws them on its own background.
  const page = { light: '#ffffff', dark: '#151b19', print: '#ffffff' };

  it.each(Object.entries(themes))(
    'gives all %s text at least 4.5:1 against what it sits on (WCAG AA)',
    (name, t) => {
      const bg = t.background ?? page[name as keyof typeof page];
      const pairs: [string, string, string][] = [
        ['title', t.title, bg],
        ['index', t.index, bg],
        ['pointer', t.pointer.text, t.pointer.fill],
        ...Object.entries(t.cell).map(([role, s]): [string, string, string] => [
          `cell ${role}`,
          s.text,
          s.fill,
        ]),
        ...t.groups.map((g, k): [string, string, string] => [
          `group ${k}`,
          g.text,
          g.fill,
        ]),
        ['red node', t.rb.red.text, t.rb.red.fill],
        ['black node', t.rb.black.text, t.rb.black.fill],
      ];
      const low = pairs
        .filter(([, fg, back]) => ratio(fg, back) < 4.5)
        .map(
          ([what, fg, back]) =>
            `${what}: ${fg} on ${back} is ${ratio(fg, back).toFixed(2)}:1`,
        );
      expect(low).toEqual([]);
    },
  );
});
