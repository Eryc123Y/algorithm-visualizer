/**
 * "Why algomotion" (roadmap 5.4): what it is for, what makes it
 * different, shown with figures the engine draws at build time, an
 * honest comparison with other ways of drawing algorithms, its limits,
 * and three walk-throughs with code that runs as written. Its words, in
 * each locale, are in text/why.ts (roadmap 5.7); the code is shared.
 */
import type { ExportOptions, ThemeName } from '@algomotion/svg';

/** Where a figure's side panel goes: beside (`wide`) or below (`narrow`). */
export type FigureLayout = NonNullable<ExportOptions['layout']>;

import { picture, type Art } from './home.ts';
import { attribute, page, text, type Assets } from './html.ts';
import { rootsOf, type Locale } from './locale.ts';
import { sceneFigure, type SceneManifest, type SceneName } from './scenes.ts';
import type { StepName } from './pages.ts';
import { CHROME } from './text/chrome.ts';
import {
  WHY,
  type WalkId,
  type WhyFigureKey,
  type WhyText,
} from './text/why.ts';

/** The run most of the page shows, as on the home page. */
export const WHY_RUN = {
  algorithm: 'dijkstra',
  input: 'A-B 4, B-C 1, A-C 7, C-D 2',
} as const;

/** A figure the page shows, drawn by the engine at build time. */
export interface WhyFigure {
  readonly key: WhyFigureKey;
  readonly algorithm: string;
  readonly input: string | Readonly<Record<string, string>>;
  readonly step: string;
  /** A fixed theme; otherwise the light and the dark theme. */
  readonly theme?: ThemeName;
  readonly layout?: FigureLayout;
  /** The English alternative text; each locale has its own in text/why.ts. */
  readonly alt: string;
}

const run = (
  key: WhyFigureKey,
  step: string,
  more: Partial<WhyFigure> = {},
): WhyFigure => ({ key, ...WHY_RUN, step, alt: WHY.en.alt[key], ...more });

export const WHY_FIGURES: readonly WhyFigure[] = [
  run('web', 'improve#3', { theme: 'blocks' }),
  run('notes', 'improve#3', { theme: 'textbook', layout: 'narrow' }),
  run('slide', 'improve#3', { theme: 'dark' }),
  run('named', 'extract#3'),
  {
    key: 'in-list',
    algorithm: 'insertion-sort',
    input: '5 2 4 6 1 3',
    step: 'insert#2',
    alt: WHY.en.alt['in-list'],
  },
  {
    key: 'in-ops',
    algorithm: 'bst',
    input: { from: '8 3 10 1 6', ops: 'insert 4, delete 3' },
    step: '-1',
    alt: WHY.en.alt['in-ops'],
  },
  run('print', 'improve#3', { theme: 'print' }),
  run('answer', 'improve#3', { theme: 'answer-sheet' }),
  run('assistant', 'improve#3'),
];

/** Facts the page states, taken from the registry at build time. */
export interface WhyFacts {
  /** The step names of `WHY_RUN`, with how often each occurs. */
  readonly steps: readonly StepName[];
  /** The narration `algomotion_inspect` returns at `improve#3`. */
  readonly checked: string;
  /** How many registry modules there are. */
  readonly modules: number;
}

/** The rows of the comparison in English: algomotion, by hand, Manim, websites. */
export const COMPARISON: WhyText['comparison']['rows'] = WHY.en.comparison.rows;

/* ── The walk-throughs ──────────────────────────────────────────────── */

export interface WalkStep {
  /** What to do, as HTML. */
  readonly html: string;
  readonly code?: string;
  readonly label?: string;
  /** Quote the narration the check returns after this step. */
  readonly reply?: boolean;
  /** A real scene of what this step makes (roadmap 5.3). */
  readonly scene?: { readonly name: SceneName; readonly caption: string };
}

export interface Walkthrough {
  readonly id: WalkId;
  readonly title: string;
  readonly who: string;
  readonly steps: readonly WalkStep[];
  /** The runs its code makes, checked by the tests. */
  readonly runs: readonly {
    readonly algorithm: string;
    readonly input: string;
    readonly steps: readonly string[];
    /** How many frames the selectors pick, if it matters. */
    readonly frames?: number;
  }[];
}

const TYPST_NOTES = `#import "@local/algomotion:0.1.0": algomotion

= Shortest paths

Dijkstra's algorithm takes the vertex with the least distance
from the queue, then relaxes its edges. Through B, C drops
from 7 to 5:

#figure(
  algomotion("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3"),
  caption: [Step \`improve#3\`: C improves to 5, through B.],
)`;

