/**
 * The home page: what algomotion does, shown before it is told. A live
 * player, the same run told step by step, the run written for each
 * output, the themes, and the way into the catalogue.
 */
import type { TopicGroup } from './catalog.ts';
import { highlighted, SNIPPET_LANGUAGES } from './highlight.ts';
import { homeWhy } from './home-why.ts';
import { attribute, page, text, type Assets } from './html.ts';
import { rootsOf, type Locale } from './locale.ts';
import { sceneFigure, type SceneManifest, type SceneName } from './scenes.ts';
import { CHROME, type ChromeText } from './text/chrome.ts';
import { HOME, type HomeText, type OutputId } from './text/home.ts';
import type { EntryDetails } from './pages.ts';
import type { Snippet } from './snippets.ts';

/** A figure drawn for the page, in the light and the dark theme. */
export interface Art {
  readonly light: string;
  readonly dark: string;
  readonly width: number;
  readonly height: number;
  /** What the figure shows, for its alternative text and caption. */
  readonly alt: string;
  /**
   * The one theme it was drawn in, if not a light and dark pair: it is
   * then shown on that theme's paper, as a sheet (`sheet`).
   */
  readonly theme?: string;
}

/** One step of the home page's story. */
export interface StoryFrame extends Art {
  /** The step's most specific selector: `improve#3`. */
  readonly step: string;
  /** The step's narration, the figure's caption. */
  readonly narration: string;
}

export interface HomeArt {
  /** Every step of the home page's run, in order: frames 1 to the last. */
  readonly story: readonly StoryFrame[];
  /** The figure each output's tab shows. */
  readonly outputs: Readonly<Partial<Record<Snippet['id'], Art>>>;
  /** Overlays of a slide, in order. */
  readonly slides: readonly Art[];
  readonly themes: readonly { readonly name: string; readonly art: Art }[];
  /** Real scenes (roadmap 5.3), shown instead of plain figures. */
  readonly scenes?: SceneManifest;
}

/**
 * Markup on the paper of `theme`, padded like a sheet, in either colour
 * scheme; without a theme, the markup alone. Each theme's paper is a
 * `.sheet-<name>` rule in docs.css, pinned to the theme by a unit test.
 */
export function sheet(theme: string | undefined, html: string): string {
  return theme === undefined
    ? html
    : `<span class="sheet sheet-${attribute(theme)}">${html}</span>`;
}

/**
 * A `<picture>` that follows the reader's light or dark setting; a figure
 * in one fixed theme sits on its own paper instead.
 */
export function picture(art: Art, root: string, loading = 'lazy'): string {
  return sheet(art.theme, pictureOf(art, root, loading));
}

function pictureOf(art: Art, root: string, loading: string): string {
  return `<picture><source srcset="${attribute(root + art.dark)}" media="(prefers-color-scheme: dark)" /><img src="${attribute(root + art.light)}" width="${art.width}" height="${art.height}" alt="${attribute(art.alt)}" loading="${loading}" decoding="async" /></picture>`;
}

/** The outputs, in tab order, and the guide that explains each. */
const OUTPUTS: readonly { readonly id: OutputId; readonly guide: string }[] = [
  { id: 'web', guide: 'guide/web/' },
  { id: 'typst', guide: 'guide/typst/' },
  { id: 'latex', guide: 'guide/latex/' },
  { id: 'slides', guide: 'guide/slides/' },
  { id: 'cli', guide: 'guide/cli/' },
  { id: 'mcp', guide: 'guide/ai/' },
  { id: 'link', guide: 'guide/share-links/' },
];

/** A code block with a copy button, as on the module pages. */
const snippetBlock = (s: Snippet): string =>
  `<div class="snippet" data-snippet="${s.id}" data-label="${attribute(s.label)}">
  <pre tabindex="0" role="region" aria-label="${attribute(s.label)}"><code>${highlighted(s.code, SNIPPET_LANGUAGES[s.id])}</code></pre>
</div>`;

/** The real scene of an output, where there is one. */
function realScene(
  id: OutputId,
  scenes: SceneManifest,
  t: HomeText['outputs']['scenes'],
  site: string,
  locale: Locale,
): string {
  const scene = (name: SceneName, caption: string) =>
    sceneFigure(scenes, name, site, caption, 'output-figure scene', locale);
  switch (id) {
    case 'typst':
      return scene('notes', t.notes);
    case 'slides':
      return scene('beamer', t.beamer);
    case 'cli':
      return scene('terminal', t.terminal);
    case 'mcp':
      return scene('chat', t.chat);
    default:
      return '';
  }
}

