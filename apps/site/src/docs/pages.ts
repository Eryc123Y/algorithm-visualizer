/**
 * The documentation's pages (roadmap 3.4): the home page with the
 * catalogue, one page per module, the themes and the missing page. Each
 * is HTML text built from the registry; `scripts/build-pages.ts` writes
 * them next to the share page.
 */
import { findAlgorithm, runAlgorithm, writeInput } from '@algomotion/recipes';
import { shareFragment } from '@algomotion/spec';
import type { ThemeName } from '@algomotion/svg';

import { depthOf, type Entry, type TopicGroup } from './catalog.ts';
import { highlighted, SNIPPET_LANGUAGES } from './highlight.ts';
import { attribute, page, rootOf, text, type Assets } from './html.ts';
import { shortInput } from './short-input.ts';
import { snippetsFor, type Snippet } from './snippets.ts';

export interface StepName {
  readonly name: string;
  readonly count: number;
}

/** Everything a module's page shows. */
export interface EntryDetails {
  readonly entry: Entry;
  /** The structure an operation belongs to. */
  readonly structure?: Entry;
  readonly topicTitle: string;
  /** The first example, as short as it runs the same. */
  readonly input: unknown;
  readonly snippets: readonly Snippet[];
  readonly steps: readonly StepName[];
  /** The other examples, as share links. */
  readonly examples: readonly {
    readonly label: string;
    readonly link: string;
  }[];
  /** A structure's operations. */
  readonly operations: readonly Entry[];
}

