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

export interface PageFrame {
  readonly title: string;
  readonly description: string;
  /** The way back to the site's root: `../` per folder, or `/`. */
  readonly root: string;
  readonly assets: Assets;
  readonly body: string;
}

/** A whole page. Its Content Security Policy is added after the charset. */
export function page({
  title,
  description,
  root,
  assets,
  body,
}: PageFrame): string {
  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light dark" />',
    `<meta name="description" content="${attribute(description)}" />`,
    `<title>${text(title)}</title>`,
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
  return `<!doctype html>
<html lang="en">
  <head>
    ${head.join('\n    ')}
  </head>
  <body>
    <a class="skip" href="#main">Skip to the content</a>
    <header class="bar">
      <a class="mark" href="${root || './'}">algomotion</a>
      <nav aria-label="Site">
        <a href="${root}#catalog">Algorithms</a>
        <a href="${root}themes/">Themes</a>
        <a href="${root}play/">Share page</a>
      </nav>
    </header>
    <main id="main">
${body}
    </main>
    <footer>
      Generated from the algomotion registry. Every figure is drawn by algomotion’s own engine.
    </footer>
  </body>
</html>
`;
}

/** `../` once per folder: the way back to the site's root. */
export const rootOf = (depth: number): string => '../'.repeat(depth);
