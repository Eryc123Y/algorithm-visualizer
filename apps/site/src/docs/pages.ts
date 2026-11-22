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
import { picture, sheet, type Art } from './home.ts';
import { PREFIX, rootsOf, type Locale } from './locale.ts';
import { CHROME } from './text/chrome.ts';
import { PAGES, type PagesText } from './text/pages.ts';
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
 * The details of `entry`'s page in `locale`, from its module's first
 * example, with links for a page `depth` folders below the site's root
 * (its own page's by default).
 */
export async function detailsOf(
  entry: Entry,
  groups: readonly TopicGroup[],
  depth?: number,
  locale: Locale = 'en',
): Promise<EntryDetails> {
  const below = depth ?? depthOf(PREFIX[locale] + entry.path);
  const lang = locale === 'en' ? undefined : locale;
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
        ...(lang === undefined ? {} : { lang }),
      });
      return {
        label: PAGES[locale].entry.example(k + 2),
        link: `${rootOf(below)}play/${fragment.ok ? `#${fragment.value}` : ''}`,
      };
    }),
  );
  return {
    entry,
    ...(structure === undefined ? {} : { structure: structure.entry }),
    topicTitle: group.title,
    input,
    snippets: await snippetsFor(
      entry.id,
      input,
      below,
      exampleStep(steps),
      locale,
    ),
    steps,
    examples,
    operations:
      group.structures.find((s) => s.entry.id === entry.id)?.operations ?? [],
  };
}

/**
 * An operation's own name, from a title such as "Stack: push", or
 * "栈：压入" with a full-width colon.
 */
const operationName = (e: Entry): string => e.title.split(/: |：/u).at(-1)!;

/** The live player of a run. */
const playerOf = (id: string, input: unknown): string =>
  `<algo-player algorithm="${attribute(id)}" input="${attribute(writeInput(input) ?? '')}"></algo-player>`;

function snippetSection(s: Snippet, openShare: string): string {
  // A focusable region, so a keyboard can scroll a long line into view.
  const code = `<pre tabindex="0" role="region" aria-label="${attribute(s.label)}"><code>${highlighted(s.code, SNIPPET_LANGUAGES[s.id])}</code></pre>`;
  const open =
    s.id === 'link'
      ? `<p><a href="${attribute(s.code)}">${text(openShare)}</a></p>`
      : '';
  return `<section class="snippet" data-snippet="${s.id}">
  <h3>${text(s.label)}</h3>
  ${code}
  ${open}
  <p class="note">${text(s.note)}</p>
</section>`;
}

function stepsIntro(steps: readonly StepName[], t: PagesText['entry']): string {
  const step = exampleStep(steps);
  const [name] = step.split('#');
  return t.stepsIntro(text(step), text(name!), step.includes('#'));
}

/**
 * A module's page in `locale`: its player, steps and snippets. The player
 * runs in the page's language, which it inherits (ADR 0045).
 */