/** Step names of a document, counted, in the order they first come. */
export function stepsOf(document: unknown): StepName[] {
  const steps =
    typeof document === 'object' &&
    document !== null &&
    Array.isArray((document as { steps?: unknown }).steps)
      ? (document as { steps: { meta?: { id?: unknown } }[] }).steps
      : [];
  const counts = new Map<string, number>();
  for (const step of steps) {
    const name = step?.meta?.id;
    if (typeof name === 'string') counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}

/** A step to name in examples: the second of a repeated one, if any. */
export function exampleStep(steps: readonly StepName[]): string {
  const repeated = steps.find((s) => s.count >= 2);
  return repeated !== undefined
    ? `${repeated.name}#2`
    : (steps.at(-1)?.name ?? '-1');
}

/**
 * The details of `entry`'s page, from its module's first example, with
 * links for a page `depth` folders deep (its own page's by default).
 */
export async function detailsOf(
  entry: Entry,
  groups: readonly TopicGroup[],
  depth = depthOf(entry.path),
): Promise<EntryDetails> {
  const algorithm = findAlgorithm(entry.id);
  if (algorithm === undefined) throw new Error(`No module ${entry.id}`);
  const group = groups.find((g) => g.topic === entry.topic)!;
  const structure =
    entry.structure === undefined
      ? undefined
      : group.structures.find((s) => s.entry.id === entry.structure);
  const [first, ...others] = algorithm.examples;
  const input = shortInput(entry.id, first);
  const run = runAlgorithm(entry.id, input);
  const steps = run.ok ? stepsOf(run.value.document) : [];
  const examples = await Promise.all(
    others.map(async (example, k) => {
      const text = writeInput(shortInput(entry.id, example));
      const fragment = await shareFragment({
        algorithm: entry.id,
        ...(text === undefined ? {} : { input: text }),
      });
      return {
        label: `Example ${k + 2}`,
        link: `${rootOf(depth)}play/${fragment.ok ? `#${fragment.value}` : ''}`,
      };
    }),
  );
  return {
    entry,
    ...(structure === undefined ? {} : { structure: structure.entry }),
    topicTitle: group.title,
    input,
    snippets: await snippetsFor(entry.id, input, depth, exampleStep(steps)),
    steps,
    examples,
    operations:
      group.structures.find((s) => s.entry.id === entry.id)?.operations ?? [],
  };
}

/** An operation's own name, from a title such as "Stack: push". */
const operationName = (e: Entry): string => e.title.split(': ').at(-1)!;

/** The live player of a run. */
const playerOf = (id: string, input: unknown): string =>
  `<algo-player algorithm="${attribute(id)}" input="${attribute(writeInput(input) ?? '')}"></algo-player>`;

function snippetSection(s: Snippet): string {
  // A focusable region, so a keyboard can scroll a long line into view.
  const code = `<pre tabindex="0" role="region" aria-label="${attribute(s.label)}"><code>${highlighted(s.code, SNIPPET_LANGUAGES[s.id])}</code></pre>`;
  const open =
    s.id === 'link'
      ? `<p><a href="${attribute(s.code)}">Open this run in the share page</a></p>`
      : '';
  return `<section class="snippet" data-snippet="${s.id}">
  <h3>${text(s.label)}</h3>
  ${code}
  ${open}
  <p class="note">${text(s.note)}</p>
</section>`;
}

function stepsIntro(steps: readonly StepName[]): string {
  const step = exampleStep(steps);
  const [name] = step.split('#');
  return step.includes('#')
    ? `Every step has a name, so notes can point at one: <code>${text(step)}</code> is the second <code>${text(name!)}</code> step.`
    : `Every step has a name, so notes can point at one, such as <code>${text(step)}</code>.`;
}

/** A module's page: its player, steps and snippets. */
export function entryPage(d: EntryDetails, assets: Assets): string {
  const { entry } = d;
  const root = rootOf(depthOf(entry.path));
  const crumbs = [
    `<li><a href="${root || './'}">algomotion</a></li>`,
    `<li><a href="${root}algorithms/#topic-${entry.topic}">${text(d.topicTitle)}</a></li>`,
    ...(d.structure === undefined
      ? []
      : [
          `<li><a href="${attribute(root + d.structure.path)}">${text(d.structure.title)}</a></li>`,
        ]),
    `<li aria-current="page">${text(entry.title)}</li>`,
  ];
  const operations =
    d.operations.length === 0
      ? ''
      : `<h2>Operations</h2>
<p>Each operation starts from a structure you describe and animates only itself.</p>
<ul class="cards">
${d.operations
  .map(
    (op) =>
      `  <li><a href="${attribute(root + op.path)}">${text(operationName(op))}</a><p>${text(op.summary)}</p></li>`,
  )
  .join('\n')}
</ul>`;
  const steps =
    d.steps.length === 0
      ? ''
      : `<h2>Steps</h2>
<p>${stepsIntro(d.steps)} In this example:</p>
<ul class="steps">
${d.steps.map((s) => `  <li><code>${text(s.name)}</code> <span>× ${s.count}</span></li>`).join('\n')}
</ul>`;
  const examples =
    d.examples.length === 0
      ? ''
      : `<p class="examples">More examples: ${d.examples
          .map((e) => `<a href="${attribute(e.link)}">${text(e.label)}</a>`)
          .join(', ')}.</p>`;
  return page({
    title: `${entry.title} · algomotion`,
    description: entry.summary,
    root,
    assets,
    section: 'algorithms',
    body: `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.join('')}</ol></nav>
<h1>${text(entry.title)}</h1>
<p class="lede">${text(entry.summary)}</p>
${playerOf(entry.id, d.input)}
${examples}
${operations}
${steps}
<h2>Use it</h2>
<p>The same run, in each output. The input is the example above; give your own the same way.</p>
<div class="snippets">
${d.snippets.map(snippetSection).join('\n')}
</div>`,
  });
}

/** How many pages the catalogue has: modules, structures and operations. */
export const countOf = (groups: readonly TopicGroup[]): number =>
  groups.reduce(
    (n, g) =>
      n +
      g.algorithms.length +
      g.structures.reduce((m, s) => m + 1 + s.operations.length, 0),
    0,
  );

/** The catalogue: every module by topic, with a filter. */
export function algorithmsPage(
  groups: readonly TopicGroup[],
  assets: Assets,
): string {
  // A structure is found by its operations' names too.
  const item = (e: Entry, operations: readonly Entry[] = [], inner = '') =>
    `<li data-search="${attribute(
      [e.id, e.title, e.summary, ...operations.flatMap((o) => [o.id, o.title])]
        .join(' ')
        .toLowerCase(),
    )}"><a href="${attribute('../' + e.path)}">${text(e.title)}</a> <span>${text(e.summary)}</span>${inner}</li>`;
  const topics = groups
    .map(
      (
        g,
      ) => `<section class="topic" id="topic-${g.topic}" aria-labelledby="h-${g.topic}">
  <h2 id="h-${g.topic}">${text(g.title)}</h2>
  <ul class="entries">
${[
  ...g.algorithms.map((e) => `    ${item(e)}`),
  ...g.structures.map(
    (s) =>
      `    ${item(
        s.entry,
        s.operations,
        `<ul class="ops" aria-label="${attribute(s.entry.title)} operations">${s.operations
          .map(
            (op) =>
              `<li><a href="${attribute('../' + op.path)}">${text(operationName(op))}</a></li>`,
          )
          .join('')}</ul>`,
      )}`,
  ),
].join('\n')}
  </ul>
</section>`,
    )
    .join('\n');
  const count = countOf(groups);
  const index = groups
    .map((g) => `<li><a href="#topic-${g.topic}">${text(g.title)}</a></li>`)
    .join('');
  return page({
    title: 'Algorithms and data structures · algomotion',
    description: `All ${count} algorithms, data structures and operations algomotion draws, by topic.`,
    root: '../',
    assets,
    section: 'algorithms',
    body: `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="../">algomotion</a></li><li aria-current="page">Algorithms</li></ol></nav>
<h1>Algorithms and data structures</h1>
<p class="lede">${count} modules, each with its own page: a player, the names of its steps, and the same run written for a web page, Typst, LaTeX, the command line, an AI assistant and a share link. A data structure’s operations are listed under it.</p>
<section id="catalog" aria-labelledby="catalog-title">
<h2 id="catalog-title" class="visually-hidden">Catalogue</h2>
<p class="filter"><label for="filter">Filter</label> <input id="filter" type="search" placeholder="dijkstra, heap, sort…" autocomplete="off" /></p>
<p class="filter-status" role="status"></p>
<nav class="topic-index" aria-label="Topics"><ul>${index}</ul></nav>
<div class="topic-list">
${topics}
</div>
</section>`,
  });
}

const THEME_NOTES: Partial<Record<ThemeName, string>> = {
  light: 'The default: web pages, notes and slides.',
  dark: 'Dark pages and slides.',
  print: 'Greyscale handouts; every role keeps a cue that is not colour.',
  textbook: 'A textbook figure marked up with highlighter and pens.',
  'textbook-dark': 'The same page in a reader’s night mode.',
  blocks: 'Classroom blocks in bold colours, for introductory classes.',
  'blocks-dark': 'The same blocks on a dark mat.',
  'answer-sheet': 'An exam answer sheet: red printed frames, pencil marks.',
  'turbo-c': 'The blue Turbo C screen of university computer labs.',
};

export interface ThemeFigure {
  readonly name: ThemeName;
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

/** The themes: one figure in each, and how each output picks one. */
export function themesPage(
  figures: readonly ThemeFigure[],
  assets: Assets,
): string {
  const how: [string, string][] = [
    [
      'Web page',
      '<algo-player algorithm="dijkstra" theme="textbook"></algo-player>',
    ],
    ['Typst', '#algomotion("dijkstra", input, theme: "textbook")'],
    ['LaTeX', '\\algomotion[theme=textbook]{dijkstra}{…}'],
    ['Command line', 'algomotion export dijkstra --theme textbook'],
    ['MCP', 'algomotion_render { "recipe": "dijkstra", "theme": "textbook" }'],
    ['Share link', 'play/#v=1&alg=dijkstra&theme=textbook'],
  ];
  return page({
    title: 'Themes · algomotion',
    description:
      'The built-in themes of algomotion, and how to pick one in each output.',
    root: '../',
    assets,
    section: 'themes',
    body: `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="../">algomotion</a></li><li aria-current="page">Themes</li></ol></nav>
<h1>Themes</h1>
<p class="lede">Every output draws in the same built-in themes, and every theme works in every output. <code>light</code> is the default; the player’s <code>auto</code> follows the reader’s light or dark setting, and a pair such as <code>textbook textbook-dark</code> picks a day and a night theme.</p>
<h2>Picking a theme</h2>
<div class="scroll" role="region" aria-label="How each output picks a theme" tabindex="0">
<table class="how">
  <thead><tr><th scope="col">Output</th><th scope="col">How</th></tr></thead>
  <tbody>
${how.map(([where, code]) => `    <tr><th scope="row">${text(where)}</th><td><code>${text(code)}</code></td></tr>`).join('\n')}
  </tbody>
</table>
</div>
<h2>The themes</h2>
<p>Dijkstra’s algorithm at its third improvement, in each theme.</p>
<div class="themes">
${figures
  .map(
    (f) => `<figure>
  <img src="${attribute(f.file)}" width="${f.width}" height="${f.height}" alt="Dijkstra’s algorithm drawn in the ${attribute(f.name)} theme" loading="lazy" />
  <figcaption><code>${text(f.name)}</code> ${text(THEME_NOTES[f.name] ?? '')}</figcaption>
</figure>`,
  )
  .join('\n')}
</div>`,
  });
}

/**
 * The page for any address the site does not have. Cloudflare Pages
 * serves it at whatever path was asked for, so its links start at `/`:
 * the one page that assumes the site is at its origin's root.
 */
export function notFoundPage(assets: Assets): string {
  return page({
    title: 'Not found · algomotion',
    description: 'This page does not exist.',
    root: '/',
    assets,
    body: `<h1>Not found</h1>
<p class="lede">There is no page at this address. The <a href="/algorithms/">catalogue</a> lists every algorithm and data structure, and <a href="/guide/">the guide</a> shows how to use them.</p>`,
  });
}
