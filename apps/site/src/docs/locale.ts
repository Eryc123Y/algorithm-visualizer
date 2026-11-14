/**
 * The site's languages (roadmap 5.7). English pages sit at the root;
 * each has a Simplified Chinese counterpart under `zh/` at the same path,
 * except the module pages and the share page, which stay English until
 * 5.8 puts Chinese in the product. Layout code is shared: a page takes
 * its locale and a table of strings typed once for both languages, so a
 * string missing in one of them does not compile.
 */

export type Locale = 'en' | 'zh';

export const LOCALES: readonly Locale[] = ['en', 'zh'];

/** The `lang` and `hreflang` of each locale. */
export const LANG: Readonly<Record<Locale, string>> = {
  en: 'en',
  zh: 'zh-Hans',
};

/** Where a locale's pages live, relative to the site's root. */
export const PREFIX: Readonly<Record<Locale, string>> = { en: '', zh: 'zh/' };

/**
 * The site's address, for `hreflang` alternates, which search engines
 * want absolute. Every other link on the site stays relative.
 */
export const SITE_URL = 'https://algomotion.turing2234.com/';

/** The other locale. */
export const otherLocale = (locale: Locale): Locale =>
  locale === 'en' ? 'zh' : 'en';

/** `../` once per folder of `path` (`guide/web/` is two). */
export const depthOf = (path: string): number =>
  path.split('/').filter((s) => s !== '' && !s.endsWith('.html')).length;

/**
 * The roots of a page at `path` within `locale`: `site` leads to the
 * site's root (assets, module pages, the share page), `home` to the
 * locale's own root (its other pages).
 */
export function rootsOf(
  locale: Locale,
  path: string,
): { readonly site: string; readonly home: string } {
  const site = '../'.repeat(depthOf(PREFIX[locale] + path));
  return { site, home: site + PREFIX[locale] };
}

/**
 * English pages that have no Chinese counterpart yet, by path; the build
 * fails on any other English page without one. Empty once 5.7 is done.
 */
export const PENDING_ZH: readonly string[] = [];

/**
 * The English pages, by path, that lack a Chinese counterpart: every page
 * needs one except those in `englishOnly` and the pending ones.
 */
export function missingCounterparts(
  englishPages: readonly string[],
  englishOnly: ReadonlySet<string>,
  hasChinese: (path: string) => boolean,
  pending: readonly string[] = PENDING_ZH,
): string[] {
  return englishPages.filter(
    (path) =>
      !englishOnly.has(path) && !pending.includes(path) && !hasChinese(path),
  );
}
