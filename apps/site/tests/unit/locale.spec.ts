/**
 * The locale mechanism (roadmap 5.7): roots, the parity check the build
 * runs, and the frame's language, alternates and switch.
 */
import { describe, expect, it } from 'vitest';

import { page } from '../../src/docs/html.ts';
import {
  depthOf,
  missingCounterparts,
  PENDING_ZH,
  rootsOf,
  SITE_URL,
} from '../../src/docs/locale.ts';
import { CHROME } from '../../src/docs/text/chrome.ts';
import { CLIENT } from '../../src/docs/text/client.ts';

const assets = { scripts: [], styles: [], preloads: [] };
const load = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html');

describe('roots', () => {
  it('count folders, and lead to the site and to the locale', () => {
    expect(depthOf('')).toBe(0);
    expect(depthOf('guide/web/')).toBe(2);
    expect(depthOf('zh/404.html')).toBe(1);
    expect(rootsOf('en', 'guide/web/')).toEqual({
      site: '../../',
      home: '../../',
    });
    expect(rootsOf('zh', 'guide/web/')).toEqual({
      site: '../../../',
      home: '../../../zh/',
    });
    expect(rootsOf('zh', '')).toEqual({ site: '../', home: '../zh/' });
  });
});

describe('the parity check', () => {
  const pages = ['', 'guide/', 'dijkstra/', 'play/', 'why/', '404.html'];
  const englishOnly = new Set(['dijkstra/', 'play/']);

  it('lists every English page without a Chinese one, except module pages', () => {
    const has = new Set(['', 'guide/', '404.html']);
    expect(
      missingCounterparts(pages, englishOnly, (p) => has.has(p), []),
    ).toEqual(['why/']);
    expect(
      missingCounterparts(pages, englishOnly, (p) => has.has(p), ['why/']),
    ).toEqual([]);
  });

  it('has nothing pending once the site is translated', () => {
    expect(PENDING_ZH).toEqual([]);
  });
});

describe('the frame in each language', () => {
  it('names its language and both versions, and switches to the same page', () => {
    const zh = load(
      page({
        title: 't',
        description: 'd',
        root: '../../../',
        assets,
        body: '',
        locale: 'zh',
        alternate: 'guide/web/',
      }),
    );
    expect(zh.documentElement.getAttribute('lang')).toBe('zh-Hans');
    const alternates = [...zh.querySelectorAll('link[rel="alternate"]')].map(
      (l) => [l.getAttribute('hreflang'), l.getAttribute('href')],
    );
    expect(alternates).toEqual([
      ['en', `${SITE_URL}guide/web/`],
      ['zh-Hans', `${SITE_URL}zh/guide/web/`],
      ['x-default', `${SITE_URL}guide/web/`],
    ]);
    const swap = zh.querySelector('.lang-switch a')!;
    expect(swap.getAttribute('href')).toBe('../../../guide/web/');
    expect(swap.getAttribute('lang')).toBe('en');
    expect(swap.textContent).toBe('English');
    // The bar and footer stay within the Chinese site.
    expect(zh.querySelector('.bar nav a')!.getAttribute('href')).toBe(
      '../../../zh/why/',
    );
    expect(zh.querySelector('.skip')!.textContent).toBe(CHROME.zh.skip);
  });

  it('switches to the other home page from a page only one language has', () => {
    const en = load(
      page({ title: 't', description: 'd', root: '../', assets, body: '' }),
    );
    expect(en.documentElement.getAttribute('lang')).toBe('en');
    expect(en.querySelector('link[rel="alternate"]')).toBeNull();
    expect(en.querySelector('.lang-switch a')!.getAttribute('href')).toBe(
      '../zh/',
    );
  });
});

describe('the script’s words', () => {
  it('write Chinese counts and captions the way Chinese is written', () => {
    expect(CLIENT.zh.filterCount(3, 132)).toBe('共 132 项，显示 3 项。');
    expect(CLIENT.zh.playground.caption('Dijkstra’s algorithm')).toEqual([
      'Dijkstra’s algorithm，输入为 ',
      '。',
    ]);
  });
});