const BEAMER_SLIDES = String.raw`\documentclass{beamer}
\usepackage{algomotion}

\begin{document}
\begin{frame}{Dijkstra's algorithm}
  \centering
  \algomotion[steps=extract\#2..improve\#3]{dijkstra}{A-B 4, B-C 1, A-C 7, C-D 2}
\end{frame}
\end{document}`;

const SHOW_CALL = `algomotion_show {
  "recipe": "dijkstra",
  "input": "A-B 4, B-C 1, A-C 7, C-D 2"
}`;

const INSPECT_CALL = `algomotion_inspect {
  "recipe": "dijkstra",
  "input": "A-B 4, B-C 1, A-C 7, C-D 2",
  "frames": ["improve#3"]
}`;

/** The code of a walk-through's step, the same in every locale. */
interface WalkCode {
  readonly code?: string;
  /** The code's file name, used as its label in every locale. */
  readonly file?: string;
  readonly reply?: boolean;
  readonly scene?: SceneName;
}

/** The shared part of the walk-throughs: their code and their runs. */
const WALKS: readonly {
  readonly id: WalkId;
  readonly steps: readonly WalkCode[];
  readonly runs: Walkthrough['runs'];
}[] = [
  {
    id: 'notes',
    steps: [
      {},
      { code: TYPST_NOTES, file: 'notes.typ' },
      { code: 'typst compile notes.typ', scene: 'notes' },
    ],
    runs: [{ ...WHY_RUN, steps: ['improve#3'] }],
  },
  {
    id: 'slides',
    steps: [
      {},
      { code: BEAMER_SLIDES, file: 'slides.tex' },
      { code: 'latexmk -pdf -shell-escape slides.tex', scene: 'beamer' },
    ],
    runs: [{ ...WHY_RUN, steps: ['extract#2..improve#3'], frames: 3 }],
  },
  {
    id: 'assistant',
    steps: [
      {
        code: 'claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp',
      },
      { code: SHOW_CALL, scene: 'chat' },
      { code: INSPECT_CALL, reply: true },
    ],
    runs: [{ ...WHY_RUN, steps: ['improve#3'] }],
  },
];

/** The walk-throughs in `locale`, their links led from `root`. */
export function walkthroughs(locale: Locale, root: string): Walkthrough[] {
  const t = WHY[locale].walks.list;
  return WALKS.map((w) => {
    const words = t[w.id];
    return {
      id: w.id,
      title: words.title,
      who: words.who,
      runs: w.runs,
      steps: w.steps.map((s, k) => {
        const step = words.steps[k];
        if (step === undefined)
          throw new Error(`why: no words for ${w.id}#${k}`);
        const label = s.file ?? step.label;
        return {
          html: step.html(root),
          ...(s.code === undefined ? {} : { code: s.code }),
          ...(label === undefined ? {} : { label }),
          ...(s.reply === true ? { reply: true } : {}),
          ...(s.scene === undefined
            ? {}
            : { scene: { name: s.scene, caption: step.caption ?? '' } }),
        };
      }),
    };
  });
}

/** The walk-throughs in English, as the English page shows them. */
export const WALKTHROUGHS: readonly Walkthrough[] = walkthroughs('en', '../');

/* ── The page ───────────────────────────────────────────────────────── */

/** What each part of the page needs: its words, the art and the roots. */
interface Context {
  readonly t: WhyText;
  readonly art: Readonly<Record<string, Art>>;
  /** The site's root, for images and scenes. */
  readonly site: string;
  /** The locale's root, for its pages. */
  readonly home: string;
  readonly locale: Locale;
}

function figureOf(
  c: Context,
  key: WhyFigureKey,
  caption: string,
  className = 'why-figure',
): string {
  const a = c.art[key];
  if (a === undefined) throw new Error(`why: no figure ${key}`);
  const shown = { ...a, alt: c.t.alt[key] };
  return `<figure class="${className}">${picture(shown, c.site)}<figcaption>${caption}</figcaption></figure>`;
}

const codeBlock = (code: string, label: string): string =>
  `<div class="snippet" data-snippet="guide" data-label="${attribute(label)}"><pre tabindex="0" role="region" aria-label="${attribute(label)}"><code>${text(code)}</code></pre></div>`;

function triptych(c: Context): string {
  const t = c.t.triptych;
  return `<section class="triptych-wrap" aria-labelledby="one-run">
<h2 id="one-run">${text(t.title)}</h2>
<p>${t.intro(`<code>${text(WHY_RUN.input)}</code>`)}</p>
<div class="triptych">
${figureOf(c, 'web', t.captions.web)}
${figureOf(c, 'notes', t.captions.notes)}
${figureOf(c, 'slide', t.captions.slide)}
</div>
</section>`;
}

