/**
 * "Why algomotion" (roadmap 5.4): what it is for, what makes it
 * different, shown with figures the engine draws at build time, an
 * honest comparison with other ways of drawing algorithms, its limits,
 * and three walk-throughs with code that runs as written.
 */
import type { ExportOptions, ThemeName } from '@algomotion/svg';

/** Where a figure's side panel goes: beside (`wide`) or below (`narrow`). */
export type FigureLayout = NonNullable<ExportOptions['layout']>;

import { picture, type Art } from './home.ts';
import { attribute, page, REPOSITORY, text, type Assets } from './html.ts';
import { sceneFigure, type SceneManifest, type SceneName } from './scenes.ts';
import type { StepName } from './pages.ts';

const ROOT = '../';

/** The run most of the page shows, as on the home page. */
export const WHY_RUN = {
  algorithm: 'dijkstra',
  input: 'A-B 4, B-C 1, A-C 7, C-D 2',
} as const;

/** A figure the page shows, drawn by the engine at build time. */
export interface WhyFigure {
  readonly key: string;
  readonly algorithm: string;
  readonly input: string | Readonly<Record<string, string>>;
  readonly step: string;
  /** A fixed theme; otherwise the light and the dark theme. */
  readonly theme?: ThemeName;
  readonly layout?: FigureLayout;
  readonly alt: string;
}

const run = (
  key: string,
  step: string,
  alt: string,
  more: Partial<WhyFigure> = {},
): WhyFigure => ({ key, ...WHY_RUN, step, alt, ...more });

