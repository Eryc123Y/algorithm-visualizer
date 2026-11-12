/**
 * The player's web fonts (ADR 0030). The faces of every built-in theme are
 * WOFF2 files in `fonts/`, next to this module, declared with
 * `unicode-range` in `fonts/fonts.css`, so a browser downloads only the
 * files whose characters a page draws. The stylesheet is linked from the
 * document's head, because Chromium ignores `@font-face` in shadow roots.
 */

/** The stylesheet, relative to this module. */
const STYLESHEET = 'fonts/fonts.css';

/**
 * The stylesheet next to this module, or null where the module has no URL
 * to resolve it against.
 */
export function defaultFontsUrl(): string | null {
  // The base is a variable, so bundlers leave the URL to run time instead
  // of inlining the stylesheet.
  const base = import.meta.url;
  try {
    return new URL(STYLESHEET, base).href;
  } catch {
    return null;
  }
}

/**
 * Links the stylesheet `href` from the document's head, once per document;
 * null links nothing. Without a document, as on a server, it does nothing.
 */
export function linkFonts(
  href: string | null,
  doc: Document | undefined = globalThis.document,
): void {
  if (href === null || doc === undefined) return;
  if (doc.head.querySelector('link[data-algomotion-fonts]') !== null) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset['algomotionFonts'] = '';
  doc.head.append(link);
}