function differences(c: Context, facts: WhyFacts): string {
  const t = c.t.differences;
  const names = facts.steps
    .map(
      (s) =>
        `<li><code>${text(s.name)}</code>${s.count > 1 ? `×${s.count}` : ''}</li>`,
    )
    .join('');
  return `<section aria-labelledby="different">
<h2 id="different">${text(t.title)}</h2>
<div class="why-point">
  <div class="why-text">
    <h3>${text(t.named.title)}</h3>
    <p>${text(t.named.before)}</p>
    <ul class="names" aria-label="${attribute(t.named.namesLabel)}">${names}</ul>
    <p>${t.named.after}</p>
  </div>
  ${figureOf(c, 'named', t.named.caption)}
</div>
<div class="why-point">
  <div class="why-text">
    <h3>${text(t.inputs.title)}</h3>
    <p>${t.inputs.text(c.home)}</p>
  </div>
  <div class="why-pair">
    ${figureOf(c, 'in-list', t.inputs.list)}
    ${figureOf(c, 'in-ops', t.inputs.ops)}
  </div>
</div>
<div class="why-point">
  <div class="why-text">
    <h3>${text(t.themes.title)}</h3>
    <p>${t.themes.text(c.home)}</p>
  </div>
  <div class="why-pair">
    ${figureOf(c, 'print', '<code>print</code>')}
    ${figureOf(c, 'answer', '<code>answer-sheet</code>')}
  </div>
</div>
<div class="why-point">
  <div class="why-text">
    <h3>${text(t.assistant.title)}</h3>
    <p>${t.assistant.text(facts.modules)}</p>
  </div>
  ${figureOf(c, 'assistant', t.assistant.caption)}
</div>
</section>`;
}

function comparison(t: WhyText['comparison']): string {
  const head = t.tools.map((n) => `<th scope="col">${text(n)}</th>`).join('');
  const rows = t.rows
    .map(
      (r) =>
        `<tr><th scope="row">${text(r.what)}</th>${r.cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`,
    )
    .join('\n');
  return `<section aria-labelledby="compare">
<h2 id="compare">${text(t.title)}</h2>
<p>${text(t.intro)}</p>
<div class="scroll" role="region" aria-label="${attribute(t.tableLabel)}" tabindex="0">
<table class="compare">
  <thead><tr><th scope="col"><span class="visually-hidden">${text(t.comparedOn)}</span></th>${head}</tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
</div>
</section>`;
}

function limits(t: WhyText['limits'], modules: number, home: string): string {
  return `<section aria-labelledby="limits">
<h2 id="limits">${text(t.title)}</h2>
<ul class="limits">
${t
  .items(modules, home)
  .map((item) => `  <li>${item}</li>`)
  .join('\n')}
</ul>
</section>`;
}

function walkthrough(
  w: Walkthrough,
  c: Context,
  checked: string,
  scenes: SceneManifest,
): string {
  const steps = w.steps
    .map(
      (s) => `<li>
  <p>${s.html}</p>
  ${s.code === undefined ? '' : codeBlock(s.code, s.label ?? w.title)}
  ${s.scene === undefined ? '' : sceneFigure(scenes, s.scene.name, c.site, s.scene.caption, 'why-figure scene', c.locale)}
  ${s.reply === true ? `<p class="reply">${c.t.walks.reply}<q>${text(checked)}</q></p>` : ''}
</li>`,
    )
    .join('\n');
  return `<section class="walk" aria-labelledby="${attribute(w.id)}">
<h3 id="${attribute(w.id)}">${text(w.title)}</h3>
<p class="who">${text(w.who)}</p>
<ol class="walk-steps">
${steps}
</ol>
</section>`;
}

/** The page, in `locale`. */
export function whyPage(
  art: Readonly<Record<string, Art>>,
  facts: WhyFacts,
  assets: Assets,
  scenes: SceneManifest,
  locale: Locale = 'en',
): string {
  const t = WHY[locale];
  const { site, home } = rootsOf(locale, 'why/');
  const c: Context = { t, art, site, home, locale };
  return page({
    title: t.title,
    description: t.description,
    root: site,
    assets,
    section: 'why',
    layout: 'why',
    locale,
    alternate: 'why/',
    body: `<nav class="crumbs" aria-label="${attribute(CHROME[locale].breadcrumb)}"><ol><li><a href="${home}">algomotion</a></li><li aria-current="page">${text(t.title)}</li></ol></nav>
<article class="why-body">
<h1>${text(t.title)}</h1>
<p class="lede">${text(t.lede)}</p>
${triptych(c)}
${differences(c, facts)}
${comparison(t.comparison)}
${limits(t.limits, facts.modules, home)}
<section aria-labelledby="walks">
<h2 id="walks">${text(t.walks.title)}</h2>
<p>${text(t.walks.intro)}</p>
${walkthroughs(locale, home)
  .map((w) => walkthrough(w, c, facts.checked, scenes))
  .join('\n')}
</section>
</article>`,
  });
}
