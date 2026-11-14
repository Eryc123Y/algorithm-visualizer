/** The guide's first page: what algomotion does, and the ways in. */
import type { Guide } from '../guide.ts';

export const start: Guide = {
  slug: '',
  title: 'Getting started',
  nav: 'Getting started',
  summary:
    'algomotion runs an algorithm on your input and draws every step. This page shows the idea in five minutes, and where to go for each way of using it.',
  figures: [
    {
      key: 'insertion',
      algorithm: 'insertion-sort',
      input: '5 2 4 6 1 3',
      step: 'insert#2',
      alt: 'Insertion sort on 5 2 4 6 1 3, after the second insertion.',
    },
  ],
  body: ({ root, site, figure, code, note }) => `
<h2 id="idea">The idea</h2>
<p>You name an algorithm and give it an input, written the way you would write it on paper: a list <code>5 2 4 6 1 3</code>, a graph <code>A-B 4, B-C 1</code>, or operations <code>insert 4, delete 3</code>. algomotion runs the algorithm and records every step: what changed, which line of the code ran, and a sentence that says why. Each step has a name, such as <code>insert#2</code>, the second insertion.</p>
${figure('insertion', 'Insertion sort on <code>5 2 4 6 1 3</code> at step <code>insert#2</code>, as every output draws it.')}
<p>That record becomes whatever you need: a player on a web page, a figure in Typst or LaTeX, overlays on a slide, SVG files, or a player inside an AI conversation. Every output draws with the same engine and the same themes, so they all look alike.</p>

<h2 id="try">Try it without installing anything</h2>
<p>The <a href="${site}play/#v=1&amp;alg=insertion-sort&amp;in=5%202%204%206%201%203">share page</a> plays any algorithm from its link. Change the input after <code>in=</code> and reload, or pick any of the <a href="${root}algorithms/">algorithms</a>: each page has a player and the snippets for every output.</p>
<p>Or ask an AI assistant. Add algomotion to Claude Code with one command, then ask it to show you an algorithm:</p>
${code('claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp', 'Add algomotion to Claude Code')}
<p><a href="${root}guide/ai/">Connecting an assistant</a> covers Claude’s apps and other clients.</p>

<h2 id="choose">Choose where it goes</h2>
<div class="scroll" role="region" aria-label="The outputs" tabindex="0">
<table class="choices">
  <thead><tr><th scope="col">You want</th><th scope="col">Use</th><th scope="col">Guide</th></tr></thead>
  <tbody>
    <tr><td>An interactive player on a web page or course site</td><td><code>&lt;algo-player&gt;</code></td><td><a href="${root}guide/web/">Web pages</a></td></tr>
    <tr><td>A figure of one step in notes, a paper or an exam</td><td>The Typst or LaTeX package</td><td><a href="${root}guide/typst/">Typst</a>, <a href="${root}guide/latex/">LaTeX</a></td></tr>
    <tr><td>A run stepped through on slides</td><td>Beamer overlays, polylux or Touying</td><td><a href="${root}guide/slides/">Slides</a></td></tr>
    <tr><td>SVG or TikZ files, or a JSON document</td><td>The <code>algomotion</code> command</td><td><a href="${root}guide/cli/">Command line</a></td></tr>
    <tr><td>An assistant that shows and explains algorithms</td><td>The MCP server</td><td><a href="${root}guide/ai/">AI assistants</a></td></tr>
    <tr><td>A link anyone can open</td><td>The share page</td><td><a href="${root}guide/share-links/">Share links</a></td></tr>
  </tbody>
</table>
</div>

<h2 id="words">Four words to know</h2>
<dl class="terms">
  <dt>Algorithm</dt>
  <dd>One of the modules in the <a href="${root}algorithms/">catalogue</a>, by its id: <code>dijkstra</code>, <code>insertion-sort</code>, or <code>bst.delete</code> for an operation of a data structure.</dd>
  <dt>Input</dt>
  <dd>What the algorithm runs on, in a notation you already know, or as JSON. <a href="${root}guide/inputs/">Inputs</a> lists every notation.</dd>
  <dt>Step</dt>
  <dd>One change, named by what happens in it. <code>relax#3</code> is the third relaxation, <code>-1</code> the last frame, and <code>insert-5</code> a whole section. Every output picks steps the same way.</dd>
  <dt>Document</dt>
  <dd>The JSON record of a run: the structures and the steps. Algorithms make them for you; you, or a model, can also write one by hand for anything the catalogue does not have. See <a href="${root}guide/documents/">Documents</a>.</dd>
</dl>

${note(`<p>The packages are not on npm, Typst Universe or CTAN yet. Until they are, the guides show how to build each one from <a href="https://github.com/Eryc123Y/algorithm-visualizer">the repository</a>; the share page and the hosted AI server work today.</p>`)}
`,
};
