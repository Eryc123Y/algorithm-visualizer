import type { Guide } from '../guide.ts';

export const slides: Guide = {
  slug: 'slides',
  title: 'Slides',
  nav: 'Slides',
  summary:
    'Turn selected frames into overlays of one slide. Every frame keeps the same canvas and scale.',
  figures: [
    {
      key: 'before',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: '0',
      alt: 'The initial row: 5, 2, 4.',
    },
    {
      key: 'insert',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: 'insert',
      alt: 'The first insertion gives 2, 5, 4.',
    },
    {
      key: 'after',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: '-1',
      alt: 'The sorted row: 2, 4, 5.',
    },
  ],
  body: ({ root, code, figure, note, scene }) => `
<h2 id="frames">Choose what the audience sees</h2>
<p>Use a few named steps when explaining one idea, or every frame for a worked exercise. A series shares one canvas, so structures do not jump as you advance.</p>
<div class="overlays" role="group" aria-label="Three steps of insertion sort">
${figure('before', 'Initial state, <code>0</code>.')}
${figure('insert', 'First <code>insert</code>.')}
${figure('after', 'Last frame, <code>-1</code>.')}
</div>

<h2 id="beamer">Beamer overlays</h2>
<p>Install the <a href="${root}guide/latex/">LaTeX package and command</a> first. <code>steps</code> without a value selects every frame. A range, section or braced list selects fewer. <code>start</code> sets the first overlay.</p>
${scene('beamer', 'The three overlays of one Beamer frame with <code>steps=extract\\#2..improve\\#3</code>, as <code>latexmk</code> compiles them. Made from <code>apps/site/scenes/slides.tex</code> by <code>npm run scenes</code>.')}
${code(
  String.raw`\documentclass{beamer}
\usepackage{algomotion}
\begin{document}
\begin{frame}{Insert into a sorted prefix}
  \centering
  \algomotion[steps={0,insert,-1},start=1,height=0.6\textheight]
    {insertion-sort}{5 2 4}
\end{frame}
\begin{frame}{Every step}
  \algomotion[steps]{insertion-sort}{5 2 4}
\end{frame}
\end{document}`,
  'A complete Beamer deck',
)}
${code(`latexmk -pdf -shell-escape slides.tex`, 'Build the Beamer deck')}
<p>Each selected frame occupies an overlay; the last stays until the slide ends. With the default <code>start=+</code>, a series starts at Beamer's incremental count, after preceding <code>\\pause</code> or <code>\\item&lt;+-&gt;</code> items. An explicit <code>start=3</code> starts at overlay 3. Two series with <code>start=1</code> advance together.</p>
${code(
  String.raw`\begin{frame}{A deletion}
  Find the node first. \pause
  \algomotion[steps=delete-3,height=0.6\textheight]
    {bst.delete}{"from":"8 3 10 1 6", "key":3}
  \onslide<+->{The search order is preserved.}
\end{frame}
\begin{frame}{The second insertion}
  \algomotion[steps=insert\#2..-1,start=2]
    {insertion-sort}{5 2 4}
\end{frame}`,
  'Sections, ranges and a pause',
)}
<p>After a series use <code>\\onslide&lt;+-&gt;</code> for new content; <code>\\pause</code> would repeat the final frame. Escape <code>#</code> as <code>\\#</code> in non-fragile Beamer frames.</p>
<p>A Beamer figure fills the line width and up to three quarters of the text height. <code>height=0.6\\textheight</code> leaves room for text. <code>width</code> changes the width cap, and <code>scale=1</code> uses natural size. In a column, it fills that column. <code>layout=wide</code> is the Beamer default.</p>
<p>With <code>\\documentclass[handout]{beamer}</code>, in transparencies or in <code>beamerarticle</code> notes, a series shows its last frame. Outside Beamer it also shows the last frame, with a warning. A series containing one frame is an ordinary figure on every overlay.</p>

<h2 id="export">Export overlays before compiling</h2>
<p>To compile without shell escape, export a TikZ series once and include it. The <a href="${root}guide/cli/#export">export command</a> also selects sections and ranges.</p>
${code(`algomotion export insertion-sort --input '5 2 4' --step 0,insert,-1 --format tikz --one-file --out figures --name insertion`, 'Export an overlay series')}
${code(
  String.raw`\begin{frame}{Insertion sort}
  \algomotioninput[start=1]{figures/insertion.tex}
\end{frame}`,
  'Read the exported series',
)}

<h2 id="typst">Typst with Touying</h2>
<p>Install the <a href="${root}guide/typst/">local Typst package</a>. Pass the slide framework's own <code>only</code> function to <code>algomotion-slides</code>. The package does not import a slide framework itself.</p>
${code(
  `#import "@preview/touying:0.8.0": *
#import themes.simple: *
#import "@local/algomotion:0.1.0": algomotion-slides
#show: simple-theme.with(aspect-ratio: "16-9")

== Insertion sort
#align(center, algomotion-slides(only, "insertion-sort", "5 2 4",
  steps: (0, "insert", -1), height: 60%,
))`,
  'Touying overlays',
)}
<p>Use <code>steps: auto</code> for all frames, a range such as <code>"insert#2..-1"</code>, or a section such as <code>"delete-3"</code>. <code>start: 1</code> is the default. After a Touying <code>#pause</code>, give <code>start: 2</code> explicitly: the framework's <code>only</code> does not follow pause counts. Touying's handout mode keeps the last subslide, so the series shows its last frame.</p>

<p>For a Touying handout, replace the theme setup above with:</p>
${code(`#show: simple-theme.with(aspect-ratio: "16-9", config-common(handout: true))`, 'Touying handout setup')}

<h2 id="polylux">Typst with polylux</h2>
${code(
  `#import "@preview/polylux:0.4.0": *
#import "@local/algomotion:0.1.0": algomotion-slides
#set page(paper: "presentation-16-9", margin: 1.5cm)
#set text(size: 20pt)

#slide[
  == Insertion sort
  #align(center, algomotion-slides(only, "insertion-sort", "5 2 4",
    steps: "insert#2..-1", start: 2, height: 60%,
  ))
]`,
  'polylux overlays',
)}
<p>The same options work in both frameworks: <code>steps</code>, <code>start</code>, <code>theme</code>, <code>layout</code>, <code>strict</code>, <code>width</code>, <code>height</code> and <code>fit</code>. The default layout is wide. The series fills the region's width and three quarters of its height while keeping shape. Width and height override their own side only. Put two series in a <code>grid</code> to give each its own region.</p>
${note('<p>A single step can fill a slide too: use <code>algomotion-slides</code> with <code>steps: "insert"</code>. Ordinary <code>algomotion</code> images keep their natural size. Preview the actual deck and its handout before teaching; choose a print theme for paper.</p>')}
`,
};
