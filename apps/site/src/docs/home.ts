/**
 * The home page: what algomotion does, shown before it is told. A live
 * player, the same run as a plate of figures, the run written for each
 * output, the themes, and the way into the catalogue.
 */
import type { TopicGroup } from './catalog.ts';
import { highlighted, SNIPPET_LANGUAGES } from './highlight.ts';
import { homeWhy } from './home-why.ts';
import { attribute, page, text, type Assets } from './html.ts';
import { sceneFigure, type SceneManifest } from './scenes.ts';
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
}

/** One subfigure of the plate. */
export interface PlateFigure extends Art {
  /** The step, as a selector: `extract#2`. */
  readonly step: string;
}

export interface HomeArt {
  readonly plate: readonly PlateFigure[];
  /** The figure each output's tab shows. */
  readonly outputs: Readonly<Partial<Record<Snippet['id'], Art>>>;
  /** Overlays of a slide, in order. */
  readonly slides: readonly Art[];
  readonly themes: readonly { readonly name: string; readonly art: Art }[];
  /** Real scenes (roadmap 5.3), shown instead of plain figures. */
  readonly scenes?: SceneManifest;
}

/** A `<picture>` that follows the reader's light or dark setting. */
export function picture(art: Art, root: string, loading = 'lazy'): string {
  return `<picture><source srcset="${attribute(root + art.dark)}" media="(prefers-color-scheme: dark)" /><img src="${attribute(root + art.light)}" width="${art.width}" height="${art.height}" alt="${attribute(art.alt)}" loading="${loading}" decoding="async" /></picture>`;
}

const LETTERS = 'abcdefghij';

/** What each output's tab is called, and the guide that explains it. */
const OUTPUTS: readonly {
  readonly id: Snippet['id'] | 'slides';
  readonly tab: string;
  readonly guide: string;
  readonly lede: string;
}[] = [
  {
    id: 'web',
    tab: 'Web page',
    guide: 'guide/web/',
    lede: 'One script and one element. The player has step controls, the code with its current line, narration, keyboard shortcuts, and light and dark themes.',
  },
  {
    id: 'typst',
    tab: 'Typst',
    guide: 'guide/typst/',
    lede: 'A function call in your notes draws the step you name as a vector figure. The engine runs inside the package, so there is nothing else to install.',
  },
  {
    id: 'latex',
    tab: 'LaTeX',
    guide: 'guide/latex/',
    lede: 'A command draws the figure in TikZ, so its text is set in your document’s own fonts. Figures are cached, so later runs need no shell escape.',
  },
  {
    id: 'slides',
    tab: 'Slides',
    guide: 'guide/slides/',
    lede: 'In Beamer, the steps key turns a figure into overlays of one picture, one slide per step. In Typst, algomotion-slides does the same with polylux’s or Touying’s only.',
  },
  {
    id: 'cli',
    tab: 'Command line',
    guide: 'guide/cli/',
    lede: 'Export any frames as SVG or TikZ files, run an algorithm to a JSON document, or check a document you wrote. A standalone build needs no Node.js.',
  },
  {
    id: 'mcp',
    tab: 'AI assistants',
    guide: 'guide/ai/',
    lede: 'Connect Claude or any MCP client, and ask. The model runs the algorithm with the tools and shows the player right in the conversation.',
  },
  {
    id: 'link',
    tab: 'Share link',
    guide: 'guide/share-links/',
    lede: 'A link carries the whole run after the #, so it opens in any browser and no server stores it. Paste it in a course page or a chat.',
  },
];

/** A code block with a copy button, as on the module pages. */
const snippetBlock = (s: Snippet): string =>
  `<div class="snippet" data-snippet="${s.id}" data-label="${attribute(s.label)}">
  <pre tabindex="0" role="region" aria-label="${attribute(s.label)}"><code>${highlighted(s.code, SNIPPET_LANGUAGES[s.id])}</code></pre>
</div>`;

/** The real scene of an output, where there is one. */
function realScene(
  id: (typeof OUTPUTS)[number]['id'],
  scenes: SceneManifest,
): string {
  switch (id) {
    case 'typst':
      return sceneFigure(
        scenes,
        'notes',
        '',
        'A page of notes, as Typst compiles it.',
        'output-figure scene',
      );
    case 'slides':
      return sceneFigure(
        scenes,
        'beamer',
        '',
        'Three overlays of one Beamer frame, from <code>steps=extract\\#2..improve\\#3</code>, as <code>latexmk</code> compiles them.',
        'output-figure scene',
      );
    case 'cli':
      return sceneFigure(
        scenes,
        'terminal',
        '',
        'The command, run: what it printed.',
        'output-figure scene',
      );
    case 'mcp':
      return sceneFigure(
        scenes,
        'chat',
        '',
        'The player after a real <code>algomotion_show</code> call, in a minimal MCP Apps host.',
        'output-figure scene',
      );
    default:
      return '';
  }
}

