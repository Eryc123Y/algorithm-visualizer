import { algorithms } from '@algomotion/recipes';
import { describe, expect, it } from 'vitest';

import { catalog } from '../../src/docs/catalog.ts';
import {
  homePage,
  picture,
  type Art,
  type HomeArt,
} from '../../src/docs/home.ts';
import { detailsOf } from '../../src/docs/pages.ts';

const art: Art = {
  light: 'a-light.svg',
  dark: 'a-dark.svg',
  width: 400,
  height: 200,
  alt: 'A < B & "C"',
};
const homeArt: HomeArt = {
  plate: [{ ...art, step: 'improve#3' }],
  outputs: { web: art, typst: art, latex: art, cli: art, mcp: art, link: art },
  slides: [art, art, art],
  themes: [{ name: 'light', art }],
};

describe('picture', () => {
  it('resolves both sources and escapes alternative text', () => {
    document.body.innerHTML = picture(art, '../../');
    const source = document.querySelector('source')!;
    const img = document.querySelector('img')!;
    expect(source.getAttribute('media')).toBe('(prefers-color-scheme: dark)');
    expect(source.getAttribute('srcset')).toBe('../../a-dark.svg');
    expect(img.getAttribute('src')).toBe('../../a-light.svg');
    expect(img.alt).toBe(art.alt);
    expect(img.width).toBe(400);
    expect(img.height).toBe(200);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(picture(art, '', 'eager')).toContain('loading="eager"');
  });
});

describe('the home page', () => {
  const render = async () => {
    const groups = catalog(algorithms);
    const demo = await detailsOf(
      groups.flatMap((g) => g.algorithms).find((e) => e.id === 'dijkstra')!,
      groups,
    );
    return homePage(
      groups,
      demo,
      homeArt,
      '<algo-player algorithm="dijkstra"></algo-player>',
      algorithms.length,
      { scripts: [], styles: [], preloads: [] },
    );
  };

  it('has one selected tab and keeps other panels findable', async () => {
    document.documentElement.innerHTML = await render();
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    expect(tabs).toHaveLength(7);
    expect(panels).toHaveLength(tabs.length);
    expect(
      tabs.filter((t) => t.getAttribute('aria-selected') === 'true'),
    ).toEqual([tabs[0]]);
    tabs.forEach((tab, i) => {
      expect(panels[i]!.getAttribute('aria-labelledby')).toBe(tab.id);
      expect(panels[i]!.getAttribute('hidden')).toBe(
        i === 0 ? null : 'until-found',
      );
      expect(tab.getAttribute('tabindex')).toBe(i === 0 ? null : '-1');
    });
  });

  it('links to the catalogue from the bar, hero and teaser and renders its art', async () => {
    document.documentElement.innerHTML = await render();
    for (const selector of ['.bar', '.hero', '.teaser'])
      expect(
        document.querySelector(`${selector} a[href="algorithms/"]`),
      ).not.toBeNull();
    expect(
      document.querySelector('main algo-player')?.getAttribute('algorithm'),
    ).toBe('dijkstra');
    expect(document.querySelector('.plate picture')).not.toBeNull();
    expect(document.querySelectorAll('.overlays picture')).toHaveLength(3);
    expect(
      document.querySelectorAll('.teaser a[href^="algorithms/#topic-"]').length,
    ).toBeGreaterThan(0);
    expect(document.querySelector('#catalog')).toBeNull();
  });
});
