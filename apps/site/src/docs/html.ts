/**
 * HTML for the generated pages: escaping, and the frame every page shares.
 * Every value that comes from the registry goes through `text` or
 * `attribute`, so no title or summary can become markup.
 */

import {
  LANG,
  LOCALES,
  otherLocale,
  PREFIX,
  SITE_URL,
  type Locale,
} from './locale.ts';
import { CHROME, type ChromeText } from './text/chrome.ts';

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text for an element's content. */
export const text = (value: string): string =>
  value.replace(/[&<>]/g, (c) => ENTITIES[c]!);

/** Text for an attribute value in either kind of quotes. */
export const attribute = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ENTITIES[c]!);

/** The build a page came from, for the footer. */
export interface BuildInfo {
  /** The repository's version, from its `package.json`. */
  readonly version: string;
  /** The commit built, as a full hash, if Git was there to ask. */
  readonly commit?: string;
  /** That commit's date, `YYYY-MM-DD`. */
  readonly date?: string;
}

/** The files a page loads, relative to the site's root. */
export interface Assets {
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
  /** Modules the script imports, preloaded. */
  readonly preloads: readonly string[];
  /** Web fonts the first screen sets, preloaded. */
  readonly fonts?: readonly string[];
  /** The build the files came from; the footer names it. */
  readonly build?: BuildInfo;
}

/** The site's sections, for the bar's current-page mark. */
export type Section =
  'home' | 'why' | 'guide' | 'algorithms' | 'themes' | 'project';

export interface PageFrame {
  readonly title: string;
  readonly description: string;
  /** The way back to the site's root: `../` per folder, or `/`. */
  readonly root: string;
  readonly assets: Assets;
  readonly body: string;
  /** The section the page belongs to. */
  readonly section?: Section;
  /** A class for `<main>`, such as `guide` for the guide's two columns. */
  readonly layout?: string;
  /** The page's language; English by default. */
  readonly locale?: Locale;
  /**
   * The page's path within its locale, such as `guide/web/`, when the
   * other locale has the same page: the language switch leads there and
   * `hreflang` names both. Without it, the switch leads to the other
   * locale's home page.
   */
  readonly alternate?: string;
}

/** The project's repository. */
export const REPOSITORY = 'https://github.com/Eryc123Y/algorithm-visualizer';

/**
 * The wordmark's glyph, a placeholder until the owner picks a logo: a play
 * head over a sorted run of bars. It is decorative; the link's name is the
 * word beside it.
 */
const GLYPH = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="glyph-now" d="M22 8H42L32 20Z"/><g class="glyph-bars"><rect x="12" y="40" width="10" height="14"/><rect x="27" y="30" width="10" height="24"/><rect x="42" y="20" width="10" height="34"/></g></svg>`;

/** The footer's line about the build: version, commit and date. */
function buildLine(
  build: BuildInfo | undefined,
  home: string,
  t: ChromeText['footer'],
): string {
  if (build === undefined) return '';
  return `<p class="build">${t.build({
    version: text(build.version),
    ...(build.commit === undefined
      ? {}
      : {
          commit: `<a href="${attribute(`${REPOSITORY}/commit/${build.commit}`)}"><code>${text(build.commit.slice(0, 7))}</code></a>`,
        }),
    ...(build.date === undefined
      ? {}
      : {
          date: `<time datetime="${attribute(build.date)}">${text(build.date)}</time>`,
        }),
    changelog: `<a href="${attribute(home)}changelog/">${text(t.whatChanged)}</a>`,
  })}</p>`;
}

/** The `hreflang` alternates of a page that exists in every locale. */
function alternates(path: string): string[] {
  return [
    ...LOCALES.map(
      (l) =>
        `<link rel="alternate" hreflang="${LANG[l]}" href="${attribute(SITE_URL + PREFIX[l] + path)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${attribute(SITE_URL + path)}" />`,
  ];
}

/** A whole page. Its Content Security Policy is added after the charset. */
export function page({
  title,
  description,
  root,
  assets,
  body,
  section,
  layout,
  locale = 'en',
  alternate,
}: PageFrame): string {
  const t = CHROME[locale];
  const f = t.footer;
  const other = otherLocale(locale);
  // The locale's own root: the bar, footer and home link stay within it.
  const home = root + PREFIX[locale];
  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light dark" />',
    `<meta name="description" content="${attribute(description)}" />`,
    `<title>${text(title)}</title>`,
    `<link rel="icon" href="${attribute(root)}favicon.svg" type="image/svg+xml" />`,
    ...(alternate === undefined ? [] : alternates(alternate)),
    ...assets.styles.map(
      (href) => `<link rel="stylesheet" href="${attribute(root + href)}" />`,
    ),
    ...assets.preloads.map(
      (href) => `<link rel="modulepreload" href="${attribute(root + href)}" />`,
    ),
    // Fonts are fetched in CORS mode, so a preload must be too.
    ...(assets.fonts ?? []).map(
      (href) =>
        `<link rel="preload" href="${attribute(root + href)}" as="font" type="font/woff2" crossorigin />`,
    ),
    ...assets.scripts.map(
      (src) => `<script type="module" src="${attribute(root + src)}"></script>`,
    ),
  ];
  const link = (href: string, label: string, here: boolean) =>
    `<li><a href="${attribute(href)}"${here ? ' aria-current="page"' : ''}>${text(label)}</a></li>`;
  const item = (href: string, label: string) =>
    `<li><a href="${attribute(href)}">${text(label)}</a></li>`;
  const switchHref = root + PREFIX[other] + (alternate ?? '');
  return `<!doctype html>
