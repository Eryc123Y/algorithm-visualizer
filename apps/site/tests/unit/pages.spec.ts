/**
 * The generated pages (roadmap 3.4): the home page with the catalogue, a
 * page per module with its player, steps and snippets, and the themes.
 */
import { algorithms } from '@algomotion/recipes';
import { themeNames } from '@algomotion/svg';
import { describe, expect, it } from 'vitest';

import { catalog, type Entry } from '../../src/docs/catalog.ts';
import { attribute, page, text } from '../../src/docs/html.ts';
import {
  detailsOf,
  entryPage,
  exampleStep,
  homePage,
  notFoundPage,
  stepsOf,
  themesPage,
} from '../../src/docs/pages.ts';

const groups = catalog(algorithms);
const assets = {
  scripts: ['assets/docs.js'],
  styles: ['assets/docs.css'],
  preloads: ['assets/chunk.js'],
};
const entry = (id: string): Entry =>
  groups
    .flatMap((g) => [
      ...g.algorithms,
      ...g.structures.flatMap((s) => [s.entry, ...s.operations]),
    ])
    .find((e) => e.id === id)!;

describe('the frame', () => {
  it('links its assets from the root, and escapes the title', () => {
    const html = page({
      title: 'A <b> & "c"',
      description: 'd',
      root: '../../',
      assets,
      body: '<p>x</p>',
    });
    expect(html).toContain('<title>A &lt;b&gt; &amp; "c"</title>');
    expect(html).toContain('<script type="module" src="../../assets/docs.js">');
    expect(html).toContain(
      '<link rel="stylesheet" href="../../assets/docs.css" />',
    );
    expect(html).toContain(
      '<link rel="modulepreload" href="../../assets/chunk.js" />',
    );
    expect(html).toContain('<a href="../../themes/">Themes</a>');
    expect(html.indexOf('<meta charset="utf-8" />')).toBeLessThan(
      html.indexOf('<title>'),
    );
  });

  it('escapes what content and attributes read', () => {
    expect(text(`<a href='x'>"&"</a>`)).toBe(
      `&lt;a href='x'&gt;"&amp;"&lt;/a&gt;`,
    );
    expect(attribute(`<a href='x'>"&"</a>`)).toBe(
      '&lt;a href=&#39;x&#39;&gt;&quot;&amp;&quot;&lt;/a&gt;',
    );
  });
});

describe('stepsOf', () => {
  it('counts each step name, in the order they first come', () => {
    expect(
      stepsOf({
        steps: [
          { meta: { id: 'compare' } },
          { meta: { id: 'swap' } },
          { meta: {} },
          { meta: { id: 'compare' } },
          {},
        ],
      }),
    ).toEqual([
      { name: 'compare', count: 2 },
      { name: 'swap', count: 1 },
    ]);
    expect(stepsOf(null)).toEqual([]);
  });
});

describe('exampleStep', () => {
  it('names the second of a repeated step, else the last step', () => {
    expect(
      exampleStep([
        { name: 'start', count: 1 },
        { name: 'relax', count: 4 },
      ]),
    ).toBe('relax#2');
    expect(exampleStep([{ name: 'done', count: 1 }])).toBe('done');
    expect(exampleStep([])).toBe('-1');
  });
});

describe('a module’s page', () => {
  it('plays the first example and names its steps', async () => {
    const details = await detailsOf(entry('dijkstra'), groups);
    const html = entryPage(details, assets);
    expect(html).toContain('<h1>Dijkstra’s algorithm</h1>');
    expect(html).toMatch(/<algo-player algorithm="dijkstra" input="[^"]+">/);
    expect(details.steps.map((s) => s.name)).toContain('improve');
    expect(html).toContain('<code>improve</code>');
    expect(html).toContain(
      '<code>extract#2</code> is the second <code>extract</code> step',
    );
    expect(html).toContain('[step=extract#2]');
    for (const s of details.snippets) expect(html).toContain(text(s.label));
    expect(html).toContain('href="../#topic-graphs"');
    expect(html).toContain('href="../play/#v=1&amp;alg=dijkstra');
  });

  it('lists a structure’s operations, and an operation names its structure', async () => {
    const bst = entryPage(await detailsOf(entry('bst'), groups), assets);
    for (const op of ['search', 'insert', 'delete'])
      expect(bst).toContain(`href="../bst/${op}/"`);
    const del = entryPage(await detailsOf(entry('bst.delete'), groups), assets);
    expect(del).toContain('<a href="../../bst/">Binary search tree</a>');
    expect(del).toContain('<h1>Binary search tree: delete</h1>');
  });

  it('links the other examples to the share page', async () => {
    const details = await detailsOf(entry('bst.delete'), groups);
    expect(details.examples.length).toBe(
      algorithms.find((a) => a.id === 'bst.delete')!.examples.length - 1,
    );
    for (const e of details.examples)
      expect(e.link).toMatch(/^\.\.\/\.\.\/play\/#v=1&alg=bst\.delete&in=/);
  });

  it('builds for every module of the registry', async () => {
    for (const g of groups)
      for (const e of [
        ...g.algorithms,
        ...g.structures.flatMap((s) => [s.entry, ...s.operations]),
      ]) {
        const html = entryPage(await detailsOf(e, groups), assets);
        expect(html, e.id).toContain(`algorithm="${e.id}"`);
      }
  });
});

describe('the home page', () => {
  it('lists every module under its topic, and operations under their structure', async () => {
    const html = homePage(
      groups,
      await detailsOf(entry('dijkstra'), groups, 0),
      assets,
    );
    for (const a of algorithms)
      expect(html, a.id).toContain(`href="${a.id.split('.').join('/')}/"`);
    for (const g of groups) expect(html).toContain(`id="topic-${g.topic}"`);
    expect(html).toContain('<algo-player algorithm="dijkstra"');
    // A structure is found by its operations' names.
    expect(html).toMatch(/data-search="fibonacci-heap [^"]*extract-min/);
    expect(html).toContain('href="play/#v=1&amp;alg=dijkstra');
  });
});

describe('the themes page', () => {
  it('shows every theme and how each output picks one', () => {
    const html = themesPage(
      themeNames.map((name) => ({
        name,
        file: `${name}.svg`,
        width: 400,
        height: 200,
      })),
      assets,
    );
    for (const name of themeNames) {
      expect(html).toContain(`<code>${name}</code>`);
      expect(html).toContain(`src="${name}.svg"`);
    }
    for (const how of [
      'theme="textbook"',
      'theme: "textbook"',
      'theme=textbook',
      '--theme textbook',
      '&amp;theme=textbook',
    ])
      expect(html).toContain(how);
  });
});

describe('the missing page', () => {
  it('links home from any depth', () => {
    expect(notFoundPage(assets)).toContain('href="/"');
  });
});