function preview(
  id: OutputId,
  art: HomeArt,
  snippet: Snippet | undefined,
  t: HomeText['outputs'],
  site: string,
  locale: Locale,
): string {
  const scene =
    art.scenes === undefined
      ? ''
      : realScene(id, art.scenes, t.scenes, site, locale);
  if (scene !== '') return scene;
  if (id === 'slides')
    return `<ol class="overlays" aria-label="${attribute(t.overlays)}">${art.slides
      .map(
        (a, k) =>
          `<li><span class="overlay-n">${k + 1}</span>${picture(a, site)}</li>`,
      )
      .join('')}</ol>`;
  if (id === 'mcp')
    return `<div class="chat" role="group" aria-label="${attribute(t.chat.label)}">
  <p class="said said-you"><span class="speaker">${text(t.chat.you)}</span> ${text(t.chat.asked)}</p>
  <p class="said said-tool"><span class="speaker">${text(t.chat.tool)}</span> ${t.chat.ran}</p>
  ${art.outputs.mcp === undefined ? '' : `<div class="said said-player">${picture(art.outputs.mcp, site)}</div>`}
  <p class="said said-model"><span class="speaker">${text(t.chat.assistant)}</span> ${text(t.chat.answered)}</p>
</div>`;
  const a = art.outputs[id];
  if (a === undefined) return '';
  const caption =
    id === 'link'
      ? t.linkCaption
      : id === 'web'
        ? t.webCaption
        : snippet === undefined
          ? ''
          : t.exampleCaption(t.tabs[id].tab);
  return `<figure class="output-figure">${picture(a, site)}<figcaption>${text(caption)}</figcaption></figure>`;
}

function outputTabs(
  snippets: readonly Snippet[],
  slides: string,
  art: HomeArt,
  t: HomeText['outputs'],
  site: string,
  locale: Locale,
): string {
  const tabs = OUTPUTS.map(
    (o, k) =>
      `<button type="button" role="tab" id="tab-${o.id}" aria-selected="${k === 0}"${k === 0 ? ' focusgroupstart' : ' tabindex="-1"'}>${text(t.tabs[o.id].tab)}</button>`,
  ).join('');
  const panels = OUTPUTS.map((o, k) => {
    const snippet = snippets.find((s) => s.id === o.id);
    const code =
      o.id === 'slides'
        ? snippetBlock({
            id: 'latex',
            label: t.inSlides,
            code: slides,
            note: '',
          })
        : snippet === undefined
          ? ''
          : snippetBlock(snippet);
    return `<div role="tabpanel" id="panel-${o.id}" aria-labelledby="tab-${o.id}"${k === 0 ? '' : ' hidden="until-found"'}>
  <div class="panel">
    <div class="panel-text">
      <p>${text(t.tabs[o.id].lede)}</p>
      ${code}
      <p class="panel-more"><a href="${attribute(o.guide)}">${text(t.guide(t.tabs[o.id].tab))}</a></p>
    </div>
    <div class="panel-preview">${preview(o.id, art, snippet, t, site, locale)}</div>
  </div>
</div>`;
  }).join('\n');
  return `<div class="tabs">
  <div role="tablist" focusgroup="tablist nomemory" aria-label="${attribute(t.tablist)}">${tabs}</div>
  <div class="panels">
${panels}
  </div>
</div>`;
}

/**
 * Every step of the run, told in order: the steps scroll by on one side
 * while a pinned sheet on the other draws the step being read, with a ruler
 * under it (story.ts). Each step also carries its own figure, which shows
 * on narrow screens and without script.
 */
function story(art: HomeArt, t: HomeText['plate'], site: string): string {
  const count = art.story.length;
  const steps = art.story
    .map(
      (f, k) => `      <li class="story-step" data-frame="${k + 1}">
        <p class="story-label"><span class="sub">${text(t.figure)}${k + 1}</span> <code>${text(f.step)}</code></p>
        <p class="story-text">${text(f.narration)}</p>
        <div class="story-inline">${picture(f, site)}</div>
      </li>`,
    )
    .join('\n');
  const frames = art.story
    .map(
      (f, k) =>
        `<div class="story-frame${k === 0 ? ' now' : ''}" data-frame="${k + 1}">${picture({ ...f, alt: '' }, site, k < 2 ? 'eager' : 'lazy')}</div>`,
    )
    .join('');
  const cells = Array.from({ length: count }, (_, k) =>
    k === 0 ? '<span class="now"></span>' : '<span></span>',
  ).join('');
  return `<section class="story bleed" aria-labelledby="story-title" data-step="${attribute(t.step)}">
  <div class="story-inner">
    <div class="story-head">
      <h2 id="story-title">${text(t.title)}</h2>
      <p>${t.lede}</p>
    </div>
    <div class="story-body">
      <ol class="story-steps">
${steps}
      </ol>
      <div class="story-figure" aria-hidden="true">
        <div class="story-sheet">${frames}</div>
        <div class="ruler">${cells}</div>
        <p class="ruler-status"><b class="ruler-step">${text(t.caption)}</b></p>
      </div>
    </div>
  </div>
</section>`;
}

