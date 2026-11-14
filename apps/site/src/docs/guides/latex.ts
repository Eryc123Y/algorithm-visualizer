import type { Guide } from '../guide.ts';

export const latex: Guide = {
  slug: 'latex',
  title: 'LaTeX',
  nav: 'LaTeX',
  summary:
    'Draw steps with TikZ, using your document’s fonts. The command makes each figure once and keeps it in a cache.',
  figures: [
    {
      key: 'tree',
      algorithm: 'inorder-tree-walk',
      input: '[8,3,10,1,6]',
      step: '-1',
      theme: 'textbook',
      alt: 'A completed inorder traversal in the textbook theme.',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="install">Requirements and installation</h2>
<p>Use LaTeX 2024-06-01 or later and TikZ. pdfLaTeX, LuaLaTeX and XeLaTeX are supported. The package is not on CTAN yet; it will be at 1.0. Take <code>algomotion.sty</code> from <code>algomotion-latex.zip</code> in the <a href="https://github.com/Eryc123Y/algorithm-visualizer/releases/tag/v1.0.0-alpha.1">GitHub release</a>, or from <code>packages/latex/package/</code> in the repository, and put it next to your document or in your local <code>texmf/tex/latex/algomotion/</code> tree.</p>
<p>The package runs the <code>algomotion</code> command. With Node.js, install it from npm: <code>npm install -g @algomotion/mcp@alpha</code>. Without Node.js, use the standalone executable: the release has one for macOS on Apple silicon, and the repository builds one for your machine, with rustup and a C compiler:</p>
${code(
  `npm ci
npm run build:standalone -w @algomotion/mcp`,
  'Build the command for LaTeX',
)}
<p>Put <code>packages/mcp/dist/standalone/algomotion</code> on your <code>PATH</code>, or pass its absolute path with <code>command=</code>. The <a href="${root}guide/cli/">Node.js command</a> also works, with <code>command={node /absolute/path/packages/mcp/dist/algomotion.js}</code>.</p>

<h2 id="figure">One figure</h2>
${code(
  String.raw`\documentclass{article}
\usepackage{algomotion}
\begin{document}
\algomotionset{theme=textbook}
\algomotion[step=-1]{inorder-tree-walk}{[8,3,10,1,6]}
\end{document}`,
  'A complete LaTeX document',
)}
${code(`latexmk -pdf -shell-escape notes.tex`, 'Compile the first time')}
${figure('tree', 'The same tree and theme drawn by the engine. LaTeX sets the figure’s text with the document’s fonts.')}
<p><code>\\algomotion[keys]{id}{input}</code> runs an algorithm. <code>\\algomotionset{keys}</code> sets defaults for later figures in the current group. With no step, a figure shows the last frame.</p>

<h2 id="keys">Keys</h2>
<div class="scroll" role="region" aria-label="LaTeX keys" tabindex="0"><table class="params">
<thead><tr><th>Key</th><th>Default</th><th>Use</th></tr></thead><tbody>
<tr><td><code>step</code></td><td><code>-1</code></td><td>One frame number or named selector.</td></tr>
<tr><td><code>steps</code></td><td>none</td><td>A series for Beamer. Without a value, every frame; braces enclose comma-separated selectors.</td></tr>
<tr><td><code>start</code></td><td><code>+</code></td><td>First overlay of a series: incremental count or an explicit number.</td></tr>
<tr><td><code>theme</code></td><td><code>light</code></td><td>A built-in fixed theme.</td></tr>
<tr><td><code>layout</code></td><td><code>auto</code></td><td><code>narrow</code> in notes, <code>wide</code> in Beamer; either can be set explicitly.</td></tr>
<tr><td><code>width</code>, <code>height</code></td><td>natural; filled in Beamer</td><td>Fit inside the given dimensions while keeping shape.</td></tr>
<tr><td><code>scale</code></td><td>none</td><td>Factor on natural size; without a value, reset sizing to the default.</td></tr>
<tr><td><code>value font</code></td><td>theme's family</td><td>Font for cell values, nodes, indices, edge labels and pointers.</td></tr>
<tr><td><code>label font</code></td><td>theme's family</td><td>Font for titles and labels.</td></tr>
<tr><td><code>algorithm</code></td><td>none</td><td>With <code>\\algomotionfile</code>, read the file as algorithm input.</td></tr>
<tr><td><code>command</code></td><td><code>algomotion</code></td><td>Package option: executable, with path or arguments.</td></tr>
<tr><td><code>cachedir</code></td><td><code>_algomotion</code></td><td>Package option: directory of reusable figures.</td></tr>
</tbody></table></div>
${code(
  String.raw`\usepackage[command=algomotion,cachedir=_algomotion]{algomotion}
% In the document:
\algomotion[layout=wide,width=0.8\linewidth,height=6cm,
  value font=\small\ttfamily,label font=\small\sffamily]
  {dijkstra}{A-B 4, B-C 1, A-C 7}
\algomotion[scale=0.7]{insertion-sort}{5 2 4}`,
  'Sizing and font keys',
)}
<p>At natural size, values are 1.25 times the surrounding text size and labels three quarters of it. Figures are capped at the line width unless explicit dimensions override that. The themes are <code>light</code>, <code>dark</code>, <code>print</code>, <code>textbook</code>, <code>textbook-dark</code>, <code>blocks</code>, <code>blocks-dark</code>, <code>answer-sheet</code> and <code>turbo-c</code>.</p>

<h2 id="files">Documents, input files and exported figures</h2>
<p><code>\\algomotionfile{run.json}</code> draws a document. Add <code>algorithm=dijkstra</code> to read algorithm input instead. To make these example files and a TikZ export:</p>
${code(
  `algomotion run dijkstra 'A-B 4, B-C 1, A-C 7' --out run.json
printf '%s\n' '{"graph":"A-B 4, B-C 1, A-C 7"}' > graph.json
algomotion export run.json --step -1 --format tikz --out figures --name shortest`,
  'Prepare files',
)}
${code(
  String.raw`\algomotionfile[step=improve#3]{run.json}
\algomotionfile[algorithm=dijkstra,theme=print]{graph.json}
\algomotioninput[width=\linewidth]{figures/shortest.tex}`,
  'Include files in LaTeX',
)}
<p><code>\\algomotioninput</code> reads the export directly and needs no shell escape. It also reads a series exported with <code>--one-file</code>; see <a href="${root}guide/slides/">Slides</a>.</p>

<h2 id="steps">Steps and input</h2>
<p>Frame <code>0</code> is the initial state, <code>-1</code> the last. <code>improve#3</code> names the third improvement, and <code>delete-3/replacement</code> names a step within a section. A section or range needs <code>steps</code>, since it names several frames. The last of <code>step</code> and <code>steps</code> given takes effect.</p>
<p>Inside a macro definition or a Beamer frame without <code>[fragile]</code>, write <code>\\#</code> in selectors; that spelling works elsewhere too. Inputs take <a href="${root}guide/inputs/">notations or JSON</a>. The outer object braces may be left out. Empty input runs the first example.</p>
${code(
  String.raw`\algomotion[step=improve\#3]{dijkstra}{A-B 4, B-C 1, A-C 7}
\algomotion{topological-sort}{shirt->tie, tie->jacket, socks}
\algomotion{inorder-tree-walk}{[4, 2, 6, null, 7]}
\algomotion{kruskal}{}`,
  'Selectors and input notations',
)}
<p>TeX turns line breaks into spaces, so separate graph edges with commas. Escape literal <code>%</code>, <code>#</code>, <code>{</code>, <code>}</code>, <code>&amp;</code>, <code>$</code> and <code>_</code> with a backslash. JSON escapes work, but TeX drops a space after a letter escape such as <code>\\n</code>; use <code>\\u0020</code> for that space. On Windows, long inline inputs are refused around 3,500 characters; use an input file.</p>

<h2 id="cache">Shell escape and the cache</h2>
<p>The first compile runs the command with <code>-shell-escape</code>. TeX's default restricted shell escape does not allow it. Each generated figure is stored in <code>_algomotion/</code>, keyed by the input or file contents, algorithm, selector, theme, layout, format and package version. Fonts and size apply when the figure is drawn and need no new export.</p>
<p>Commit the cache for arXiv and co-authors. Once every requested figure is cached, compile without shell escape or the command installed. Keep the package with the project too until it is on CTAN. The package deletes nothing; clear the cache after updating the command. Old incompatible TikZ formats report an error and need a fresh export.</p>

<h2 id="errors">Errors and engines</h2>
<p>An invalid input, document, selector or theme produces a LaTeX error and a framed box with the whole diagnostic. Missing shell escape, restricted shell escape and a missing executable have separate messages. Check <code>algomotion --help</code> if the command makes no figure.</p>
${code(String.raw`\algomotion{insertion-sort}{5 x 4} % Reports INVALID_NOTATION.`, 'An error box')}
<p>pdfLaTeX, LuaLaTeX and XeLaTeX draw the same shapes. Symbols such as infinity and arrows use math; other non-ASCII text needs suitable document fonts, especially with pdfLaTeX. <code>latex</code> with <code>dvips</code> works, but shadows become solid because PostScript has no transparency.</p>
${note('<p>Shell escape lets a document run programs. Compile documents from others with care. The package checks algorithm ids, selectors and themes, passes inline input as hexadecimal and checks quoted file names. Sharing the cache lets a co-author compile with shell escape off.</p>')}
`,
};
