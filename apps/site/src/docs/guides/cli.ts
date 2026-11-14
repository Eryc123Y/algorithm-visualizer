import type { Guide } from '../guide.ts';

export const cli: Guide = {
  slug: 'cli',
  title: 'Command line',
  nav: 'Command line',
  summary:
    'Run algorithms, check documents and export selected frames as SVG or TikZ files.',
  figures: [
    {
      key: 'export',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      theme: 'print',
      alt: 'An exported Dijkstra frame showing C improved through B, in greyscale.',
    },
  ],
  body: ({ root, code, figure, note, scene }) => `
<h2 id="install">Install</h2>
<p>The command is on npm as a 1.0 alpha, in <code>@algomotion/mcp</code>. Run it without installing, or install it for every project:</p>
${code(
  `npx -p @algomotion/mcp@alpha algomotion --help
npm install -g @algomotion/mcp@alpha`,
  'Run or install the command',
)}
<p>To build it from a checkout of the repository instead, install the workspace and build the MCP package:</p>
${code(
  `npm ci
npm run build -w @algomotion/mcp
node packages/mcp/dist/algomotion.js --help`,
  'Build the Node.js command',
)}
<p>Below, <code>algomotion</code> stands for <code>node /absolute/path/packages/mcp/dist/algomotion.js</code>. You can also run directly from the repository without building:</p>
${code(`node --conditions=@algomotion/source packages/mcp/src/algomotion.ts recipes`, 'Run from source')}
<p>For a command that runs without Node.js, build the standalone executable. Building requires rustup and a C compiler. It builds for the current machine; <code>-- --target &lt;triple&gt;</code> selects another target supported by the toolchain.</p>
${code(
  `npm run build:standalone -w @algomotion/mcp
packages/mcp/dist/standalone/algomotion --help`,
  'Build the standalone executable',
)}
<p>Put that executable on your <code>PATH</code>. It supports every command here; the MCP server itself still needs a JavaScript runtime.</p>

<h2 id="run">Find and run algorithms</h2>
<p><code>recipes</code> lists every id with its title, topic, summary and input JSON Schema. <code>run</code> writes the document to standard output, or to a file with <code>--out</code> (<code>-o</code>). With no input it runs the first example. Its input argument is text, not a file path.</p>
${code(
  `algomotion recipes
algomotion run insertion-sort '5 2 4' --out sort.json
algomotion run dijkstra 'A-B 4, B-C 1, A-C 7' --out graph-run.json
algomotion run bst.delete '"from":"8 3 10 1 6", "key":3'
algomotion run kruskal`,
  'List and run recipes',
)}
<p>See <a href="${root}guide/inputs/">Inputs</a> for notations and JSON forms.</p>

<h2 id="guide">Read the authoring guide</h2>
<p><code>guide</code> prints the document guide and every structure kind. Pass kind names to read only those parts. This is the same guide given to AI assistants.</p>
${code(
  `algomotion guide
algomotion guide array graph table`,
  'Read the protocol guide',
)}

<h2 id="validate">Validate and inspect</h2>
<p><code>validate</code> checks the shape, then replays every action. <code>inspect</code> reports structure state, marks, narration, step name and section at the requested frames; without selectors it reports the last frame. It accepts at most 20 frames per call. A file name of <code>-</code> reads a document from standard input.</p>
${code(
  `algomotion validate sort.json
algomotion inspect sort.json 0 insert -1
cat sort.json | algomotion validate -`,
  'Check a run',
)}
<p>A selector may be a number, negative from the end, a step name, a numbered occurrence such as <code>improve#3</code>, a section-qualified step, a whole section or a range. A bare step name selects its first occurrence. Series come out in timeline order without duplicates.</p>

<h2 id="render">Render one frame</h2>
<p><code>render</code> reads a document file and returns one standalone SVG with text kept as text. <code>--frame</code> defaults to <code>-1</code>, <code>--theme</code> to <code>light</code>, and <code>--layout</code> to <code>wide</code>. Without <code>--out</code>, SVG goes to standard output. A section or range with several frames is an error here.</p>
${code(`algomotion render graph-run.json --frame improve#3 --theme print --layout narrow --out distance.svg`, 'Draw one frame')}

<h2 id="export">Export figures</h2>
<p><code>export</code> writes standalone figures with a shared canvas. SVG text becomes outlines of the bundled fonts and narration becomes the image description. Export from a document or run an algorithm with <code>--input</code> first.</p>
${code(
  `algomotion export graph-run.json --step improve#3,-1 --theme print --out figures
algomotion export dijkstra --input 'A-B 4, B-C 1, A-C 7' --step improve#3 --theme print --out figures --name distance
algomotion export sort.json --step 0 --step insert..-1 --layout narrow --out figures --name '{name}-{step}'`,
  'Export selected SVG frames',
)}
${figure('export', 'The Dijkstra export at <code>improve#3</code> in the <code>print</code> theme.')}
${scene('terminal', 'A session with the command, as it ran: an export, a run, an inspection and an input with a mistake. The output is what the commands printed. Made by <code>npm run scenes</code>.')}
<div class="scroll" role="region" aria-label="Export options" tabindex="0"><table class="params">
<thead><tr><th>Option</th><th>Default</th><th>Use</th></tr></thead><tbody>
<tr><td><code>--input</code></td><td>none</td><td>Run the source id on this text or input file; <code>-</code> reads stdin. A <code>.json</code> name always means a file.</td></tr>
<tr><td><code>--input-hex</code></td><td>none</td><td>Hexadecimal UTF-8 input for programs; replaces <code>--input</code>.</td></tr>
<tr><td><code>--step</code></td><td>all frames</td><td>Selector; repeat the option or separate selectors with commas.</td></tr>
<tr><td><code>--theme</code></td><td><code>light</code></td><td>Any built-in fixed theme; see <a href="${root}themes/">Themes</a>.</td></tr>
<tr><td><code>--layout</code></td><td><code>wide</code></td><td><code>wide</code> or <code>narrow</code>.</td></tr>
<tr><td><code>--format</code></td><td><code>svg</code></td><td><code>svg</code> or <code>tikz</code>.</td></tr>
<tr><td><code>--one-file</code></td><td>off</td><td>TikZ only: combine the frames for a slide series.</td></tr>
<tr><td><code>--out</code>, <code>-o</code></td><td>current directory</td><td>Output directory, created if missing.</td></tr>
<tr><td><code>--name</code></td><td><code>{name}-{frame}</code></td><td>File stem pattern; <code>{name}</code> for one-file exports.</td></tr>
<tr><td><code>--error-file</code></td><td>none</td><td>Also write a failure message here; remove it after success.</td></tr>
</tbody></table></div>
<p>Name patterns accept <code>{name}</code> (document stem or algorithm id), <code>{frame}</code> (zero-padded number) and <code>{step}</code> (selector with slashes and hashes replaced by underscores). The matching file extension is optional. With <code>--one-file</code>, do not use <code>{frame}</code> or <code>{step}</code>. Existing output files are replaced; each written file is listed with its selector. Nothing is written until every selected figure renders.</p>
${code(
  `algomotion export sort.json --step 0,insert,-1 --format tikz --one-file --out figures --name insertion
algomotion export insertion-sort --input-hex 3520322034 --step -1 --out figures --name sorted --error-file export-error.txt`,
  'TikZ and programmatic input',
)}
<p>The hexadecimal example is <code>5 2 4</code>. Include the TikZ series with <code>\\algomotioninput{figures/insertion.tex}</code>; see <a href="${root}guide/slides/">Slides</a>. For an input file, save <code>[5,2,4]</code> as <code>values.json</code> and run:</p>
${code(`algomotion export insertion-sort --input values.json --step -1 --out figures`, 'Read an input file')}

<h2 id="errors">Failures and help</h2>
<p><code>--help</code> or <code>-h</code> prints usage. Exit code <code>0</code> means success, <code>1</code> means a failed input, document, selector or write, and <code>2</code> means a usage error, such as an unknown option, invalid pattern or using <code>--one-file</code> with SVG.</p>
${note('<p><code>render --out</code> names a file; <code>export --out</code> names a directory. A document is not an algorithm input: use <code>--input</code> only when the export source is an algorithm id.</p>')}
`,
};
