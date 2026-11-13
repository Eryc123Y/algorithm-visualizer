/**
 * HTML for the generated pages: escaping, and the frame every page shares.
 * Every value that comes from the registry goes through `text` or
 * `attribute`, so no title or summary can become markup.
 */

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

/** The files a page loads, relative to the site's root. */
export interface Assets {
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
  /** Modules the script imports, preloaded. */
  readonly preloads: readonly string[];
}

/** The site's sections, for the bar's current-page mark. */
export type Section = 'home' | 'guide' | 'algorithms' | 'themes';

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
}

/** The project's repository. */
export const REPOSITORY = 'https://github.com/Eryc123Y/algorithm-visualizer';

/**
 * The wordmark's glyph, a placeholder until the owner picks a logo: a play
 * head over a sorted run of bars. It is decorative; the link's name is the
 * word beside it.
 */
const GLYPH = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="glyph-now" d="M22 8H42L32 20Z"/><g class="glyph-bars"><rect x="12" y="40" width="10" height="14"/><rect x="27" y="30" width="10" height="24"/><rect x="42" y="20" width="10" height="34"/></g></svg>`;

/** A whole page. Its Content Security Policy is added after the charset. */
export function page({
  title,
  description,
  root,
  assets,
  body,
  section,
  layout,
}: PageFrame): string {
  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light dark" />',
    `<meta name="description" content="${attribute(description)}" />`,
    `<title>${text(title)}</title>`,
    `<link rel="icon" href="${attribute(root)}favicon.svg" type="image/svg+xml" />`,
    ...assets.styles.map(
      (href) => `<link rel="stylesheet" href="${attribute(root + href)}" />`,
    ),
    ...assets.preloads.map(
      (href) => `<link rel="modulepreload" href="${attribute(root + href)}" />`,
    ),
    ...assets.scripts.map(
      (src) => `<script type="module" src="${attribute(root + src)}"></script>`,
    ),
  ];
  const home = root || './';
  const link = (href: string, label: string, here: boolean) =>
    `<li><a href="${attribute(href)}"${here ? ' aria-current="page"' : ''}>${text(label)}</a></li>`;
  return `<!doctype html>
<html lang="en">
  <head>
    ${head.join('\n    ')}
  </head>
  <body>
    <a class="skip" href="#main">Skip to the content</a>
    <header class="bar">
      <a class="mark" href="${attribute(home)}">${GLYPH}<span>algomotion</span></a>
      <nav aria-label="Site">
        <ul>
          ${link(`${root}guide/`, 'Guide', section === 'guide')}
          ${link(`${root}algorithms/`, 'Algorithms', section === 'algorithms')}
          ${link(`${root}themes/`, 'Themes', section === 'themes')}
          ${link(REPOSITORY, 'GitHub', false)}
        </ul>
      </nav>
    </header>
    <main id="main"${layout === undefined ? '' : ` class="${attribute(layout)}"`}>
${body}
    </main>
    <footer>
      <div class="columns">
        <section aria-labelledby="f-use">
          <h2 id="f-use">Use it</h2>
          <ul>
            <li><a href="${root}guide/web/">On a web page</a></li>
            <li><a href="${root}guide/typst/">In Typst</a></li>
            <li><a href="${root}guide/latex/">In LaTeX</a></li>
            <li><a href="${root}guide/slides/">In slides</a></li>
          </ul>
        </section>
        <section aria-labelledby="f-more">
          <h2 id="f-more">More ways</h2>
          <ul>
            <li><a href="${root}guide/cli/">Command line</a></li>
            <li><a href="${root}guide/ai/">AI assistants</a></li>
            <li><a href="${root}guide/share-links/">Share links</a></li>
            <li><a href="${root}play/">Share page</a></li>
          </ul>
        </section>
        <section aria-labelledby="f-learn">
          <h2 id="f-learn">Reference</h2>
          <ul>
            <li><a href="${root}guide/inputs/">Inputs</a></li>
            <li><a href="${root}guide/documents/">Documents</a></li>
            <li><a href="${root}algorithms/">Algorithms</a></li>
            <li><a href="${root}themes/">Themes</a></li>
          </ul>
        </section>
        <section aria-labelledby="f-project">
          <h2 id="f-project">Project</h2>
          <ul>
            <li><a href="${REPOSITORY}">Source on GitHub</a></li>
            <li><a href="${REPOSITORY}/issues">Report a problem</a></li>
            <li><a href="${REPOSITORY}/tree/main/docs/adr">Design records</a></li>
          </ul>
        </section>
      </div>
      <p class="colophon">Every figure on this site is drawn by algomotion’s own engine, from the same registry the packages ship.</p>
    </footer>
  </body>
</html>
`;
}

/** `../` once per folder: the way back to the site's root. */
export const rootOf = (depth: number): string => '../'.repeat(depth);
