import { describe, expect, it } from 'vitest';

import { themeNames } from '@algomotion/svg';

import {
  chromeDeclarations,
  chromeStyles,
  chromeThemes,
  resolvePlayerTheme,
} from '../src/chrome.ts';
import { playerStyles } from '../src/styles.ts';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe.each(Object.entries(chromeThemes))('the %s chrome', (_, t) => {
  it('gives its text 4.5:1 on every panel it sits on (WCAG AA)', () => {
    const texts: [string, string][] = [
      ['fg', t.fg],
      ['muted', t.muted],
      ...Object.entries(t.code).map(([k, v]): [string, string] => [
        `code ${k}`,
        v,
      ]),
    ];
    const panels: [string, string][] = [
      ['bg', t.bg],
      ['surface', t.surface],
      ['current line', t.lineBg],
    ];
    const low = texts.flatMap(([what, fg]) =>
      panels
        .filter(([, bg]) => ratio(fg, bg) < 4.5)
        .map(
          ([on, bg]) =>
            `${what} ${fg} on ${on} ${bg}: ${ratio(fg, bg).toFixed(2)}`,
        ),
    );
    if (ratio(t.accentFg, t.accent) < 4.5) low.push('accent text on accent');
    if (ratio(t.error, t.bg) < 4.5) low.push('error on bg');
    expect(low).toEqual([]);
  });

  it('gives the accent 3:1 on the background, for focus rings and the slider', () => {
    expect(ratio(t.accent, t.bg)).toBeGreaterThanOrEqual(3);
  });

  it('declares every custom property and its colour scheme', () => {
    const css = chromeDeclarations(t);
    for (const name of [
      '--algo-bg',
      '--algo-fg',
      '--algo-accent',
      '--algo-line-bg',
      '--algo-font',
      '--algo-mono',
      '--algo-code-keyword',
      '--algo-code-comment',
      '--algo-control-radius',
      '--algo-panel-radius',
    ])
      expect(css).toContain(`${name}: `);
    expect(css).toContain(`color-scheme: ${t.scheme};`);
  });
});

describe('radii (ADR 0031)', () => {
  it('square themes have square controls and panels', () => {
    for (const name of ['answer-sheet', 'turbo-c'] as const) {
      expect(chromeThemes[name].controlRadius).toBe('0px');
      expect(chromeThemes[name].panelRadius).toBe('0px');
    }
    expect(chromeThemes.light.controlRadius).toBe('999px');
  });

  it('every rounded control and panel of the player takes a token', () => {
    const css = playerStyles.cssText;
    // Radii come from tokens, except the display mode's, which has none.
    const literal = [...css.matchAll(/border-radius:\s*([^;]+);/g)]
      .map((m) => m[1]!.trim())
      .filter((v) => !v.startsWith('var(--algo-') && v !== '0');
    expect(literal).toEqual([]);
    expect(css).toContain('var(--algo-control-radius)');
    expect(css).toContain('var(--algo-panel-radius)');
  });
});

describe('chromeStyles', () => {
  it('has a rule for every built-in theme, light on the host', () => {
    const css = chromeStyles().cssText;
    expect(Object.keys(chromeThemes)).toEqual(themeNames);
    expect(css).toMatch(/^:host \{ --algo-bg: #ffffff;/);
    for (const name of themeNames.filter((n) => n !== 'light'))
      expect(css).toContain(`:host([data-resolved-theme='${name}'])`);
  });
});

describe('resolvePlayerTheme', () => {
  it('takes a name, whatever the colour scheme', () => {
    expect(resolvePlayerTheme('blocks', true)).toBe('blocks');
    expect(resolvePlayerTheme(' turbo-c ', false)).toBe('turbo-c');
  });

  it('follows the colour scheme for auto, between light and dark', () => {
    expect(resolvePlayerTheme('auto', false)).toBe('light');
    expect(resolvePlayerTheme('auto', true)).toBe('dark');
  });

  it('follows the colour scheme between the two themes of a pair', () => {
    expect(resolvePlayerTheme('textbook textbook-dark', false)).toBe(
      'textbook',
    );
    expect(resolvePlayerTheme('textbook  textbook-dark', true)).toBe(
      'textbook-dark',
    );
    expect(resolvePlayerTheme('print turbo-c', true)).toBe('turbo-c');
  });

  it('treats an unknown name as auto', () => {
    expect(resolvePlayerTheme('neon', true)).toBe('dark');
    expect(resolvePlayerTheme('', false)).toBe('light');
    expect(resolvePlayerTheme('blocks neon', true)).toBe('dark');
    expect(resolvePlayerTheme('toString', false)).toBe('light');
    expect(resolvePlayerTheme('a b c', false)).toBe('light');
  });
});
