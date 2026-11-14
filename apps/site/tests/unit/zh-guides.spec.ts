/**
 * The Chinese guide (roadmap 5.7) against the English one, page by page,
 * so the two cannot drift: the same slugs, figures and runs, section ids,
 * code blocks (code is never translated), scenes and link targets. Only
 * the words around them change.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Guide, GuideContext } from '../../src/docs/guide.ts';
import { GUIDES } from '../../src/docs/guides/index.ts';
import { PENDING_ZH } from '../../src/docs/locale.ts';

/** The English guide files, by slug. */
const FILES: Readonly<Record<string, string>> = {
  '': 'start',
  inputs: 'inputs',
  web: 'web',
  typst: 'typst',
  latex: 'latex',
  slides: 'slides',
  cli: 'cli',
  ai: 'ai',
  'share-links': 'share-links',
  documents: 'documents',
};

const ZH = join(import.meta.dirname, '../../src/docs/guides/zh');
const pathOf = (slug: string) => `guide/${slug === '' ? '' : `${slug}/`}`;

/** What a page's body uses, rendered with marked roots. */
function inventory(guide: Guide) {
  const codes: string[] = [];
  const figures: string[] = [];
  const scenes: string[] = [];
  const context: GuideContext = {
    root: '@ROOT/',
    site: '@SITE/',
    code: (code) => {
      codes.push(code);
      return '<pre></pre>';
    },
    figure: (key) => {
      figures.push(key);
      return '<figure></figure>';
    },
    scene: (name) => {
      scenes.push(name);
      return '<figure></figure>';
    },
    note: (html) => `<aside>${html}</aside>`,
  };
  const html = guide.body(context);
  const ids = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
  const links = [
    ...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])),
  ].sort();
  return { codes, figures, scenes, ids, links, html };
}

const CJK = /[\u{4e00}-\u{9fff}]/u;

describe('the Chinese guide', () => {
  for (const en of GUIDES) {
    const file = FILES[en.slug]!;
    const exists = existsSync(join(ZH, `${file}.ts`));
    it(`${pathOf(en.slug)} has a Chinese page, or is still pending`, () => {
      expect(exists || PENDING_ZH.includes(pathOf(en.slug))).toBe(true);
    });
    if (!exists) continue;

    it(`${pathOf(en.slug)} matches the English page`, async () => {
      const zh = ((await import(join(ZH, `${file}.ts`))) as { zh: Guide }).zh;
      expect(zh.slug).toBe(en.slug);
      for (const words of [zh.title, zh.nav, zh.summary])
        expect(words, 'title, nav and summary are Chinese').toMatch(CJK);
      // The same figures, drawn from the same runs; only the alt changes.
      const run = (g: Guide) =>
        (g.figures ?? []).map((f) => ({ ...f, alt: '' }));
      expect(run(zh)).toEqual(run(en));
      for (const f of zh.figures ?? []) expect(f.alt).toMatch(CJK);
      const a = inventory(en);
      const b = inventory(zh);
      expect(b.codes, 'code blocks, word for word').toEqual(a.codes);
      expect(b.figures).toEqual(a.figures);
      expect(b.scenes).toEqual(a.scenes);
      expect(b.ids, 'section ids, so links into the page work').toEqual(a.ids);
      expect(b.links, 'link targets').toEqual(a.links);
      expect(b.html).toMatch(CJK);
    });
  }
});
