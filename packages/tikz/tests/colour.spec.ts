import { describe, expect, it } from 'vitest';

import {
  darkTheme,
  lightTheme,
  printTheme,
  type SvgTheme,
} from '@algomotion/svg';

import { parseColour } from '../src/index.ts';

describe('parseColour', () => {
  it('reads hexadecimal colours of 3, 4, 6 and 8 digits', () => {
    expect(parseColour('#0f7b6c')).toEqual({ hex: '0F7B6C', opacity: 1 });
    expect(parseColour('#abc')).toEqual({ hex: 'AABBCC', opacity: 1 });
    expect(parseColour('#abc8')).toEqual({
      hex: 'AABBCC',
      opacity: 0x88 / 255,
    });
    expect(parseColour('#0F7B6C80')).toEqual({
      hex: '0F7B6C',
      opacity: 0x80 / 255,
    });
  });

  it('reads rgb() and rgba() with commas or spaces, numbers or percentages', () => {
    expect(parseColour('rgba(20, 45, 38, 0.10)')).toEqual({
      hex: '142D26',
      opacity: 0.1,
    });
    expect(parseColour('rgb(255 0 128)')).toEqual({
      hex: 'FF0080',
      opacity: 1,
    });
    expect(parseColour('rgb(0 0 0 / 50%)')).toEqual({
      hex: '000000',
      opacity: 0.5,
    });
    expect(parseColour('rgb(100%, 0%, 50%)')).toEqual({
      hex: 'FF0080',
      opacity: 1,
    });
    expect(parseColour('RGBA(300, -5, 0, 2)')).toEqual({
      hex: 'FF0000',
      opacity: 1,
    });
  });

  it('reads hsl() and hsla()', () => {
    expect(parseColour('hsl(0, 100%, 50%)')).toEqual({
      hex: 'FF0000',
      opacity: 1,
    });
    expect(parseColour('hsl(120deg 100% 25%)')).toEqual({
      hex: '008000',
      opacity: 1,
    });
    expect(parseColour('hsla(240, 100%, 50%, 0.25)')).toEqual({
      hex: '0000FF',
      opacity: 0.25,
    });
    expect(parseColour('hsl(0.5turn 0% 100% / 40%)')).toEqual({
      hex: 'FFFFFF',
      opacity: 0.4,
    });
  });

  it('reads CSS colour names and transparent', () => {
    expect(parseColour('teal')).toEqual({ hex: '008080', opacity: 1 });
    expect(parseColour(' RebeccaPurple ')).toEqual({
      hex: '663399',
      opacity: 1,
    });
    expect(parseColour('transparent')).toEqual({ hex: '000000', opacity: 0 });
  });

  it('rejects other text, which is a mistake in a theme', () => {
    for (const text of [
      'tealish',
      'rgba(1, 2)',
      '#12345',
      'hsl(x, 1%, 2%)',
      'url(#a)',
      '',
    ])
      expect(() => parseColour(text), text).toThrow(/Cannot read the colour/);
  });

  it('reads every colour of the built-in themes', () => {
    const colours = (value: unknown): string[] =>
      typeof value === 'string'
        ? /^(#|rgb)/.test(value)
          ? [value]
          : []
        : typeof value === 'object' && value !== null
          ? Object.values(value).flatMap(colours)
          : [];
    for (const theme of [lightTheme, darkTheme, printTheme] as SvgTheme[]) {
      // Fonts are named in CSS, not coloured.
      const painted = Object.entries(theme).filter(
        ([key]) => key !== 'fonts' && key !== 'fontMetrics',
      );
      for (const colour of colours(Object.fromEntries(painted)))
        expect(() => parseColour(colour)).not.toThrow();
    }
  });
});