export const WHY_FIGURES: readonly WhyFigure[] = [
  run('web', 'improve#3', 'C improves to 5 through B, in the blocks theme.', {
    theme: 'blocks',
  }),
  run(
    'notes',
    'improve#3',
    'C improves to 5 through B, in the textbook theme, with the queue below the graph.',
    {
      theme: 'textbook',
      layout: 'narrow',
    },
  ),
  run(
    'slide',
    'improve#3',
    'C improves to 5 through B, in the dark theme, with the queue beside the graph.',
    {
      theme: 'dark',
    },
  ),
  run(
    'named',
    'extract#3',
    'C is taken from the queue: its distance, 5, is final.',
  ),
  {
    key: 'in-list',
    algorithm: 'insertion-sort',
    input: '5 2 4 6 1 3',
    step: 'insert#2',
    alt: 'Insertion sort on 5 2 4 6 1 3 after its second insertion.',
  },
  {
    key: 'in-ops',
    algorithm: 'bst',
    input: { from: '8 3 10 1 6', ops: 'insert 4, delete 3' },
    step: '-1',
    alt: 'The search tree after inserting 4 and deleting 3.',
  },
  run('print', 'improve#3', 'The same step in the print theme, for paper.', {
    theme: 'print',
  }),
  run('answer', 'improve#3', 'The same step in the answer-sheet theme.', {
    theme: 'answer-sheet',
  }),
  run(
    'assistant',
    'improve#3',
    'C improves to 5 through B, with the queue Q beside the graph.',
  ),
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

/* ── The comparison ─────────────────────────────────────────────────── */

/** One row of the comparison: algomotion, by hand, Manim, websites. */
export const COMPARISON: readonly {
  readonly what: string;
  readonly cells: readonly [string, string, string, string];
}[] = [
  {
    what: 'What you give it',
    cells: [
      'An algorithm’s name and your input, such as <code>A-B 4, B-C 1</code>.',
      'Every shape and position: as code in TikZ, with the mouse in draw.io.',
      'A scene written in Python: the objects, and how each one moves.',
      'A choice from the site’s list; some also take your own input.',
    ],
  },
  {
    what: 'Another input',
    cells: [
      'Run it again; every figure follows.',
      'Redraw the figures.',
      'Edit the scene and render it again.',
      'Type it in where the site allows it; the result stays on the site.',
    ],
  },
  {
    what: 'In notes and papers',
    cells: [
      'Vector figures from the Typst and LaTeX packages; in LaTeX, text in the document’s fonts.',
      'TikZ is part of the LaTeX document; draw.io exports SVG and PDF.',
      'Frames exported as images.',
      'Screenshots.',
    ],
  },
  {
    what: 'On a web page',
    cells: [
      'The player: step controls, the code with its current line, narration, keyboard shortcuts.',
      'Still images.',
      'A video.',
      'Interactive, on the site itself.',
    ],
  },
  {
    what: 'On slides',
    cells: [
      'One overlay per step, in Beamer, polylux and Touying.',
      'Overlays drawn one by one.',
      'Video clips, or exported frames.',
      'A link, or screenshots.',
    ],
  },
  {
    what: 'Beyond its list',
    cells: [
      'A JSON document of the steps, written by hand or by a model that checks it with the MCP tools.',
      'Anything you can draw.',
      'Anything you can program.',
      'Only what the site offers.',
    ],
  },
  {
    what: 'Better at',
    cells: [
      'One run that looks the same in notes, slides, web pages and AI conversations, with steps that come from running the algorithm.',
      'Exact control of every mark, and pictures of anything at all.',
      'Smooth, polished animation for explanatory videos.',
      'Nothing to install, and a whole topic to browse in one place.',
    ],
  },
];

const TOOLS = [
  'algomotion',
  'Drawing by hand (TikZ, draw.io)',
  'Manim',
  'Algorithm visualization websites',
] as const;

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
  readonly id: string;
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

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: 'notes',
    title: 'A student’s notes in Typst',
    who: 'You are writing up shortest paths and want the step you explain, on the graph from your problem sheet.',
    steps: [
      {
        html: `Install the package from the repository, as <a href="${ROOT}guide/typst/#install">the Typst guide</a> shows. It brings its own engine, so Typst is all you need.`,
      },
      {
        html: 'Write the step into your notes by its name. In a column of notes the queue goes below the graph.',
        code: TYPST_NOTES,
        label: 'notes.typ',
      },
      {
        html: 'Compile as usual. Change the graph or the step, and the figure follows.',
        code: 'typst compile notes.typ',
        label: 'Compile the notes',
        scene: {
          name: 'notes',
          caption:
            'A page of notes as Typst compiles them, from a fuller version of this file.',
        },
      },
    ],
    runs: [{ ...WHY_RUN, steps: ['improve#3'] }],
  },
  {
    id: 'slides',
    title: 'A teacher’s Beamer slides',
    who: 'You want to step through the moment C improves, one click per step, on the same graph as the handout.',
    steps: [
      {
        html: `Install the LaTeX package and the <code>algomotion</code> command, as <a href="${ROOT}guide/latex/">the LaTeX guide</a> shows.`,
      },
      {
        html: 'Name a range of steps. Each becomes an overlay of one picture, so nothing moves between clicks but what the algorithm changes.',
        code: BEAMER_SLIDES,
        label: 'slides.tex',
      },
      {
        html: 'The first compile runs the command through shell escape and caches the figures; later compiles need neither.',
        code: 'latexmk -pdf -shell-escape slides.tex',
        label: 'Compile the slides',
        scene: {
          name: 'beamer',
          caption:
            'The three overlays this file makes, as <code>latexmk</code> compiles them.',
        },
      },
    ],
    runs: [{ ...WHY_RUN, steps: ['extract#2..improve#3'], frames: 3 }],
  },
  {
    id: 'assistant',
    title: 'An assistant explaining an algorithm',
    who: 'You ask a model about Dijkstra’s algorithm and want to see it run, not only read about it.',
    steps: [
      {
        html: `Connect the hosted MCP server. <a href="${ROOT}guide/ai/">Connecting an assistant</a> covers Claude’s apps and other clients.`,
        code: 'claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp',
        label: 'Add algomotion to Claude Code',
      },
      {
        html: 'Ask: “Show me Dijkstra’s algorithm from A on A-B 4, B-C 1, A-C 7, C-D 2.” The model runs the recipe by name and writes no document; in clients that show MCP Apps, the player opens in the conversation.',
        code: SHOW_CALL,
        label: 'The tool call',
        scene: {
          name: 'chat',
          caption:
            'The player after this call, in the minimal MCP Apps host that the project’s tests use.',
        },
      },
      {
        html: 'Ask why C ends at 5. Before answering, the model can look at the state at that step instead of guessing.',
        code: INSPECT_CALL,
        label: 'The check',
        reply: true,
      },
    ],
    runs: [{ ...WHY_RUN, steps: ['improve#3'] }],
  },
];

