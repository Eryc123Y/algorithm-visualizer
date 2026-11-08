import { afterEach, describe, expect, it } from 'vitest';

import { defaultFontsUrl, linkFonts } from '../src/fonts.ts';

const links = () => [
  ...document.head.querySelectorAll<HTMLLinkElement>(
    'link[data-algoviz-fonts]',
  ),
];

afterEach(() => {
  for (const link of links()) link.remove();
});

describe('the player’s web fonts (ADR 0030)', () => {
  it('lives next to the module, in fonts/', () => {
    expect(defaultFontsUrl()).toMatch(/\/fonts\/fonts\.css$/);
  });

  it('links the stylesheet into the document head once', () => {
    linkFonts('https://example.test/algoviz/fonts/fonts.css');
    linkFonts('https://example.test/algoviz/fonts/fonts.css');
    expect(links()).toHaveLength(1);
    expect(links()[0]!.rel).toBe('stylesheet');
    expect(links()[0]!.href).toBe(
      'https://example.test/algoviz/fonts/fonts.css',
    );
  });

  it('links nothing when loading is turned off', () => {
    linkFonts(null);
    expect(links()).toHaveLength(0);
  });
});

describe('<algo-player> and its fonts', () => {
  it('links the fonts next to its module when it connects', async () => {
    await import('../src/define.ts');
    document.body.append(document.createElement('algo-player'));
    expect(links()).toHaveLength(1);
    expect(links()[0]!.href).toBe(defaultFontsUrl());
    document.body.replaceChildren();
  });

  it('links fontsUrl instead, or nothing for null', async () => {
    const { AlgoPlayer } = await import('../src/define.ts');
    try {
      AlgoPlayer.fontsUrl = null;
      document.body.append(document.createElement('algo-player'));
      expect(links()).toHaveLength(0);
      AlgoPlayer.fontsUrl = 'https://cdn.example.test/fonts.css';
      document.body.append(document.createElement('algo-player'));
      expect(links()[0]!.href).toBe('https://cdn.example.test/fonts.css');
    } finally {
      AlgoPlayer.fontsUrl = undefined;
      document.body.replaceChildren();
    }
  });
});
