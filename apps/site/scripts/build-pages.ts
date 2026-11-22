/**
 * Writes the site's pages into `dist/`, after Vite has built the scripts:
 * the home page with its figures, the guide, the catalogue, a page per
 * registry module, the themes and the missing page, in English at the
 * root and in Chinese under `zh/`. Every figure is drawn here by the
 * engine (`draw.ts`), from a run in its page's language, so the site
 * always shows what the packages draw. Each page gets the site's Content
 * Security Policy, as the share page does.
 *
 *     node --conditions=@algomotion/source scripts/build-pages.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { algorithms } from '@algomotion/recipes';
import { themeNames } from '@algomotion/svg';

import { assetsOf, type Manifest } from '../src/docs/assets.ts';
import { catalog, type Entry, type TopicGroup } from '../src/docs/catalog.ts';
import { figureFiles, guidePage, type Guide } from '../src/docs/guide.ts';
import { GUIDES } from '../src/docs/guides/index.ts';
import { GUIDES_ZH } from '../src/docs/guides/zh/index.ts';
import { homePage, type Art, type HomeArt } from '../src/docs/home.ts';
import { attribute, type BuildInfo } from '../src/docs/html.ts';
import {
  depthOf,
  LOCALES,
  missingCounterparts,
  PREFIX,
  type Locale,
} from '../src/docs/locale.ts';
import {
  changelogPage,
  contributingPage,
  roadmapPage,
} from '../src/docs/project.ts';
import {
  algorithmsPage,
  countOf,
  detailsOf,
  entryPage,
  notFoundPage,
  stepsOf,
  themesPage,
} from '../src/docs/pages.ts';
import { playgroundGroups, playgroundMarkup } from '../src/docs/playground.ts';
import { parseScenes } from '../src/docs/scenes.ts';
import { shortInput } from '../src/docs/short-input.ts';
import { inputText, slidesCode, snippetsFor } from '../src/docs/snippets.ts';
import { HOME } from '../src/docs/text/home.ts';
import { WHY } from '../src/docs/text/why.ts';
import { WHY_FIGURES, WHY_RUN, whyPage } from '../src/docs/why.ts';
import { withPolicy } from '../src/headers.ts';
import {
  allFigures,
  DIST,
  runOf,
  drawArt,
  drawThumbnails,
  figureOf,
  write,
} from './draw.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const ENTRY = 'src/docs/main.ts';
/** The run the home page and the themes show. */
const DEMO = 'dijkstra';
const THEME_STEP = 'improve#3';
/** The home page's input: small enough to read at a glance. */
const HOME_INPUT = 'A-B 4, B-C 1, A-C 7, C-D 2';

/** A file of the repository, by its path from the root. */
const repoFile = (path: string): string =>
  readFileSync(join(REPO, path), 'utf8');

/** The version and the commit built, for the footer. */
function buildInfo(): BuildInfo {
  const { version } = JSON.parse(repoFile('package.json')) as {
    version: string;
  };
  try {
    const [commit, date] = execFileSync(
      'git',
      ['log', '-1', '--format=%H %cs'],
      { cwd: REPO, encoding: 'utf8' },
    )
      .trim()
      .split(' ');
    return commit === undefined || date === undefined
      ? { version }
      : { version, commit, date };
  } catch {
    // Built outside a Git checkout, such as from an archive.
    return { version };
  }
}

/** The real scenes, made by `npm run scenes` and copied from public/. */
const scenes = parseScenes(
  readFileSync(
    fileURLToPath(new URL('../public/scenes/scenes.json', import.meta.url)),
    'utf8',
  ),
);

const manifest = JSON.parse(
  readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'),
) as Manifest;
const assets = { ...assetsOf(manifest, ENTRY), build: buildInfo() };
/** The catalogue in each locale: the same pages, named in its language. */
const groupsIn: Readonly<Record<Locale, readonly TopicGroup[]>> = {
  en: catalog(algorithms),
  zh: catalog(algorithms, 'zh'),
};
const entriesOf = (of: readonly TopicGroup[]): Entry[] =>
  of.flatMap((g) => [
    ...g.algorithms,
    ...g.structures.flatMap((s) => [s.entry, ...s.operations]),
  ]);