function preview(
  id: (typeof OUTPUTS)[number]['id'],
  art: HomeArt,
  snippet: Snippet | undefined,
): string {
  const scene = art.scenes === undefined ? '' : realScene(id, art.scenes);
  if (scene !== '') return scene;
  if (id === 'slides')
    return `<ol class="overlays" aria-label="Three overlays of one slide">${art.slides
      .map(
        (a, k) =>
          `<li><span class="overlay-n">${k + 1}</span>${picture(a, '')}</li>`,
      )
      .join('')}</ol>`;
  if (id === 'mcp')
    return `<div class="chat" role="group" aria-label="A conversation with an AI assistant">
  <p class="said said-you"><span class="speaker">You</span> Show me Dijkstra’s algorithm from A on A-B 4, B-C 1, A-C 7, C-D 2.</p>
  <p class="said said-tool"><span class="speaker">Tool</span> <code>algomotion_show</code> ran <code>dijkstra</code>: 14 steps.</p>
  ${art.outputs.mcp === undefined ? '' : `<div class="said said-player">${picture(art.outputs.mcp, '')}</div>`}
  <p class="said said-model"><span class="speaker">Assistant</span> Here it is. At step 7, C drops from 7 to 5: going through B is shorter than the direct edge. Step through it, and ask about any step.</p>
</div>`;
  const a = art.outputs[id as Snippet['id']];
  if (a === undefined) return '';
  const caption =
    id === 'link'
      ? 'The link opens this player, in any browser.'
      : id === 'web'
        ? 'The element, as the reader sees it.'
        : snippet === undefined
          ? ''
          : `The example run, as the ${OUTPUTS.find((o) => o.id === id)!.tab} snippet draws it.`;
  return `<figure class="output-figure">${picture(a, '')}<figcaption>${text(caption)}</figcaption></figure>`;
}

function outputTabs(
  snippets: readonly Snippet[],
  slides: string,
  art: HomeArt,
): string {
  const tabs = OUTPUTS.map(
    (o, k) =>
      `<button type="button" role="tab" id="tab-${o.id}" aria-selected="${k === 0}"${k === 0 ? ' focusgroupstart' : ' tabindex="-1"'}>${text(o.tab)}</button>`,
  ).join('');
  const panels = OUTPUTS.map((o, k) => {
    const snippet = snippets.find((s) => s.id === o.id);
    const code =
      o.id === 'slides'
        ? snippetBlock({
            id: 'latex',
            label: 'In slides',
            code: slides,
            note: '',
          })
        : snippet === undefined
          ? ''
          : snippetBlock(snippet);
    return `<div role="tabpanel" id="panel-${o.id}" aria-labelledby="tab-${o.id}"${k === 0 ? '' : ' hidden="until-found"'}>
  <div class="panel">
    <div class="panel-text">
      <p>${text(o.lede)}</p>
      ${code}
      <p class="panel-more"><a href="${attribute(o.guide)}">The ${text(o.tab)} guide</a></p>
    </div>
    <div class="panel-preview">${preview(o.id, art, snippet)}</div>
  </div>
</div>`;
  }).join('\n');
  return `<div class="tabs">
  <div role="tablist" focusgroup="tablist nomemory" aria-label="Outputs">${tabs}</div>
  <div class="panels">
${panels}
  </div>
</div>`;
}

function plate(art: HomeArt): string {
  const figures = art.plate
    .map(
      (f, k) =>
        `<li><span class="sub">(${LETTERS[k]})</span>${picture(f, '')}<code class="sub-step">${text(f.step)}</code></li>`,
    )
    .join('\n');
  const caption = art.plate
    .map((f, k) => `<b>(${LETTERS[k]})</b> ${text(f.alt)}`)
    .join(' ');
  return `<section class="plate bleed" aria-labelledby="plate-title">
  <div class="plate-inner">
    <div class="plate-head">
      <h2 id="plate-title">The same run, as figures for your notes</h2>
      <p>Every step has a name, so a figure can be asked for by what happens in it: <code>extract#2</code> is the second vertex taken from the queue. Each one is a vector figure, in the theme you pick.</p>
    </div>
    <figure class="plate-figure">
      <ol class="subfigures">
${figures}
      </ol>
      <figcaption><b>Figure 1.</b> Dijkstra’s algorithm from A on the graph above. ${caption}</figcaption>
    </figure>
  </div>
</section>`;
}

