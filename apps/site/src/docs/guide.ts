/**
 * The guide: one page per way of using algomotion, in reading order, with
 * a sidebar to the others. Each page is written in `guides/`, as HTML built
 * with the helpers here; its figures are drawn by the engine at build time
 * (`scripts/build-pages.ts`), so they always match the code.
 */
import type { ThemeName } from '@algomotion/svg';

import { picture, type Art } from './home.ts';
import { highlighted, languageOf } from './highlight.ts';
import { attribute, page, text, type Assets } from './html.ts';

/** A figure a guide page shows: a run's step, drawn by the engine. */
export interface GuideFigure {
  /** Unique within the page; names the files. */
  readonly key: string;
  readonly algorithm: string;
  /** The input, as text in a notation (ADR 0032). */
  readonly input: string;
  /** A step selector (ADR 0020); `-1` is the last frame. */
  readonly step: string;
  /** A fixed theme; otherwise the light and dark themes. */
  readonly theme?: ThemeName;
  /** What the figure shows, for readers who cannot see it. */
  readonly alt: string;
}

/** What a page's body is written with. */
export interface GuideContext {
  /** The way back to the site's root. */
  readonly root: string;
  /** A figure declared in the page's `figures`, with its caption. */
  figure(this: void, key: string, caption: string): string;
  /** A code block with a copy button; `label` names it for the button. */
  code(this: void, code: string, label: string): string;
  /** A note set apart from the text: a tip, or a limit to know about. */
  note(this: void, html: string): string;
}

export interface Guide {
  /** The folder under `guide/`; empty for the guide's first page. */
  readonly slug: string;
  readonly title: string;
  /** The sidebar's shorter name. */
  readonly nav: string;
  /** One sentence: the page's description and lede. */
  readonly summary: string;
  readonly figures?: readonly GuideFigure[];
  /** The page's sections, as HTML, starting at `<h2>`. */
  body(context: GuideContext): string;
}

/** The sidebar's groups, by slug, in reading order. */
export const GUIDE_GROUPS: readonly {
  readonly title: string;
  readonly slugs: readonly string[];
}[] = [
  { title: 'Start', slugs: ['', 'inputs'] },
  { title: 'Outputs', slugs: ['web', 'typst', 'latex', 'slides', 'cli'] },
  { title: 'Sharing and AI', slugs: ['ai', 'share-links'] },
  { title: 'Reference', slugs: ['documents'] },
];

/** The files of a drawn guide figure, relative to the site's root. */
export const figureFiles = (
  slug: string,
  key: string,
): { light: string; dark: string } => {
  const stem = `guide/${slug === '' ? '' : `${slug}/`}${key}`;
  return { light: `${stem}-light.svg`, dark: `${stem}-dark.svg` };
};

/** A guide page, with the sidebar and the next page. */
export function guidePage(
  guide: Guide,
  guides: readonly Guide[],
  art: Readonly<Record<string, Art>>,
  assets: Assets,
): string {
  const depth = guide.slug === '' ? 1 : 2;
  const root = '../'.repeat(depth);
  const href = (slug: string) =>
    `${root}guide/${slug === '' ? '' : `${slug}/`}`;
  const context: GuideContext = {
    root,
    figure(key, caption) {
      const a = art[key];
      if (a === undefined)
        throw new Error(`guide/${guide.slug}: no figure ${key}`);
      return `<figure class="guide-figure">${picture(a, root)}<figcaption>${caption}</figcaption></figure>`;
    },
    code(code, label) {
      return `<div class="snippet" data-snippet="guide" data-label="${attribute(label)}"><pre tabindex="0" role="region" aria-label="${attribute(label)}"><code>${highlighted(code, languageOf(code))}</code></pre></div>`;
    },
    note(html) {
      return `<aside class="note">${html}</aside>`;
    },
  };
  const bySlug = new Map(guides.map((g) => [g.slug, g]));
  const sidebar = GUIDE_GROUPS.map(
    (group) =>
      `<li><span class="side-group">${text(group.title)}</span><ul>${group.slugs
        .map((slug) => bySlug.get(slug))
        .filter((g): g is Guide => g !== undefined)
        .map(
          (g) =>
            `<li><a href="${attribute(href(g.slug))}"${g === guide ? ' aria-current="page"' : ''}>${text(g.nav)}</a></li>`,
        )
        .join('')}</ul></li>`,
  ).join('');
  const order = GUIDE_GROUPS.flatMap((g) => g.slugs);
  const at = order.indexOf(guide.slug);
  const previous = at > 0 ? bySlug.get(order[at - 1]!) : undefined;
  const next = bySlug.get(order[at + 1] ?? '\0');
  const pager = `<nav class="pager" aria-label="Guide pages">${
    previous === undefined
      ? '<span></span>'
      : `<a rel="prev" href="${attribute(href(previous.slug))}"><span>Previous</span>${text(previous.nav)}</a>`
  }${
    next === undefined
      ? ''
      : `<a rel="next" href="${attribute(href(next.slug))}"><span>Next</span>${text(next.nav)}</a>`
  }</nav>`;
  return page({
    title:
      guide.slug === '' ? 'Guide · algomotion' : `${guide.title} · algomotion`,
    description: guide.summary,
    root,
    assets,
    section: 'guide',
    layout: 'guide',
    body: `<nav class="side" aria-label="Guide"><ul>${sidebar}</ul></nav>
<article class="guide-body">
<h1>${text(guide.title)}</h1>
<p class="lede">${text(guide.summary)}</p>
${guide.body(context)}
${pager}
</article>`,
  });
}
