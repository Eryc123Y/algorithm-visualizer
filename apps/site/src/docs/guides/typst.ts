import type { Guide } from '../guide.ts';

export const typst: Guide = {
  slug: 'typst',
  title: 'Typst',
  nav: 'Typst',
  summary:
    'Draw a step as a vector image inside Typst. The package includes the engine, so compiling needs no external command.',
  figures: [
    {
      key: 'insert',
      algorithm: 'insertion-sort',
      input: '5 2 4 6 1 3',
      step: 'insert#2',
      alt: 'The second insertion puts 4 between 2 and 5.',
    },
    {
      key: 'print',
      algorithm: 'inorder-tree-walk',
      input: '[8,3,10,1,6]',
      step: '-1',
      theme: 'print',
      alt: 'A completed inorder traversal of a binary tree, in the print theme.',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="install">Install from the repository</h2>
<p>The package is not on Typst Universe yet. Install Typst 0.15 or later, then build the engine from the repository. The committed WebAssembly plugin needs no Rust build for normal use.</p>
${code(
  `npm ci
npm run build -w @algomotion/typst`,
  'Build the Typst engine',
)}
<p>Link or copy <code>packages/typst/package/</code> to <code>algomotion/0.1.0</code> under your local Typst packages directory. Keep the whole folder, including <code>engine.bc</code>, <code>plugin.wasm</code> and <code>lib.typ</code>. On macOS, from the repository root:</p>
${code(
  `mkdir -p "$HOME/Library/Application Support/typst/packages/local/algomotion"
ln -s "$PWD/packages/typst/package" "$HOME/Library/Application Support/typst/packages/local/algomotion/0.1.0"`,
  'Install a local package on macOS',
)}
<p>On Linux the local directory is <code>~/.local/share/typst/packages/local</code>; on Windows it is <code>%APPDATA%\\typst\\packages\\local</code>. Use <code>@local/algomotion:0.1.0</code> in imports until publication.</p>

<h2 id="one">One step</h2>
${code(
  `#import "@local/algomotion:0.1.0": algomotion

#figure(
  algomotion("insertion-sort", "5 2 4 6 1 3", step: "insert#2", width: 100%),
  caption: [The second insertion puts 4 between 2 and 5.],
)`,
  'A figure in notes',
)}
${figure('insert', 'The figure made by <code>algomotion</code> at <code>insert#2</code>.')}
<p><code>algomotion(source, input, ...)</code> returns an image. Use it in <code>figure</code>, <code>grid</code> or <code>box</code>. The source is an algorithm id with its input, or a document alone. An algorithm without input runs its first example. The <a href="${root}guide/inputs/">input notations</a> work as strings; structured inputs use Typst arrays and dictionaries.</p>
<div class="scroll" role="region" aria-label="Typst options" tabindex="0"><table class="params">
<thead><tr><th>Option</th><th>Default</th><th>Use</th></tr></thead><tbody>
<tr><td><code>step</code></td><td><code>-1</code></td><td>One frame: a number, step name or section-qualified step.</td></tr>
<tr><td><code>theme</code></td><td><code>"light"</code></td><td>A fixed built-in theme.</td></tr>
<tr><td><code>layout</code></td><td><code>auto</code></td><td><code>"narrow"</code> for notes by default; <code>"wide"</code> puts side structures beside the main one.</td></tr>
<tr><td><code>strict</code></td><td><code>false</code></td><td>Stop compilation on a diagnostic instead of drawing an error box.</td></tr>
<tr><td><code>width</code>, <code>height</code></td><td><code>auto</code></td><td>Passed to <code>image</code>. Natural size is 0.75 pt per pixel.</td></tr>
<tr><td><code>fit</code></td><td><code>"contain"</code></td><td>Image fitting: <code>"contain"</code>, <code>"cover"</code> or <code>"stretch"</code>.</td></tr>
<tr><td><code>alt</code></td><td>narration</td><td>Alternative text for a single image.</td></tr>
</tbody></table></div>
<p>Frame <code>0</code> is the initial state, <code>-1</code> the last. Step names count from 1. A section or range names several frames and belongs in a series. A misspelt selector gives an error listing the run's step names and sections.</p>

<h2 id="series">Several steps</h2>
<p><code>algomotion-series</code> returns an array of images. Its <code>steps: auto</code> selects every frame; a selector or an array selects particular frames. Results come in timeline order without repeats. All frames of a document share a canvas, so equal widths keep their scale.</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion-series

#grid(columns: 3, gutter: 8pt,
  ..algomotion-series("insertion-sort", "5 2 4 6 1 3",
    steps: (0, "insert#2", -1), width: 100%),
)`,
  'A strip of three steps',
)}
<p>The series takes <code>theme</code>, <code>layout</code>, <code>strict</code>, <code>width</code>, <code>height</code> and <code>fit</code> as above. Each image uses its own narration as alternative text. For a slide deck use <a href="${root}guide/slides/#typst"><code>algomotion-slides</code></a>, which fills the available slide region.</p>

<h2 id="documents">Read a document</h2>
<p>Make <code>sort.json</code> with <code>algomotion run insertion-sort '5 2 4' --out sort.json</code>, then pass the parsed document alone:</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion
#let run = json("sort.json")
#algomotion(run, step: -1, width: 80%)`,
  'Read JSON in Typst',
)}
<p>A Typst dictionary with <code>version</code>, <code>structures</code> and <code>steps</code> works too. See <a href="${root}guide/documents/">Documents</a> for the format.</p>