export function entryPage(
  d: EntryDetails,
  assets: Assets,
  locale: Locale = 'en',
): string {
  const { entry } = d;
  const t = PAGES[locale].entry;
  const { site, home } = rootsOf(locale, entry.path);
  const crumbs = [
    `<li><a href="${home || './'}">algomotion</a></li>`,
    `<li><a href="${home}algorithms/#topic-${entry.topic}">${text(d.topicTitle)}</a></li>`,
    ...(d.structure === undefined
      ? []
      : [
          `<li><a href="${attribute(home + d.structure.path)}">${text(d.structure.title)}</a></li>`,
        ]),
    `<li aria-current="page">${text(entry.title)}</li>`,
  ];
  const operations =
    d.operations.length === 0
      ? ''
      : `<h2>${text(t.operations)}</h2>
<p>${text(t.operationsLede)}</p>
<ul class="cards">
${d.operations
  .map(
    (op) =>
      `  <li><a href="${attribute(home + op.path)}">${text(operationName(op))}</a><p>${text(op.summary)}</p></li>`,
  )
  .join('\n')}
</ul>`;
  const steps =
    d.steps.length === 0
      ? ''
      : `<h2>${text(t.steps)}</h2>
<p>${stepsIntro(d.steps, t)}${locale === 'en' ? ' ' : ''}${text(t.inThisExample)}</p>
<ul class="steps">
${d.steps.map((s) => `  <li><code>${text(s.name)}</code> <span>× ${s.count}</span></li>`).join('\n')}
</ul>`;
  const comma = locale === 'en' ? ', ' : '、';
  const examples =
    d.examples.length === 0
      ? ''
      : `<p class="examples">${text(t.moreExamples)}${locale === 'en' ? ' ' : ''}${d.examples
          .map((e) => `<a href="${attribute(e.link)}">${text(e.label)}</a>`)
          .join(comma)}${locale === 'en' ? '.' : '。'}</p>`;
  return page({
    title: `${entry.title} · algomotion`,
    description: entry.summary,
    root: site,
    assets,
    section: 'algorithms',
    locale,
    alternate: entry.path,
    body: `<nav class="crumbs" aria-label="${attribute(CHROME[locale].breadcrumb)}"><ol>${crumbs.join('')}</ol></nav>
<h1>${text(entry.title)}</h1>
<p class="lede">${text(entry.summary)}</p>
${playerOf(entry.id, d.input)}
${examples}
${operations}
${steps}
<h2>${text(t.useIt)}</h2>
<p>${text(t.useItLede)}</p>
<div class="snippets">
${d.snippets.map((s) => snippetSection(s, t.openShare)).join('\n')}
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

/**
 * The frame a thumbnail shows, of a run of `frames`: the middle one, where
 * the algorithm is at work. The first frame is only the input and the
 * last often only the answer; half-way, a sort is half sorted, a search
 * has a frontier and a tree is half built.
 */
export const thumbnailFrame = (frames: number): number =>
  frames <= 1 ? 0 : Math.max(1, Math.floor((frames - 1) / 2));

/**
 * The frames a thumbnail flips through on hover, of a run of `frames`: up
 * to four, spread evenly from the first step to the answer, so a glance
 * shows the run start, work and finish. None for a run of two frames or
 * fewer, which has nothing to show in motion.
 */
export function flipFrames(frames: number): number[] {
  if (frames <= 2) return [];
  const last = frames - 1;
  const count = Math.min(4, last);
  const picked = Array.from({ length: count }, (_, k) =>
    Math.round(1 + (k * (last - 1)) / (count - 1)),
  );
  return [...new Set(picked)];
}

/** A catalogue thumbnail, with the frames it flips through on hover. */
export interface Thumbnail extends Art {
  readonly flip?: readonly number[];
}

/**
 * How many thumbnails load with the page rather than lazily: two rows on
 * a desktop, the first screen; lazy ones start only after layout.
 */
export const EAGER_THUMBNAILS = 8;

/** Where a module's thumbnails go, relative to the catalogue's page. */
export const thumbnailStem = (id: string): string => `thumbs/${id}`;

/**
 * The catalogue in `locale`: every module by topic, with a filter, each
 * algorithm and structure as a card with its thumbnail from `thumbnails`,
 * by id, drawn beside the page from a run in its language.
 */
export function algorithmsPage(
  groups: readonly TopicGroup[],
  assets: Assets,
  thumbnails: Readonly<Record<string, Thumbnail>> = {},
  locale: Locale = 'en',
): string {
  const t = PAGES[locale].algorithms;
  const topicNames = CHROME[locale].topics;
  const { site, home } = rootsOf(locale, 'algorithms/');
  // The thumbnail is decorative: the card's link is named by its title.
  // The first ones are on the first screen: they load with the page.
  let shown = 0;
  const thumb = (e: Entry) => {
    const art = thumbnails[e.id];
    if (art === undefined) return '';
    const loading = shown++ < EAGER_THUMBNAILS ? 'eager' : 'lazy';
    // The frames it flips through on hover (flip.ts), beside its drawing.
    const flip =
      art.flip === undefined || art.flip.length === 0
        ? ''
        : ` data-flip="${attribute(thumbnailStem(e.id))}" data-frames="${art.flip.join(',')}"`;
    return `<span class="thumb"${flip}>${picture({ ...art, alt: '' }, '', loading)}</span>`;
  };
  // A structure is found by its operations' names too.
  const item = (e: Entry, operations: readonly Entry[] = [], inner = '') =>
    `<li class="card" data-search="${attribute(
      [
        e.id,
        e.title,
        e.summary,
        // A reader of the Chinese page may search by the topic's name, or
        // by the English name they learnt.
        ...(locale === 'en' ? [] : [topicNames[e.topic]]),
        ...(e.english === undefined ? [] : [e.english]),
        ...operations.flatMap((o) => [
          o.id,
          o.title,
          ...(o.english === undefined ? [] : [o.english]),
        ]),
      ]
        .join(' ')
        .toLowerCase(),
    )}"><a href="${attribute(home + e.path)}">${thumb(e)}<span class="card-title">${text(e.title)}</span></a> <span class="card-summary">${text(e.summary)}</span>${inner}</li>`;
  const topics = groups
    .map(
      (
        g,
      ) => `<section class="topic" id="topic-${g.topic}" aria-labelledby="h-${g.topic}">
  <h2 id="h-${g.topic}">${text(topicNames[g.topic])}</h2>
  <ul class="entries">
${[
  ...g.algorithms.map((e) => `    ${item(e)}`),
  ...g.structures.map(
    (s) =>
      `    ${item(
        s.entry,
        s.operations,
        `<ul class="ops" aria-label="${attribute(t.operations(s.entry.title))}">${s.operations
          .map(
            (op) =>
              `<li><a href="${attribute(home + op.path)}">${text(operationName(op))}</a></li>`,
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
    .map(
      (g) =>
        `<li><a href="#topic-${g.topic}">${text(topicNames[g.topic])}</a></li>`,
    )
    .join('');
  const crumbs = CHROME[locale].breadcrumb;
  return page({
    title: t.title,
    description: t.description(count),
    root: site,
    assets,
    section: 'algorithms',
    locale,
    alternate: 'algorithms/',
    body: `<nav class="crumbs" aria-label="${attribute(crumbs)}"><ol><li><a href="../">algomotion</a></li><li aria-current="page">${text(t.heading)}</li></ol></nav>
<h1>${text(t.heading)}</h1>
<p class="lede">${text(t.lede(count))}</p>
<section id="catalog" aria-labelledby="catalog-title">
<h2 id="catalog-title" class="visually-hidden">${text(t.catalogue)}</h2>
<p class="filter"><label for="filter">${text(t.filter)}</label> <input id="filter" type="search" placeholder="${attribute(t.placeholder)}" autocomplete="off" /></p>
<p class="filter-status" role="status"></p>
<nav class="topic-index" aria-label="${attribute(t.topics)}"><ul>${index}</ul></nav>
<div class="topic-list">
${topics}
</div>
</section>`,
  });
}

export interface ThemeFigure {
  readonly name: ThemeName;
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The themes: one figure in each, drawn beside the page from a run in its
 * language, and how each output picks one.
 */
export function themesPage(
  figures: readonly ThemeFigure[],
  assets: Assets,
  locale: Locale = 'en',
): string {
  const t = PAGES[locale].themes;
  const { site } = rootsOf(locale, 'themes/');
  const codes = [
    '<algo-player algorithm="dijkstra" theme="textbook"></algo-player>',
    '#algomotion("dijkstra", input, theme: "textbook")',
    '\\algomotion[theme=textbook]{dijkstra}{…}',
    'algomotion export dijkstra --theme textbook',
    'algomotion_render { "recipe": "dijkstra", "theme": "textbook" }',
    'play/#v=1&alg=dijkstra&theme=textbook',
  ];
  return page({
    title: t.title,
    description: t.description,
    root: site,
    assets,
    section: 'themes',
    locale,
    alternate: 'themes/',
    body: `<nav class="crumbs" aria-label="${attribute(CHROME[locale].breadcrumb)}"><ol><li><a href="../">algomotion</a></li><li aria-current="page">${text(t.heading)}</li></ol></nav>
<h1>${text(t.heading)}</h1>
<p class="lede">${t.lede}</p>
<h2>${text(t.picking)}</h2>
<div class="scroll" role="region" aria-label="${attribute(t.table)}" tabindex="0">
<table class="how">
  <thead><tr><th scope="col">${text(t.output)}</th><th scope="col">${text(t.how)}</th></tr></thead>
  <tbody>
${codes.map((code, k) => `    <tr><th scope="row">${text(t.outputs[k]!)}</th><td><code>${text(code)}</code></td></tr>`).join('\n')}
  </tbody>
</table>
</div>
<h2>${text(t.list)}</h2>
<p>${text(t.listLede)}</p>
<div class="themes">
${figures
  .map(
    (f) => `<figure>
  ${sheet(f.name, `<img src="${attribute(f.file)}" width="${f.width}" height="${f.height}" alt="${attribute(t.alt(f.name))}" loading="lazy" />`)}
  <figcaption><code>${text(f.name)}</code> ${text(t.notes[f.name])}</figcaption>
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
export function notFoundPage(assets: Assets, locale: Locale = 'en'): string {
  const t = PAGES[locale].notFound;
  const home = `/${PREFIX[locale]}`;
  return page({
    title: t.title,
    description: t.description,
    root: '/',
    assets,
    locale,
    body: `<h1>${text(t.heading)}</h1>
<p class="lede">${t.lede(`${home}algorithms/`, `${home}guide/`)}</p>`,
  });
}
