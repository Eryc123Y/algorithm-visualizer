/**
 * Writes the site's pages into `dist/`, after Vite has built the scripts:
 * the home page with its figures, the guide, the catalogue, a page per
 * registry module, the themes and the missing page. Every figure is drawn
 * here by the engine, so the site always shows what the packages draw.
 * Each page gets the site's Content Security Policy, as the share page
 * does.
 *
 *     node --conditions=@algomotion/source scripts/build-pages.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { algorithms, runAlgorithm } from '@algomotion/recipes';
import {
  exportFigures,
  themeNames,
  type Figure,
  type ThemeName,
} from '@algomotion/svg';

import { assetsOf, type Manifest } from '../src/docs/assets.ts';
import { catalog, type Entry } from '../src/docs/catalog.ts';
import { figureFiles, guidePage } from '../src/docs/guide.ts';
import { GUIDES } from '../src/docs/guides/index.ts';
import { homePage, type Art, type HomeArt } from '../src/docs/home.ts';
import { attribute } from '../src/docs/html.ts';
import {
  algorithmsPage,
  countOf,
  detailsOf,
  entryPage,
  notFoundPage,
  themesPage,
} from '../src/docs/pages.ts';
import { shortInput } from '../src/docs/short-input.ts';
import { snippetsFor } from '../src/docs/snippets.ts';
import { withPolicy } from '../src/headers.ts';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const ENTRY = 'src/docs/main.ts';
/** The run the home page and the themes show. */
const DEMO = 'dijkstra';
const THEME_STEP = 'improve#3';
/** The home page's input: small enough to read at a glance. */
const HOME_INPUT = 'A-B 4, B-C 1, A-C 7, C-D 2';
/** The plate's subfigures, (a) to (f). */
const PLATE = [
  'start',
  'extract#1',
  'improve#2',
  'improve#3',
  'improve#4',
  'done',
];

function write(path: string, html: string): void {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

/** The document of `algorithm` run on `input`, or a build error. */
function documentOf(algorithm: string, input: unknown): unknown {
  const result = runAlgorithm(algorithm, input);
  if (!result.ok)
    throw new Error(
      `${algorithm} on ${JSON.stringify(input)}: ${JSON.stringify(result.error)}`,
    );
  return result.value.document;
}

/** One frame of `document` in `theme`. */
function figureOf(document: unknown, step: string, theme: ThemeName): Figure {
  const series = exportFigures(document, { theme, steps: [step] });
  if (!series.ok)
    throw new Error(`${step} in ${theme}: ${JSON.stringify(series.error)}`);
  return series.value.figures[0]!;
}

/**
 * Draws a step in the light and the dark theme, or in one fixed theme,
 * into `stem-light.svg` and `stem-dark.svg`.
 */
function drawArt(
  document: unknown,
  step: string,
  stem: string,
  alt: string,
  theme?: ThemeName,
): Art {
  const light = figureOf(document, step, theme ?? 'light');
  const dark = theme === undefined ? figureOf(document, step, 'dark') : light;
  write(`${stem}-light.svg`, light.svg);
  write(`${stem}-dark.svg`, dark.svg);
  return {
    light: `${stem}-light.svg`,
    dark: `${stem}-dark.svg`,
    width: light.width,
    height: light.height,
    alt: alt || light.narration || 'The initial state.',
  };
}

const manifest = JSON.parse(
  readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'),
) as Manifest;
const assets = assetsOf(manifest, ENTRY);
const groups = catalog(algorithms);
const entries: Entry[] = groups.flatMap((g) => [
  ...g.algorithms,
  ...g.structures.flatMap((s) => [s.entry, ...s.operations]),
]);

for (const entry of entries) {
  const html = entryPage(await detailsOf(entry, groups), assets);
  write(`${entry.path}index.html`, withPolicy(html, entry.path));
}
write(
  'algorithms/index.html',
  withPolicy(algorithmsPage(groups, assets), 'algorithms/'),
);

// The themes page: the registry example at one step, in every theme.
const example = documentOf(
  DEMO,
  shortInput(DEMO, algorithms.find((a) => a.id === DEMO)!.examples[0]),
);
const figures = themeNames.map((name) => {
  const figure = figureOf(example, THEME_STEP, name);
  const file = `${DEMO}-${name}.svg`;
  write(`themes/${file}`, figure.svg);
  return { name, file, width: figure.width, height: figure.height };
});
write('themes/index.html', withPolicy(themesPage(figures, assets), 'themes/'));

// The home page: the hero's run, its plate, and a figure per output.
const home = documentOf(DEMO, HOME_INPUT);
const art: HomeArt = {
  plate: PLATE.map((step) => ({
    step,
    ...drawArt(home, step, `art/plate-${step.replace('#', '-')}`, ''),
  })),
  outputs: {
    web: drawArt(
      home,
      'improve#3',
      'art/out-web',
      'The player at C’s improvement to 5, in the blocks theme.',
      'blocks',
    ),
    typst: drawArt(
      home,
      'improve#3',
      'art/out-typst',
      'C improves to 5, through B, in the textbook theme.',
      'textbook',
    ),
    latex: drawArt(
      home,
      'improve#3',
      'art/out-latex',
      'C improves to 5, through B, in the print theme.',
      'print',
    ),
    cli: drawArt(home, 'extract#3', 'art/out-cli', 'C is final, at 5.'),
    mcp: drawArt(home, 'improve#3', 'art/out-mcp', 'C improves to 5.'),
    link: drawArt(home, 'done', 'art/out-link', 'Every distance is final.'),
  },
  slides: ['improve#2', 'extract#2', 'improve#3'].map((step, k) =>
    drawArt(home, step, `art/slide-${k + 1}`, '', 'dark'),
  ),
  themes: themeNames.map((name) => ({
    name,
    art: drawArt(
      home,
      'improve#3',
      `art/theme-${name}`,
      `Dijkstra’s algorithm in the ${name} theme.`,
      name,
    ),
  })),
};
const demo = await detailsOf(
  entries.find((e) => e.id === DEMO)!,
  groups,
  0,
);
const player = `<algo-player algorithm="${DEMO}" input="${attribute(HOME_INPUT)}" theme="auto"></algo-player>`;
write(
  'index.html',
  withPolicy(
    homePage(
      groups,
      {
        ...demo,
        snippets: await snippetsFor(DEMO, HOME_INPUT, 0, 'improve#3'),
      },
      art,
      player,
      countOf(groups),
      assets,
    ),
    '/',
  ),
);

// The guide, each page's figures drawn from its own runs.
for (const guide of GUIDES) {
  const drawn: Record<string, Art> = {};
  for (const f of guide.figures ?? []) {
    const { light } = figureFiles(guide.slug, f.key);
    drawn[f.key] = drawArt(
      documentOf(f.algorithm, f.input),
      f.step,
      light.replace(/-light\.svg$/, ''),
      f.alt,
      f.theme,
    );
  }
  const path = `guide/${guide.slug === '' ? '' : `${guide.slug}/`}`;
  write(
    `${path}index.html`,
    withPolicy(guidePage(guide, GUIDES, drawn, assets), path),
  );
}

write('404.html', withPolicy(notFoundPage(assets), '404.html'));

process.stdout.write(
  `Wrote ${entries.length + 4 + GUIDES.length} pages and ${figures.length} theme figures to dist/\n`,
);
