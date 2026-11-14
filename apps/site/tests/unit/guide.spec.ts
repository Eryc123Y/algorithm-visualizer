import { runAlgorithm } from '@algomotion/recipes';
import { loadTrace } from '@algomotion/core';
import { kindNames } from '@algomotion/spec';
import { exportFigures } from '@algomotion/svg';
import { describe, expect, it } from 'vitest';

import {
  GUIDE_GROUPS,
  guidePage,
  figureFiles,
  type Guide,
} from '../../src/docs/guide.ts';
import { GUIDES } from '../../src/docs/guides/index.ts';
import { documents } from '../../src/docs/guides/documents.ts';

const assets = { scripts: [], styles: [], preloads: [] };
const art = {
  light: 'a.svg',
  dark: 'b.svg',
  width: 400,
  height: 200,
  alt: 'A figure',
};
const guides: Guide[] = ['', 'inputs', 'web'].map((slug) => ({
  slug,
  title: slug || 'Start',
  nav: slug || 'Start',
  summary: 'Summary',
  body: () => '<h2 id="example">Example</h2>',
}));

describe('guide pages', () => {
  it('marks only the current sidebar link and resolves its pager from any depth', () => {
    document.documentElement.innerHTML = guidePage(
      guides[1]!,
      guides,
      {},
      assets,
    );
    const current = document.querySelectorAll('.side [aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toBe('inputs');
    expect(current[0]!.getAttribute('href')).toBe('../../guide/inputs/');
    expect(
      document.querySelector('.pager [rel="prev"]')!.getAttribute('href'),
    ).toBe('../../guide/');
    expect(
      document.querySelector('.pager [rel="next"]')!.getAttribute('href'),
    ).toBe('../../guide/web/');
    document.documentElement.innerHTML = guidePage(
      guides[0]!,
      guides,
      {},
      assets,
    );
    expect(document.querySelector('[rel="prev"]')).toBeNull();
    expect(document.querySelector('[rel="next"]')!.getAttribute('href')).toBe(
      '../guide/inputs/',
    );
    document.documentElement.innerHTML = guidePage(
      guides[2]!,
      guides,
      {},
      assets,
    );
    expect(document.querySelector('[rel="next"]')).toBeNull();
  });

  it('escapes code and labels, wraps notes and renders declared figures', () => {
    const guide: Guide = {
      ...guides[1]!,
      body: ({ code, note, figure }) =>
        code('<algo-player>&', 'A "label"') +
        note('<p>Note.</p>') +
        figure('known', 'Caption <code>x</code>'),
    };
    document.documentElement.innerHTML = guidePage(
      guide,
      [guide],
      { known: art },
      assets,
    );
    expect(document.querySelector('pre code')!.textContent).toBe(
      '<algo-player>&',
    );
    expect(document.querySelector('pre')!.getAttribute('aria-label')).toBe(
      'A "label"',
    );
    expect(document.querySelector('.note')!.textContent).toBe('Note.');
    expect(
      document.querySelector('.guide-figure img')!.getAttribute('src'),
    ).toBe('../../a.svg');
    expect(document.querySelector('figcaption code')!.textContent).toBe('x');
    expect(figureFiles('', 'test').light).toBe('guide/test-light.svg');
    expect(figureFiles('web', 'test').dark).toBe('guide/web/test-dark.svg');
  });

  it('throws when the figure helper receives an unknown key', () => {
    const guide: Guide = {
      ...guides[1]!,
      body: ({ figure }) => figure('missing', 'Caption'),
    };
    expect(() => guidePage(guide, [guide], {}, assets)).toThrow(
      'guide/inputs: no figure missing',
    );
  });

  it('lists exactly the pages in reading order', () => {
    expect(GUIDES.map((g) => g.slug)).toEqual(
      GUIDE_GROUPS.flatMap((g) => g.slugs),
    );
  });

  it.each(GUIDES)(
    '$title has runnable figures with existing selectors',
    (guide) => {
      for (const f of guide.figures ?? []) {
        const run = runAlgorithm(f.algorithm, f.input);
        expect(run.ok, f.key).toBe(true);
        if (!run.ok) continue;
        const drawn = exportFigures(run.value.document, {
          steps: [f.step],
          theme: f.theme ?? 'light',
        });
        expect(drawn.ok, `${guide.slug}/${f.key}`).toBe(true);
        if (drawn.ok) expect(drawn.value.figures).toHaveLength(1);
      }
    },
  );

  it('validates every document example and covers every structure kind', () => {
    const kinds = new Set<string>();
    let checked = 0;
    documents.body({
      root: '../../',
      figure: () => '',
      note: () => '',
      scene: () => '',
      code: (value, label) => {
        if (value.trimStart().startsWith('{')) {
          const doc = JSON.parse(value) as {
            structures: Record<string, { kind: string }>;
          };
          const trace = loadTrace(doc);
          expect(trace.ok, label).toBe(true);
          Object.values(doc.structures).forEach((s) => kinds.add(s.kind));
          checked++;
        }
        return '';
      },
    });
    expect(checked).toBe(13);
    expect([...kinds].sort()).toEqual([...kindNames].sort());
  });
});