const entries = entriesOf(groupsIn.en);
/** A module's first example, as short as it runs the same, as text. */
const exampleText = (id: string): string =>
  inputText(shortInput(id, algorithms.find((a) => a.id === id)!.examples[0]));

/** Writes a page at `path` within `locale`, with the site's policy. */
function writePage(locale: Locale, path: string, html: string): void {
  const at = `${PREFIX[locale]}${path}`;
  write(
    `${at}${path.endsWith('.html') ? '' : 'index.html'}`,
    withPolicy(html, at || '/'),
  );
}

/** The home page's figures, from the hero's run in `locale`. */
function homeArt(locale: Locale): HomeArt {
  const home = runOf(DEMO, HOME_INPUT, locale);
  const t = HOME[locale];
  const dir = `${PREFIX[locale]}art/`;
  const output = (
    id: keyof HomeArt['outputs'],
    step: string,
    theme?: (typeof themeNames)[number],
  ) => drawArt(home, step, `${dir}out-${id}`, t.outputs.alts[id], theme);
  return {
    // Every step of the run, frames 1 to the last, for the story.
    story: allFigures(home).map((f) => ({
      step: f.selector,
      narration: f.narration ?? '',
      ...drawArt(home, f.frame, `${dir}story-${f.frame}`, f.narration ?? ''),
    })),
    outputs: {
      web: output('web', 'improve#3', 'blocks'),
      typst: output('typst', 'improve#3', 'textbook'),
      latex: output('latex', 'improve#3', 'print'),
      cli: output('cli', 'extract#3'),
      mcp: output('mcp', 'improve#3'),
      link: output('link', 'done'),
    },
    slides: ['improve#2', 'extract#2', 'improve#3'].map((step, k) =>
      drawArt(home, step, `${dir}slide-${k + 1}`, '', 'dark'),
    ),
    scenes,
    themes: themeNames.map((name) => ({
      name,
      art: drawArt(
        home,
        'improve#3',
        `${dir}theme-${name}`,
        t.themes.alt(name),
        name,
      ),
    })),
  };
}

/** The figures of a guide page, from its own runs in `locale`. */
function guideArt(guide: Guide, locale: Locale): Record<string, Art> {
  return Object.fromEntries(
    (guide.figures ?? []).map((f) => {
      const { light } = figureFiles(guide.slug, f.key);
      return [
        f.key,
        drawArt(
          runOf(f.algorithm, f.input, locale),
          f.step,
          PREFIX[locale] + light.replace(/-light\.svg$/, ''),
          f.alt,
          f.theme,
        ),
      ];
    }),
  );
}

const GUIDES_IN: Readonly<Record<Locale, readonly Guide[]>> = {
  en: GUIDES,
  zh: GUIDES_ZH,
};