const AUDIENCES = `<section class="audiences" aria-labelledby="who-title">
  <h2 id="who-title">Made for the places algorithms are taught</h2>
  <div class="who">
    <div>
      <h3>Students</h3>
      <p>Put the exact step you are writing about into your Typst or LaTeX notes, on your own input, and have it look like the textbook.</p>
      <p><a href="guide/typst/">Figures in notes</a></p>
    </div>
    <div>
      <h3>Teachers</h3>
      <p>Step through a run on a slide, one click per step, or hand out a link that plays it. Themes for print, exams and dark rooms.</p>
      <p><a href="guide/slides/">Figures on slides</a></p>
    </div>
    <div>
      <h3>Developers and models</h3>
      <p>Embed the player in any page, or let a model write and check a visualization through MCP, then show it in the chat.</p>
      <p><a href="guide/ai/">Connect an assistant</a></p>
    </div>
  </div>
</section>`;

function themesStrip(art: HomeArt): string {
  return `<section class="theme-strip" aria-labelledby="themes-title">
  <div class="section-head">
    <h2 id="themes-title">Nine themes, every output</h2>
    <p>The same figure for a screen, a handout, a highlighter-marked textbook page or the blue screen of a computer lab. <a href="themes/">See how to pick one</a>.</p>
  </div>
  <ul class="theme-thumbs" tabindex="0" aria-label="The nine themes">
${art.themes
  .map(
    (t) =>
      `    <li><figure><img src="${attribute(t.art.light)}" width="${t.art.width}" height="${t.art.height}" alt="${attribute(t.art.alt)}" loading="lazy" decoding="async" /><figcaption><code>${text(t.name)}</code></figcaption></figure></li>`,
  )
  .join('\n')}
  </ul>
</section>`;
}

function catalogTeaser(groups: readonly TopicGroup[], count: number): string {
  const items = groups
    .map((g) => {
      const n = g.algorithms.length + g.structures.length;
      const names = [...g.algorithms, ...g.structures.map((s) => s.entry)]
        .slice(0, 3)
        .map((e) => text(e.title))
        .join(', ');
      return `<li><a href="algorithms/#topic-${g.topic}">${text(g.title)}</a> <span class="n">${n}</span><p>${names}${n > 3 ? ', …' : ''}</p></li>`;
    })
    .join('\n');
  return `<section class="teaser" aria-labelledby="teaser-title">
  <div class="section-head">
    <h2 id="teaser-title">${count} algorithms and data structures</h2>
    <p>The undergraduate canon, from insertion sort to maximum flow, each with its own page, player and snippets. Data structures come with every operation on its own.</p>
  </div>
  <ul class="topics">
${items}
  </ul>
  <p><a class="button" href="algorithms/">Browse all ${count}</a></p>
</section>`;
}

/** The home page. */
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
): string {
  return page({
    title: 'algomotion: step-by-step algorithms',
    description:
      'Step-by-step pictures and animations of algorithms and data structures, from one algorithm name and your input, for web pages, Typst, LaTeX, slides and AI conversations.',
    root: '',
    assets,
    section: 'home',
    layout: 'home',
    body: `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-text">
    <h1 id="hero-title">Every step of an algorithm, drawn.</h1>
    <p class="lede">Name an algorithm and give it your input, in the notation you already write. algomotion runs it and draws each step: an animation for a web page, figures for Typst and LaTeX notes, overlays for slides, and a player inside AI conversations.</p>
    <p class="actions"><a class="button" href="guide/">Get started</a> <a class="button quiet" href="algorithms/">Browse ${count} algorithms</a></p>
    <p class="fine">Open source. The player runs in the reader’s browser, and share links carry their run in the link itself.</p>
  </div>
  <div class="hero-player">
    ${player}
  </div>
</section>
${plate(art)}
<section class="outputs" aria-labelledby="outputs-title">
  <div class="section-head">
    <h2 id="outputs-title">One input, wherever you write</h2>
    <p>The run above, written for each place it can go: change the algorithm or its input, and every snippet follows. Every output draws with the same engine, so a figure in your notes matches the player on your course page.</p>
  </div>
  ${outputTabs(demo.snippets, slides, art)}
</section>
${homeWhy()}
${AUDIENCES}
${themesStrip(art)}
${catalogTeaser(groups, count)}`,
  });
}
