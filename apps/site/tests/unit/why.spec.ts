/**
 * The "Why algomotion" page (roadmap 5.4): its figures and walk-throughs
 * run in the registry as written, its comparison is a real table, and
 * it states its limits.
 */
import { algorithms, runAlgorithm } from '@algomotion/recipes';
import { exportFigures } from '@algomotion/svg';
import { describe, expect, it } from 'vitest';

import { page } from '../../src/docs/html.ts';
import { homeWhy } from '../../src/docs/home-why.ts';
import { HOME } from '../../src/docs/text/home.ts';
import {
  COMPARISON,
  WALKTHROUGHS,
  WHY_FIGURES,
  whyPage,
  type WhyFacts,
} from '../../src/docs/why.ts';

const assets = { scripts: [], styles: [], preloads: [] };
const art = Object.fromEntries(
  WHY_FIGURES.map((f) => [
    f.key,
    {
      light: `${f.key}-l.svg`,
      dark: `${f.key}-d.svg`,
      width: 300,
      height: 200,
      alt: f.alt,
    },
  ]),
);
const facts: WhyFacts = {
  steps: [
    { name: 'extract', count: 4 },
    { name: 'improve', count: 4 },
  ],
  checked: '4 + 1 = 5 < 7: C improves to 5, through B.',
  modules: algorithms.length,
};
const scene = (name: string) => ({
  light: `${name}.svg`,
  dark: `${name}.svg`,
  width: 400,
  height: 300,
  alt: `The ${name} scene`,
});
const scenes = {
  notes: scene('notes'),
  beamer: [scene('b1'), scene('b2'), scene('b3')],
  terminal: scene('terminal'),
  chat: scene('chat'),
};
const load = (html: string) => {
  document.documentElement.innerHTML = html;
  return document;
};

describe('the figures and walk-throughs', () => {
  it('draws every figure from a real run and step', () => {
    for (const f of WHY_FIGURES) {
      const run = runAlgorithm(f.algorithm, f.input);
      expect(run.ok, f.key).toBe(true);
      if (!run.ok) continue;
      const figures = exportFigures(run.value.document, {
        steps: [f.step],
        ...(f.layout === undefined ? {} : { layout: f.layout }),
      });
      expect(figures.ok, `${f.key} at ${f.step}`).toBe(true);
    }
  });

  it('writes the runs of each walk-through into its code, and they run', () => {
    expect(WALKTHROUGHS.map((w) => w.id)).toEqual([
      'notes',
      'slides',
      'assistant',
    ]);
    for (const w of WALKTHROUGHS)
      for (const r of w.runs) {
        const code = w.steps.map((s) => s.code ?? '').join('\n');
        expect(code, w.id).toContain(r.algorithm);
        expect(code, w.id).toContain(r.input);
        const run = runAlgorithm(r.algorithm, r.input);
        expect(run.ok, `${w.id}: ${r.algorithm}`).toBe(true);
        if (!run.ok) continue;
        const figures = exportFigures(run.value.document, { steps: r.steps });
        expect(figures.ok, `${w.id}: ${r.steps.join(',')}`).toBe(true);
        if (figures.ok && r.frames !== undefined)
          expect(figures.value.figures).toHaveLength(r.frames);
      }
  });
});

describe('the page', () => {
  const doc = () => load(whyPage(art, facts, assets, scenes));

  it('has one title, the triptych, and a figure for each difference', () => {
    const d = doc();
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('h1')!.textContent).toBe('Why algomotion');
    expect(d.querySelectorAll('.triptych figure')).toHaveLength(3);
    for (const img of d.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('width')).toMatch(/^\d+$/);
    }
  });

  it('compares in a table with headers both ways', () => {
    const table = doc().querySelector('table.compare')!;
    const head = [...table.querySelectorAll('thead th')].map(
      (t) => t.textContent,
    );
    expect(head).toHaveLength(5);
    expect(head.slice(1).join(' ')).toMatch(
      /algomotion.*TikZ.*Manim.*websites/s,
    );
    for (const row of table.querySelectorAll('tbody tr')) {
      expect(row.querySelector('th[scope="row"]')).not.toBeNull();
      expect(row.querySelectorAll('td')).toHaveLength(4);
    }
    expect(COMPARISON.length).toBe(table.querySelectorAll('tbody tr').length);
    // Every tool gets a row saying what it is better at.
    expect(table.textContent).toMatch(/Better at/);
  });

  it('states its limits plainly', () => {
    const limits = doc().querySelector('#limits')!.parentElement!.textContent;
    expect(limits).toMatch(/not on npm/i);
    expect(limits).toMatch(/licence is still to be chosen/i);
    expect(limits).toMatch(/no video/i);
    expect(limits).toContain(String(algorithms.length));
  });

  it('shows the step names of the run and the narration the check returns', () => {
    const d = doc();
    expect(d.querySelector('.names')!.textContent).toContain('improve×4');
    expect(d.body.textContent).toContain(facts.checked);
  });

  it('fails the build on a figure it did not declare', () => {
    expect(() => whyPage({}, facts, assets, scenes)).toThrow(/no figure/);
  });
});

describe('links to it', () => {
  it('from the bar of every page', () => {
    const d = load(
      page({ title: 't', description: 'd', root: '../', assets, body: '' }),
    );
    expect(d.querySelector('.bar a[href="../why/"]')!.textContent).toBe('Why');
  });

  it('from a section of the home page', () => {
    const d = load(`<main>${homeWhy(HOME.en.why)}</main>`);
    expect(d.querySelector('section a[href="why/"]')).not.toBeNull();
    expect(d.querySelectorAll('section li').length).toBeGreaterThanOrEqual(3);
  });
});