function audiences(t: HomeText['audiences']): string {
  return `<section class="audiences" aria-labelledby="who-title">
  <h2 id="who-title">${text(t.title)}</h2>
  <div class="who">
${t.who
  .map(
    (w) => `    <div>
      <h3>${text(w.title)}</h3>
      <p>${text(w.text)}</p>
      <p><a href="${attribute(w.href)}">${text(w.link)}</a></p>
    </div>`,
  )
  .join('\n')}
  </div>
</section>`;
}

function themesStrip(
  art: HomeArt,
  t: HomeText['themes'],
  site: string,
  stop: string,
): string {
  return `<section class="theme-strip" aria-labelledby="themes-title">
  <div class="section-head">
    <h2 id="themes-title">${text(t.title)}</h2>
    <p>${text(t.lede)} <a href="themes/">${text(t.how)}</a>${stop}</p>
  </div>
  <ul class="theme-thumbs" tabindex="0" aria-label="${attribute(t.list)}">
${art.themes
  .map(
    (t) =>
      `    <li><figure>${sheet(t.name, `<img src="${attribute(site + t.art.light)}" width="${t.art.width}" height="${t.art.height}" alt="${attribute(t.art.alt)}" loading="lazy" decoding="async" />`)}<figcaption><code>${text(t.name)}</code></figcaption></figure></li>`,
  )
  .join('\n')}
  </ul>
</section>`;
}

function catalogTeaser(
  groups: readonly TopicGroup[],
  count: number,
  t: HomeText['catalog'],
  topics: ChromeText['topics'],
  comma: string,
): string {
  const items = groups
    .map((g) => {
      const n = g.algorithms.length + g.structures.length;
      const names = [...g.algorithms, ...g.structures.map((s) => s.entry)]
        .slice(0, 3)
        .map((e) => text(e.title))
        .join(comma);
      return `<li><a href="algorithms/#topic-${g.topic}">${text(topics[g.topic])}</a> <span class="n">${n}</span><p>${names}${n > 3 ? `${comma}…` : ''}</p></li>`;
    })
    .join('\n');
  return `<section class="teaser" aria-labelledby="teaser-title">
  <div class="section-head">
    <h2 id="teaser-title">${text(t.title(count))}</h2>
    <p>${text(t.lede)}</p>
  </div>
  <ul class="topics">
${items}
  </ul>
  <p><a class="button" href="algorithms/">${text(t.browse(count))}</a></p>
</section>`;
}

/** The home page, in `locale`. */
export function homePage(
  groups: readonly TopicGroup[],
  demo: EntryDetails,
  art: HomeArt,
  /** The hero: the playground around its player. */
  player: string,
  /** The run as Beamer overlays, for the slides tab. */
  slides: string,
  count: number,
  assets: Assets,
  locale: Locale = 'en',
): string {
  const t = HOME[locale];
  const { site } = rootsOf(locale, '');
  const zh = locale === 'zh';
  return page({
    title: t.title,
    description: t.description,
    root: site,
    assets,
    section: 'home',
    layout: 'home',
    locale,
    alternate: '',
    body: `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-grid">
    <div class="hero-text">
      <p class="fig-label"><span>${text(t.hero.figure)}</span> <span class="fig-title"></span></p>
      <h1 id="hero-title">${text(t.hero.title)}</h1>
      <p class="lede">${text(t.hero.lede)}</p>
      <p class="actions"><a class="button" href="guide/">${text(t.hero.getStarted)}</a> <a class="button quiet" href="algorithms/">${text(t.hero.browse(count))}</a></p>
      <p class="install"><code>npm i @algomotion/elements</code></p>
      <p class="fine">${text(t.hero.fine)}</p>
    </div>
    <div class="hero-player">
      ${player}
    </div>
  </div>
</section>
${story(art, t.plate, site)}
<section class="outputs" aria-labelledby="outputs-title">
  <div class="section-head">
    <h2 id="outputs-title">${text(t.outputs.title)}</h2>
    <p>${text(t.outputs.lede)}</p>
  </div>
  ${outputTabs(demo.snippets, slides, art, t.outputs, site, locale)}
</section>
${homeWhy(t.why)}
${audiences(t.audiences)}
${themesStrip(art, t.themes, site, zh ? '。' : '.')}
${catalogTeaser(groups, count, t.catalog, CHROME[locale].topics, zh ? '、' : ', ')}`,
  });
}