<h2 id="themes">Themes</h2>
<p>Use <code>"light"</code>, <code>"dark"</code>, <code>"print"</code>, <code>"textbook"</code>, <code>"textbook-dark"</code>, <code>"blocks"</code>, <code>"blocks-dark"</code>, <code>"answer-sheet"</code> or <code>"turbo-c"</code>. Typst takes fixed themes, not the player's <code>auto</code> or day/night pairs.</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion
#let algomotion = algomotion.with(theme: "print")
#algomotion("inorder-tree-walk", (8, 3, 10, 1, 6))`,
  'Set a theme for later figures',
)}
${figure('print', 'An inorder tree walk in the <code>print</code> theme. Text is drawn as outlines of the theme’s bundled fonts.')}

<h2 id="errors">Errors in the document</h2>
<p>An unknown algorithm, invalid input, document, selector or theme draws a box containing the diagnostic. The rest of the document still compiles. Use <code>strict: true</code> to stop instead. Invalid argument types and unknown argument names always stop compilation.</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion
#algomotion("insertion-sort", "5 x 4") // Shows INVALID_NOTATION.
// Inspect all error metadata after compiling:
// typst eval --in notes.typ 'query(<algomotion-error>).map(m => m.value)'`,
  'Find failed figures',
)}

<h2 id="figures">Use the engine's answer</h2>
<p><code>algomotion-figures</code> returns a dictionary for custom layouts. It takes <code>steps</code>, <code>theme</code> and <code>layout</code>. Check <code>ok</code> before reading the figures.</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion-figures
#let run = algomotion-figures("insertion-sort", "5 2 4", steps: (0, -1))
#if run.ok {
  grid(columns: 2, ..run.figures.map(f => figure(
    image(bytes(f.svg), format: "svg", width: 100%),
    caption: raw(f.selector),
  )))
} else {
  raw(repr(run.diagnostics))
}`,
  'Custom captions from the engine',
)}
<p>A successful answer has <code>ok: true</code>, <code>frames</code> and <code>figures</code>. Each figure has <code>frame</code>, <code>selector</code>, <code>width</code>, <code>height</code>, optional <code>narration</code> and <code>svg</code>. A failure has <code>ok: false</code> and diagnostics with a code, path, message and optional hint.</p>

<h2 id="speed">Speed and limits</h2>
<p>Loading the engine and laying out the first figure cost most of the time. More figures of the same document reuse the prepared run; unchanged figures are cached by Typst. The README's Apple M4 measurements are about 0.5 seconds to load, 0.2 seconds for a tree operation, and 11.6 seconds for the first figure of a 1,024-step bubble sort. These are reference measurements, not a time limit.</p>
${note(`<p>For a long run, <a href="${root}guide/cli/#export">export SVG files</a> outside Typst and include them with <code>image</code>. Latin and Greek text and common symbols use bundled outlines; other text uses the document's fonts. Colour emoji may appear as missing glyphs. Very deep nesting can reach the engine's recursion limit and draw an error box.</p>`)}
${code(`algomotion export insertion-sort --input '5 2 4' --step -1 --out figures --name sorted`, 'Export a figure outside Typst')}
${code(`#image("figures/sorted.svg", width: 80%)`, 'Include the exported SVG')}
`,
};