for (const locale of LOCALES) {
  const groups = groupsIn[locale];
  // A page per module.
  for (const entry of entriesOf(groups))
    writePage(
      locale,
      entry.path,
      entryPage(
        await detailsOf(entry, groups, undefined, locale),
        assets,
        locale,
      ),
    );

  // The catalogue, with a thumbnail of each algorithm and structure.
  writePage(
    locale,
    'algorithms/',
    algorithmsPage(
      groups,
      assets,
      drawThumbnails(entriesOf(groups), locale),
      locale,
    ),
  );

  // The themes page: the registry example at one step, in every theme.
  const example = runOf(
    DEMO,
    shortInput(DEMO, algorithms.find((a) => a.id === DEMO)!.examples[0]),
    locale,
  );
  const figures = themeNames.map((name) => {
    const figure = figureOf(example, THEME_STEP, name);
    const file = `${DEMO}-${name}.svg`;
    write(`${PREFIX[locale]}themes/${file}`, figure.svg);
    return { name, file, width: figure.width, height: figure.height };
  });
  writePage(locale, 'themes/', themesPage(figures, assets, locale));

  // The home page: the hero's run, its story, and a figure per output.
  // In Chinese the share link and the playground's snippets are one
  // folder further from the site's root.
  const depth = depthOf(PREFIX[locale]);
  const demo = await detailsOf(
    entriesOf(groups).find((e) => e.id === DEMO)!,
    groups,
    depth,
    locale,
  );
  const snippets = await snippetsFor(
    DEMO,
    HOME_INPUT,
    depth,
    'improve#3',
    locale,
  );
  const playground = playgroundMarkup(
    playgroundGroups(groups, exampleText, locale),
    { algorithm: DEMO, input: HOME_INPUT, title: demo.entry.title },
    `<algo-player algorithm="${DEMO}" input="${attribute(HOME_INPUT)}" theme="auto"></algo-player>`,
    snippets.find((s) => s.id === 'link')!.code,
    locale,
  );
  writePage(
    locale,
    '',
    homePage(
      groups,
      { ...demo, snippets },
      homeArt(locale),
      playground,
      slidesCode(demo.entry.title, DEMO, HOME_INPUT, locale),
      countOf(groups),
      assets,
      locale,
    ),
  );

  // The guide, each page's figures drawn from its own runs.
  for (const guide of GUIDES_IN[locale])
    writePage(
      locale,
      `guide/${guide.slug === '' ? '' : `${guide.slug}/`}`,
      guidePage(
        guide,
        GUIDES_IN[locale],
        guideArt(guide, locale),
        assets,
        scenes,
        { locale, translated: true },
      ),
    );

  // Cloudflare serves the nearest 404.html, so addresses under zh/ get
  // the Chinese one.
  writePage(locale, '404.html', notFoundPage(assets, locale));

  // Why algomotion: its figures, and the facts it states, from real runs.
  const whyArt = Object.fromEntries(
    WHY_FIGURES.map((f) => [
      f.key,
      drawArt(
        runOf(f.algorithm, f.input, locale),
        f.step,
        `${PREFIX[locale]}why/${f.key}`,
        WHY[locale].alt[f.key],
        f.theme,
        f.layout,
      ),
    ]),
  );
  const whyRun = runOf(WHY_RUN.algorithm, WHY_RUN.input, locale);
  const whyFacts = {
    steps: stepsOf(whyRun.document),
    checked: figureOf(whyRun, 'improve#3', 'light').narration ?? '',
    modules: algorithms.length,
  };
  writePage(locale, 'why/', whyPage(whyArt, whyFacts, assets, scenes, locale));
}

// The project pages, from the repository's own files.
const PROJECT = [
  ['changelog/', changelogPage, 'CHANGELOG.md'],
  ['roadmap/', roadmapPage, 'docs/roadmap.md'],
  ['contributing/', contributingPage, 'CONTRIBUTING.md'],
] as const;
for (const [path, render, file] of PROJECT)
  for (const locale of LOCALES)
    writePage(locale, path, render(repoFile(file), assets, locale));

// Every English page but the share page has a Chinese counterpart, or the
// build fails: the two cannot drift apart. The share page is one page for
// every link, in the language the link or the reader's browser asks for.
const englishOnly = new Set(['play/']);
const pagesUnder = (dir: string): string[] =>
  readdirSync(join(DIST, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? d.name === 'zh' || d.name === 'assets' || d.name.startsWith('.')
        ? []
        : pagesUnder(`${dir}${d.name}/`)
      : d.name.endsWith('.html')
        ? [`${dir}${d.name === 'index.html' ? '' : d.name}`]
        : [],
  );
const missing = missingCounterparts(pagesUnder(''), englishOnly, (path) =>
  existsSync(
    join(DIST, 'zh', path, path.endsWith('.html') ? '' : 'index.html'),
  ),
);
if (missing.length > 0)
  throw new Error(
    `These English pages have no Chinese counterpart under zh/: ${missing.join(', ')}`,
  );

process.stdout.write(
  `Wrote ${entries.length + 5 + GUIDES.length + PROJECT.length} English pages and ${entries.length + 5 + GUIDES_ZH.length + PROJECT.length} Chinese pages, with their figures, to dist/\n`,
);
