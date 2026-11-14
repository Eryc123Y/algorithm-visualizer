/**
 * Figures in a fixed theme are shown on that theme's own paper, as a
 * sheet, in both colour schemes; light and dark pairs follow the page.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { themeNames, themes } from '@algomotion/svg';
import { describe, expect, it } from 'vitest';

import { picture, sheet } from '../../src/docs/home.ts';

const css = readFileSync(
  join(import.meta.dirname, '../../src/docs/docs.css'),
  'utf8',
);
const art = {
  light: 'a-light.svg',
  dark: 'a-dark.svg',
  width: 300,
  height: 200,
  alt: 'A figure',
};

describe('figure sheets', () => {
  it('give every theme its own paper, or white where it paints none', () => {
    for (const name of themeNames) {
      const paper = themes[name].background ?? '#ffffff';
      expect(css, name).toMatch(
        new RegExp(`\\.sheet-${name}\\s*\\{\\s*--sheet-paper:\\s*${paper};`),
      );
    }
  });

  it('wrap a figure drawn in a fixed theme', () => {
    document.body.innerHTML = picture({ ...art, theme: 'print' }, '');
    const wrapper = document.querySelector('.sheet.sheet-print')!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelector('img')!.getAttribute('alt')).toBe('A figure');
  });

  it('leave light and dark pairs to follow the page', () => {
    document.body.innerHTML = picture(art, '');
    expect(document.querySelector('.sheet')).toBeNull();
    expect(document.querySelector('source')).not.toBeNull();
  });

  it('wrap any markup, for images not drawn by picture()', () => {
    expect(sheet('turbo-c', '<img alt="x">')).toBe(
      '<span class="sheet sheet-turbo-c"><img alt="x"></span>',
    );
    expect(sheet(undefined, '<img alt="x">')).toBe('<img alt="x">');
  });
});