/* ── The page ───────────────────────────────────────────────────────── */

function figureOf(
  art: Readonly<Record<string, Art>>,
  key: string,
  caption: string,
  className = 'why-figure',
): string {
  const a = art[key];
  if (a === undefined) throw new Error(`why: no figure ${key}`);
  return `<figure class="${className}">${picture(a, ROOT)}<figcaption>${caption}</figcaption></figure>`;
}

const codeBlock = (code: string, label: string): string =>
  `<div class="snippet" data-snippet="guide" data-label="${attribute(label)}"><pre tabindex="0" role="region" aria-label="${attribute(label)}"><code>${text(code)}</code></pre></div>`;

function triptych(art: Readonly<Record<string, Art>>): string {
  return `<section class="triptych-wrap" aria-labelledby="one-run">
<h2 id="one-run">One run, three places</h2>
<p>Dijkstra’s algorithm on <code>${text(WHY_RUN.input)}</code> at the same step, <code>improve#3</code>, drawn by the same engine for three places.</p>
<div class="triptych">
${figureOf(art, 'web', '<b>A web page.</b> The player shows this frame, with its controls and the code beside it.')}
${figureOf(art, 'notes', '<b>Typst or LaTeX notes.</b> A vector figure; in a column, the queue goes below.')}
${figureOf(art, 'slide', '<b>A slide.</b> One overlay per step; here in the dark theme.')}
</div>
</section>`;
}

function differences(
  art: Readonly<Record<string, Art>>,
  facts: WhyFacts,
): string {
  const names = facts.steps
    .map(
      (s) =>
        `<li><code>${text(s.name)}</code>${s.count > 1 ? `×${s.count}` : ''}</li>`,
    )
    .join('');
  return `<section aria-labelledby="different">
<h2 id="different">What makes it different</h2>
<div class="why-point">
  <div class="why-text">
    <h3>Every step has a name you can cite</h3>
    <p>A run is a list of named steps, not a video. This one has these names, and each one is counted:</p>
    <ul class="names" aria-label="The steps of this run">${names}</ul>
    <p><code>extract#3</code> is the third vertex taken from the queue. Your notes, your slides, a share link and a model all pick the same frame by the same name.</p>
  </div>
  ${figureOf(art, 'named', 'Step <code>extract#3</code>: C is final, at 5.')}
</div>
<div class="why-point">
  <div class="why-text">
    <h3>Inputs in the notation you already write</h3>
    <p>A list is <code>5 2 4 6 1 3</code>, a graph is <code>A-B 4, B-C 1</code>, and operations on a structure are <code>insert 4, delete 3</code>. There is no format to learn before the first figure, and an input that does not parse says where. <a href="${ROOT}guide/inputs/">Every notation</a>.</p>
  </div>
  <div class="why-pair">
    ${figureOf(art, 'in-list', '<code>insertion-sort</code> on <code>5 2 4 6 1 3</code>, step <code>insert#2</code>.')}
    ${figureOf(art, 'in-ops', '<code>bst</code> from <code>8 3 10 1 6</code>, then <code>insert 4, delete 3</code>.')}
  </div>
</div>
<div class="why-point">
  <div class="why-text">
    <h3>Themes for paper and for screens</h3>
    <p>Nine built-in themes, the same in every output: one for print, one that looks like a marked-up textbook page, one for an answer sheet, dark ones for slides and night reading. Marks never rely on colour alone, so a figure still reads in black and white. <a href="${ROOT}themes/">All nine</a>.</p>
  </div>
  <div class="why-pair">
    ${figureOf(art, 'print', '<code>print</code>')}
    ${figureOf(art, 'answer', '<code>answer-sheet</code>')}
  </div>
</div>
<div class="why-point">
  <div class="why-text">
    <h3>A model can show it, and check it</h3>
    <p>The MCP server gives a model tools to run any of the ${facts.modules} algorithms by name, show the player in the conversation, and inspect the state at any step before it says what happened. For anything else it writes a document, and validation replays every step and says where one goes wrong. <a href="#assistant">The walk-through</a> below shows the calls.</p>
  </div>
  ${figureOf(art, 'assistant', 'What <code>algomotion_show</code> opens, at <code>improve#3</code>.')}
</div>
</section>`;
}

