/**
 * Writes the documentation pages (roadmap 3.4) into `dist/`, after Vite
 * has built the scripts: the home page, a page per registry module, the
 * themes with one figure each, and the missing page. Each page gets the
 * site's Content Security Policy, as the share page does.
 *
 *     node --conditions=@algoviz/source scripts/build-pages.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { algorithms, runAlgorithm } from '@algoviz/recipes';
import { exportFigures, themeNames } from '@algoviz/svg';

import { catalog, type Entry } from '../src/docs/catalog.ts';
import { assetsOf, type Manifest } from '../src/docs/assets.ts';
import { shortInput } from '../src/docs/short-input.ts';
import {
  detailsOf,
  entryPage,
  homePage,
  notFoundPage,
  themesPage,
} from '../src/docs/pages.ts';
import { withPolicy } from '../src/headers.ts';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const ENTRY = 'src/docs/main.ts';
/** The run the home page and the themes show. */
const DEMO = 'dijkstra';
const THEME_STEP = 'improve#3';

function write(path: string, html: string): void {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
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

const demo = entries.find((e) => e.id === DEMO)!;
write(
  'index.html',
  withPolicy(homePage(groups, await detailsOf(demo, groups, 0), assets), '/'),
);

const run = runAlgorithm(
  DEMO,
  shortInput(DEMO, algorithms.find((a) => a.id === DEMO)!.examples[0]),
);
if (!run.ok) throw new Error(`${DEMO} does not run`);
const figures = themeNames.map((name) => {
  const series = exportFigures(run.value.document, {
    theme: name,
    steps: [THEME_STEP],
  });
  if (!series.ok) throw new Error(`${name}: ${JSON.stringify(series.error)}`);
  const figure = series.value.figures[0]!;
  const file = `${DEMO}-${name}.svg`;
  write(`themes/${file}`, figure.svg);
  return { name, file, width: figure.width, height: figure.height };
});
write('themes/index.html', withPolicy(themesPage(figures, assets), 'themes/'));
write('404.html', withPolicy(notFoundPage(assets), '404.html'));

process.stdout.write(
  `Wrote ${entries.length + 3} pages and ${figures.length} theme figures to dist/\n`,
);