<html lang="${LANG[locale]}">
  <head>
    ${head.join('\n    ')}
  </head>
  <body>
    <a class="skip" href="#main">${text(t.skip)}</a>
    <header class="bar">
      <a class="mark" href="${attribute(home || './')}">${GLYPH}<span>algomotion</span></a>
      <nav aria-label="${attribute(t.siteNav)}">
        <ul>
          ${link(`${home}why/`, t.nav.why, section === 'why')}
          ${link(`${home}guide/`, t.nav.guide, section === 'guide')}
          ${link(`${home}algorithms/`, t.nav.algorithms, section === 'algorithms')}
          ${link(`${home}themes/`, t.nav.themes, section === 'themes')}
          ${link(REPOSITORY, 'GitHub', false)}
          <li class="lang-switch"><a href="${attribute(switchHref || './')}" hreflang="${LANG[other]}" lang="${LANG[other]}">${text(t.switchTo)}</a></li>
        </ul>
      </nav>
    </header>
    <main id="main"${layout === undefined ? '' : ` class="${attribute(layout)}"`}>
${body}
    </main>
    <footer>
      <div class="columns">
        <section aria-labelledby="f-use">
          <h2 id="f-use">${text(f.useIt)}</h2>
          <ul>
            ${item(`${home}guide/web/`, f.web)}
            ${item(`${home}guide/typst/`, f.typst)}
            ${item(`${home}guide/latex/`, f.latex)}
            ${item(`${home}guide/slides/`, f.slides)}
          </ul>
        </section>
        <section aria-labelledby="f-more">
          <h2 id="f-more">${text(f.moreWays)}</h2>
          <ul>
            ${item(`${home}guide/cli/`, f.cli)}
            ${item(`${home}guide/ai/`, f.ai)}
            ${item(`${home}guide/share-links/`, f.shareLinks)}
            ${item(`${root}play/`, f.sharePage)}
          </ul>
        </section>
        <section aria-labelledby="f-learn">
          <h2 id="f-learn">${text(f.reference)}</h2>
          <ul>
            ${item(`${home}guide/inputs/`, f.inputs)}
            ${item(`${home}guide/documents/`, f.documents)}
            ${item(`${home}algorithms/`, f.algorithms)}
            ${item(`${home}themes/`, f.themes)}
          </ul>
        </section>
        <section aria-labelledby="f-project">
          <h2 id="f-project">${text(f.project)}</h2>
          <ul>
            ${item(`${home}why/`, f.why)}
            ${item(REPOSITORY, f.source)}
            ${item(`${home}changelog/`, f.changelog)}
            ${item(`${home}roadmap/`, f.roadmap)}
            ${item(`${home}contributing/`, f.contributing)}
            ${item(`${home}contributing/#report`, f.report)}
            ${item(`${REPOSITORY}/tree/main/docs/adr`, f.designRecords)}
          </ul>
        </section>
      </div>
      <div class="colophon">
        <p>${text(f.colophon)}</p>
        ${buildLine(assets.build, home, f)}
      </div>
    </footer>
  </body>
</html>
`;
}

/** `../` once per folder: the way back to the site's root. */
export const rootOf = (depth: number): string => '../'.repeat(depth);