function comparison(): string {
  const head = TOOLS.map((t) => `<th scope="col">${text(t)}</th>`).join('');
  const rows = COMPARISON.map(
    (r) =>
      `<tr><th scope="row">${text(r.what)}</th>${r.cells.map((c) => `<td>${c}</td>`).join('')}</tr>`,
  ).join('\n');
  return `<section aria-labelledby="compare">
<h2 id="compare">Compared with other ways</h2>
<p>Each of these is the better choice for some work. algomotion is for one thing: an algorithm on your input, step by step, wherever you write or teach. TikZ, draw.io and Manim are open tools anyone can check; the websites are a kind of site, not one in particular.</p>
<div class="scroll" role="region" aria-label="The comparison table" tabindex="0">
<table class="compare">
  <thead><tr><th scope="col"><span class="visually-hidden">Compared on</span></th>${head}</tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
</div>
</section>`;
}

function limits(modules: number): string {
  return `<section aria-labelledby="limits">
<h2 id="limits">What it does not do</h2>
<ul class="limits">
  <li>Only the ${modules} algorithms and data structure operations in <a href="${ROOT}algorithms/">the catalogue</a> run on an input. Anything else is a JSON document that you, or a model, write step by step.</li>
  <li>Figures are laid out automatically. You choose a theme and a wide or narrow layout; a document can place a graph’s nodes by hand, but there is no editor to drag them.</li>
  <li>The outputs are the player in a browser and still figures (SVG and TikZ). There is no video or GIF export.</li>
  <li>Code is shown in pseudocode and Python. Narration and the player’s controls are in English for now; Chinese is <a href="${ROOT}roadmap/">on the roadmap</a>.</li>
  <li>Small inputs read best: with dozens of vertices or hundreds of values a figure gets crowded.</li>
  <li>Nothing is published yet: the packages are not on npm, Typst Universe or CTAN, so the guides install them from <a href="${REPOSITORY}">the repository</a>. The hosted MCP server and share links work today.</li>
  <li>The licence is still to be chosen: the repository has no LICENSE file yet.</li>
</ul>
</section>`;
}

function walkthrough(
  w: Walkthrough,
  checked: string,
  scenes: SceneManifest,
): string {
  const steps = w.steps
    .map(
      (s) => `<li>
  <p>${s.html}</p>
  ${s.code === undefined ? '' : codeBlock(s.code, s.label ?? w.title)}
  ${s.scene === undefined ? '' : sceneFigure(scenes, s.scene.name, ROOT, s.scene.caption, 'why-figure scene')}
  ${s.reply === true ? `<p class="reply">The reply includes the step’s narration: <q>${text(checked)}</q></p>` : ''}
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

/** The page. */
export function whyPage(
  art: Readonly<Record<string, Art>>,
  facts: WhyFacts,
  assets: Assets,
  scenes: SceneManifest,
): string {
  return page({
    title: 'Why algomotion',
    description:
      'What algomotion is for, how it differs from drawing figures by hand, from Manim and from algorithm visualization websites, what it does not do, and three walk-throughs.',
    root: ROOT,
    assets,
    section: 'why',
    layout: 'why',
    body: `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${ROOT}">algomotion</a></li><li aria-current="page">Why algomotion</li></ol></nav>
<article class="why-body">
<h1>Why algomotion</h1>
<p class="lede">Explaining an algorithm usually means drawing it by hand, one step at a time, and drawing it again when the input changes. algomotion runs the algorithm instead. You name it and give it your input, and every step comes out drawn: as a player on a web page, figures in Typst and LaTeX, overlays on slides, and a player in an AI conversation, all from the same run.</p>
${triptych(art)}
${differences(art, facts)}
${comparison()}
${limits(facts.modules)}
<section aria-labelledby="walks">
<h2 id="walks">Three walk-throughs</h2>
<p>Each one is real code on the run above. Copy it, change the input, and the figures follow.</p>
${WALKTHROUGHS.map((w) => walkthrough(w, facts.checked, scenes)).join('\n')}
</section>
</article>`,
  });
}
