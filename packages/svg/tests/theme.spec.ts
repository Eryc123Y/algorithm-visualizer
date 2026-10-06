import { describe, expect, it } from 'vitest';

import type { Scene } from '@algoviz/core';

import {
  createTheme,
  lightTheme,
  printTheme,
  renderSvg,
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
