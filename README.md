# algoviz (working name)

An AI-native library for step-by-step visualizations of algorithms and data structures, for developers and teachers.

A visualization is a declarative JSON document: the structures involved and a timeline of steps, each applying actions such as `compare` or `swap`. People write it with code, LLMs write it directly, and the library validates it and renders it as an interactive player, a static image, or a figure in Typst or LaTeX.

> Status: early development. Eight structure kinds work end to end (protocol, timeline engine, layout, static SVG and an interactive player), with ready-made visualizations of the classic undergraduate algorithms, and an MCP server through which models write, check and render documents.

```json
{
  "version": "0.1",
  "structures": { "arr": { "kind": "array", "initial": [5, 3, 8, 1] } },
  "steps": [
    {
      "actions": [{ "target": "arr", "type": "compare", "i": 0, "j": 1 }],
      "meta": { "line": 3, "narration": "Compare 5 and 3." }
    },
    {
      "actions": [{ "target": "arr", "type": "swap", "i": 0, "j": 1 }],
      "meta": { "line": 4, "narration": "5 > 3, so swap them." }
    }
  ]
}
```

## Structures

| Kind            | For                                                        | Notable actions                                              |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `array`         | sorting, searching, two pointers; `view: "heap"` for heaps | `compare` `swap` `set` `insert` `remove` `pointer` `settle`  |
| `stack`         | call stacks, bracket matching, DFS                         | `push` `pop` `peek`                                          |
| `queue`         | BFS, schedulers; also a deque                              | `enqueue` `dequeue` `pushFront` `popBack` `peek`             |
| `linkedList`    | singly, doubly and circular lists                          | `insert` `remove` `link` `pointer` `visit`                   |
| `tree`          | BST, AVL, red–black, tries, recursion trees, union–find    | `addNode` `setChild` `rotate` `setColor` `annotate` `visit`  |
| `graph`         | traversals, shortest paths, spanning trees, flows          | `addEdge` `setWeight` `markEdge` `annotate` `visit` `settle` |
| `table`         | dynamic programming, adjacency matrices                    | `set` `depend` `highlight` `settle`                          |
| `hashTable`     | separate chaining                                          | `insert` `remove` `highlight` `settle`                       |
| `priorityQueue` | Dijkstra's and Prim's queue: items in key order            | `insert` `extract` `setKey` `peek`                           |

Shorthands keep documents short: `"initial": [5, 3, 8]` generates element ids, a tree can be given in LeetCode `levelOrder`, and a graph as `"nodes": ["A", "B"]` with `"edges": [["A", "B", 4]]`. The JSON Schema is in [`packages/spec/schema`](packages/spec/schema).

## Recipes

`@algoviz/recipes` holds ready-made visualizations of classic algorithms and data structures, and a typed recorder for producing documents from running code.

Every algorithm, and every operation of a data structure, is a module of one registry ([ADR 0019](docs/adr/0019-algorithm-registry.md)) with a stable id, a Zod input schema, examples, and its code in pseudocode and Python. `runAlgorithm(id, input)` checks the input, records the run and validates the document:

```ts
import { runAlgorithm, Recorder } from '@algoviz/recipes';

// Delete 3 from the tree that inserting these keys builds.
const run = runAlgorithm('bst.delete', { from: [8, 3, 10, 1, 6], key: 3 });
if (run.ok) console.log(run.value.document, run.value.after);
else console.error(run.error); // e.g. INVALID_SHAPE at $.input.key

// Or record your own: every handle method is typed from the protocol.
const r = new Recorder({ title: 'Swap' });
const a = r.add('a', { kind: 'array', initial: [2, 1] });
r.step('Swap the two values.');
a.swap({ i: 0, j: 1 });
const mine = r.build();
```

The registry holds these modules, by topic ([ADR 0022](docs/adr/0022-registry-details.md), [ADR 0023](docs/adr/0023-remaining-modules.md)). They follow the procedures of CLRS where CLRS has them.

- **Sorting:** `insertion-sort`, `merge-sort`, `heapsort`, `quicksort`, `counting-sort`, `bubble-sort`, `selection-sort`.
- **Searching:** `binary-search`.
- **Lists:** `reverse-linked-list`, `move-to-front`, `balanced-brackets`.
- **Trees:** `bst` (search, insert, delete), `avl` (insert), `red-black-tree` (insert, delete), `order-statistic-tree` (select, rank, insert, delete), `interval-tree` (search, insert, delete), `b-tree` (search, insert, delete), `inorder-tree-walk`, `preorder-tree-walk`, `postorder-tree-walk`, `trie` (insert, search), `disjoint-set` (union, find-set).
- **Heaps:** `min-heap` (push, pop, decrease-key), `max-heap` (push, pop, increase-key), `fibonacci-heap` (insert, union, extract-min, decrease-key, delete).
- **Hashing:** `hash-chaining` and `linear-probing`, each with insert and search.
- **Graphs:** `bfs`, `dfs`, `topological-sort`, `strongly-connected-components`, `dijkstra`, `bellman-ford`, `dag-shortest-paths`, `prim`, `kruskal`, `floyd-warshall`, `transitive-closure`, `johnson`, `edmonds-karp`, `bipartite-matching`, `hopcroft-karp`, `gale-shapley`, `hungarian`, `approx-vertex-cover`, `approx-tsp-tour`.
- **Dynamic programming:** `lcs`, `edit-distance`, `knapsack`.
- **Greedy algorithms:** `huffman`.
- **String matching:** `naive-string-matcher`, `rabin-karp`, `finite-automaton-matcher`, `kmp`, `suffix-array`.
- **Computational geometry:** `any-segments-intersect`, `graham-scan`, `jarvis-march`, `closest-pair`.
- **Algebra and number theory:** `lup-decomposition`, `fft`, `euclid`, `extended-euclid`, `modular-exponentiation`.

A data structure has one module per operation, such as `bst.delete`, which starts from a structure the caller describes, and one for its sequence, such as `bst`, which runs up to 8 operations. `algorithms` lists every module.

### Inputs

Inputs take the notations people already write ([ADR 0032](docs/adr/0032-algorithm-and-input.md)), in every output: the command line, MCP, the player, Typst and LaTeX. The structured JSON forms work too.

| Input                                      | Notation                                               | Structured form                               |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------- |
| a list, such as values to sort or a heap's | `"5 2 4 6 1 3"`, `"5, 2, 4"`, `"[5, 2, 4]"`            | `[5, 2, 4, 6, 1, 3]`                          |
| a tree in level order (LeetCode's)         | `"[4, 2, 6, 1, 3, null, 7]"`                           | `[4, 2, 6, 1, 3, null, 7]`                    |
| a graph                                    | `"A-B 4, B-C 2, A-C 7"`, `"s->t 3"` for directed edges | `{"nodes": […], "edges": [["A", "B", 4], …]}` |
| a data structure's operations              | `"insert 4, delete 3"`                                 | `[{"op": "insert", "key": 4}, …]`             |

In a graph, `-` joins an undirected edge and `->` a directed one, a number after a space is the weight, and a name alone is a node with no edges; names are letters, digits and `_`. Nodes come in the order they first appear.

An input whose algorithm needs only one thing may be that thing alone: `"5 2 4 6 1 3"` for a sort, a level order for a tree walk, a graph for a graph algorithm, which then starts at the first node (`"source"` or `"root"` picks another). An algorithm given no input runs on its first example. An input that does not parse says where:

```text
INVALID_NOTATION at $.input.graph: Expected a weight or "," after "B-C", not "x" (character 12)
```

```sh
algoviz run dijkstra 'A-B 4, B-C 1, A-C 7, C-D 2'
algoviz run bst '"from": [8, 3, 10, 1, 6], "ops": "insert 4, delete 3"'
algoviz run insertion-sort        # the first example
```

On the command line, an input is JSON, a JSON object with its outer braces left out, or else a notation; `--input` also takes a file.

MCP, the `algoviz` command line and the playground's example menu read the registry, grouped by topic.

## For models

[`@algoviz/mcp`](packages/mcp) lets a model write documents: it reads a guide written for models, validates its document (every step is replayed, and each error says where and why), inspects the state at any frame to check the result, and renders frames to SVG. In clients that display MCP Apps, `algoviz_show` then opens the interactive player right in the conversation. For a ready-made algorithm a model writes no document at all: `algoviz_show { "recipe": "dijkstra", "input": "A-B 4, B-C 1, A-C 7" }` shows it, and `algoviz_render` and `algoviz_inspect` take a recipe the same way. The same tools work as the `algoviz` command line. [`evals/`](evals) measures how well models do on 28 undergraduate tasks, each checked for what a correct visualization must show.

## Figures

`algoviz export` writes chosen steps of a document as standalone SVG files, ready for notes, handouts and slides ([ADR 0025](docs/adr/0025-exporting-figures.md)). Text is drawn as glyph outlines of the bundled fonts, so a figure looks the same in a browser, in Typst and after conversion for LaTeX. Every figure of a document has the same size, so a series of steps lines up at one scale, even when its figures are exported one at a time.

```sh
# Every frame of a document: doc-00.svg, doc-01.svg, …
algoviz export doc.json --out figures

# Run an algorithm on an input, without writing a document first
algoviz export dijkstra --input 'A-B 4, B-C 1, A-C 7, C-D 2' --step improve#3 --out figures

# Several steps, in the print theme, named after their steps
algoviz export bst.delete --input '"from": "8 3 10 1 6", "key": 3' \
  --step delete-3 --theme print --name '{name}-{step}'
```

`--step` takes the selectors the player takes: a frame number (`-1` is the last), a step name (`relax#3`), a step in a section (`insert-5/relax`), a section (`insert-5`) or a range (`a..b`). It may repeat or list several with commas, and every frame is exported without it. `--theme` picks a built-in theme: `light` (the default), `dark`, `print`, `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` or `turbo-c` ([ADR 0030](docs/adr/0030-built-in-themes.md)). `--out` is the directory, the current one by default. `--name` is the file name pattern, `{name}-{frame}` by default: `{name}` is the document file's name or the algorithm id, `{frame}` the frame number padded with zeros, and `{step}` the step's selector with `/` and `#` written `_`, such as `insert-5_relax_2`. Each step's narration goes into its figure as an SVG description.

A figure draws the structures an algorithm keeps besides its main one, such as Dijkstra's priority queue or a call stack, in a side panel ([ADR 0029](docs/adr/0029-auxiliary-structures.md)). `--layout wide`, the default, puts the side panel right of the main structure, for slides and web pages; `--layout narrow` puts it below, for a column of notes. The Typst and LaTeX packages draw narrow in notes and wide on slides by default, and take `layout` too.

`--format tikz` writes the same figures as TikZ in `.tex` files, with text left to the fonts of the LaTeX document that includes them ([ADR 0027](docs/adr/0027-latex-package.md)). The command also builds as a standalone 2 MB executable that needs no Node.js; see [the CLI's README](packages/mcp/README.md#without-nodejs).

In Typst, [the algoviz package](packages/typst/package/README.md) draws the same figures from inside a document, with the engine running in a WebAssembly plugin, so students need nothing but Typst ([ADR 0026](docs/adr/0026-typst-package.md)):

```typ
#import "@preview/algoviz:0.1.0": algoviz, algoviz-series

#algoviz("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "relax#3")
#grid(columns: 3, ..algoviz-series("bst.delete", (from: "8 3 10 1 6", key: 3)))
```

The package is not on Typst Universe yet; its README says how to use it as a local package until it is.

In LaTeX, [the algoviz package](packages/latex/package/README.md) draws them with TikZ, so their text is set in the document's own fonts ([ADR 0027](docs/adr/0027-latex-package.md)). It runs the `algoviz` command through shell escape, as `minted` does, and caches every figure, so later runs need no shell escape:

```latex
\usepackage{algoviz}

\algoviz[step=relax#3]{dijkstra}{A-B 4, B-C 1, A-C 7, C-D 2}
\algoviz{bst}{"from": "8 3 10 1 6", "ops": "insert 4, delete 3"}
\algovizfile[step=delete-3/copy, theme=print, width=0.6\linewidth]{bst-delete.json}
```

The package is not on CTAN yet; its README says how to use it, and how to build the standalone `algoviz` it calls, until it is.

In slides, a series steps through one frame per overlay, all in one picture ([ADR 0028](docs/adr/0028-slides.md)): `steps` in a Beamer frame, and `algoviz-slides` with polylux's or touying's own `only` in Typst. A slide figure fills the frame's width and three quarters of its height, keeping its shape; `height` gives another share ([ADR 0033](docs/adr/0033-slide-figures-fill-the-frame.md)).

```latex
\begin{frame}{Dijkstra's algorithm}
  \algovizfile[algorithm=dijkstra, steps]{graph.json}   % one slide per frame
\end{frame}
```

```typ
#algoviz-slides(only, "dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", steps: "relax#1..-1")
```

In code, `exportFigures(document, { steps, theme, layout })` from `@algoviz/svg` returns the same figures as strings, and `selectSeries` from `@algoviz/core` the frames that selectors name. `prepareFigures(document, { theme, layout })` loads a document once and then draws a figure of any frame, or any series, on demand.

## Embedding

Build the standalone bundle with `npm run build -w @algoviz/elements`, then name an algorithm and give its input ([ADR 0032](docs/adr/0032-algorithm-and-input.md)):

```html
<script type="module" src="algoviz-player.js"></script>

<algo-player algorithm="insertion-sort" input="5 2 4 6 1 3"></algo-player>
<algo-player
  algorithm="dijkstra"
  input="A-B 4, B-C 1, A-C 7, C-D 2"
  frame="improve#3"
></algo-player>
```

`algorithm` is any id of the registry ([Recipes](#recipes)), and `input` takes JSON, an object without its outer braces, or a notation ([Inputs](#inputs)). Without `input`, the algorithm runs on its first example. With `algorithm`, `src` or an inline `<script type="application/json">` may hold the input instead, and the `input` property takes any value, such as an object. An input that does not fit shows in the player, with the token where it went wrong, and fires `algo-error`.

The registry is a second file of the bundle, `algoviz-recipes.js`, which the player loads from next to itself the first time a player has `algorithm`: 146 KB, 40 KB gzipped, on top of the player's 407 KB (104 KB). Keep the two files together under these names. A page that shows only documents never loads it:

```html
<algo-player theme="auto">
  <script type="application/json">
    { "version": "0.1", "structures": { … }, "steps": [ … ] }
  </script>
</algo-player>
```

Attributes: `algorithm`, `input`, `src`, `frame`, `theme` (a built-in theme, `auto` for light or dark by the reader's colour scheme, or a day and a night theme such as `"textbook textbook-dark"`), `layout` (`wide`, the default, or `narrow`, which puts side structures below the main one for a narrow column), `speed` (ms per step), `autoplay`, `loop`, `hide-controls`, `hide-code`, `language`. Style the chrome with CSS custom properties such as `--algo-accent`, or its corners with `--algo-radius` (the player), `--algo-control-radius` (buttons and menus) and `--algo-panel-radius` (the code panel), or pass a full scene theme as the `customTheme` property.

Each theme draws in its own fonts. The player links `fonts/fonts.css`, next to its script, the first time a player shows, and the browser downloads only the font files a page draws. A bundler that puts the fonts elsewhere says where with `AlgoPlayer.fontsUrl = '/assets/fonts.css'`, and `AlgoPlayer.fontsUrl = null` turns loading off: text then falls back to similar fonts installed on the reader's system.

`frame` takes a frame number or a selector that names a step by meaning, so a link or a page keeps showing the same step when a document gains steps elsewhere: `frame="relax#3"` (the third step named `relax`), `frame="insert-5/fixup-case-3"` (counting inside section `insert-5`), `frame="insert-5"` (that section, from its first step) or `frame="-1"` (the last frame). Documents give steps names with `meta.id` and group them into `sections` ([ADR 0020](docs/adr/0020-step-names-and-sections.md)); the timeline shows the sections, and Page Up and Page Down move between them. Page scripts read `player.stepName` and `player.section` (the section's id, title and start), and the `algo-frame` event carries `stepName` and `sectionId`. The `frame` property reads back as a number once the document has loaded.

A document can give its code in several languages, such as pseudocode in the conventions of CLRS and Python, with steps pointing at an anchor in each (`sources` and `meta.at`, [ADR 0017](docs/adr/0017-multi-language-source.md)). The player then shows a menu of the languages above the code and keeps the frame when the reader switches. Pseudocode comes first unless `language="python"` asks for another. Once a reader picks a language, that choice wins over both. It is remembered for the site when the browser allows local storage, and otherwise for the page, and every player follows it, also in other tabs. `player.currentLanguage` says which language is on show. The BST and heap operations come in both languages.

For a purely visual animation without any teaching chrome, use display mode: it shows only the structures, plays and loops by itself, and pauses while off screen.

```html
<algo-player mode="display" speed="700" src="bubble-sort.json"></algo-player>
```

Display mode also accepts `once` (play a single time) and `motion` (`linear` · `arc`).

## Themes

Every output draws in the same nine built-in themes, and every theme works in every output: the player, SVG, the Typst and LaTeX packages, slides and print. Pick one by name; `light` is the default everywhere ([ADR 0030](docs/adr/0030-built-in-themes.md)).

| Theme           | 中文            | For                                                                                       |
| --------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `light`         | 默认            | The default: web pages, notes and slides                                                  |
| `dark`          | 深色            | Dark pages and slides                                                                     |
| `print`         | 打印            | Greyscale handouts; every role keeps a cue that is not colour                             |
| `textbook`      | 课本批注        | A textbook figure marked up with highlighter and pens; reads naturally in Typst and LaTeX |
| `textbook-dark` | 课本批注 · 夜间 | The same page in a reader's night mode                                                    |
| `blocks`        | 积木教具        | Classroom blocks in bold colours, for introductory classes and slides                     |
| `blocks-dark`   | 积木教具 · 夜间 | The same blocks on a dark mat                                                             |
| `answer-sheet`  | 答题卡          | An exam answer sheet: red printed frames, pencil marks; prints well in black and white    |
| `turbo-c`       | 机房 Turbo C    | The blue Turbo C screen of university computer labs, in the sixteen CGA colours           |

| Output            | How to pick a theme                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `<algo-player>`   | `theme="textbook"`; `theme="auto"` (light or dark by the reader's colour scheme); `theme="textbook textbook-dark"` |
| `algoviz` command | `algoviz export … --theme blocks`, `algoviz render … --theme dark`                                                 |
| MCP               | the render tool's `theme`                                                                                          |
| Typst             | `#algoviz("dijkstra", input, theme: "textbook")`, and in `algoviz-series`, `algoviz-figures`, `algoviz-slides`     |
| LaTeX             | `\algoviz[theme=answer-sheet]{…}{…}`, or `\algovizset{theme=answer-sheet}` for the whole document                  |
| `@algoviz/svg`    | `renderSvg(scene, { theme: 'turbo-c' })`, `exportFigures(doc, { theme: 'turbo-c' })`                               |

- **Fonts.** Each theme names its typefaces, all under the SIL Open Font License. Standalone SVG and Typst draw text as outlines of the bundled faces, so a figure looks the same everywhere. The player loads the theme's web fonts from beside its script. LaTeX sets text in the document's own fonts, in the family the theme names: serif for the textbook themes, sans serif for blocks, typewriter for Turbo C. Chinese and other CJK text is drawn by the reader's or the document's fonts.
- **Night themes** (`dark`, `textbook-dark`, `blocks-dark`, `turbo-c`) paint their own background, so they stay legible on white paper; the light ones take the page's colour. A player set to `auto` or to a day-and-night pair prints in its day theme.
- **Your own.** `createTheme('textbook', { cell: { compare: { fill: '#ffd' } } })` derives a theme from any built-in one, for the player's `customTheme` and the library calls. The player's chrome takes CSS custom properties such as `--algo-accent`.

## Packages

| Package                                  | Status    | Purpose                                                            |
| ---------------------------------------- | --------- | ------------------------------------------------------------------ |
| [`@algoviz/spec`](packages/spec)         | Available | Protocol schemas, types, validation and JSON Schema                |
| [`@algoviz/fonts`](packages/fonts)       | Available | Metrics and outlines of the bundled fonts, and text measurement    |
| [`@algoviz/core`](packages/core)         | Available | Structure kinds, reducers, timeline engine and layout to scenes    |
| [`@algoviz/svg`](packages/svg)           | Available | Standalone SVG figures with text as glyph outlines (no DOM needed) |
| [`@algoviz/tikz`](packages/tikz)         | Available | TikZ figures for the LaTeX package, from the SVG painter's shapes  |
| [`@algoviz/elements`](packages/elements) | Available | `<algo-player>`: interactive, animated player (Lit Web Component)  |
| [`@algoviz/recipes`](packages/recipes)   | Available | Typed recorder and visualizations of classic algorithms            |
| [`@algoviz/mcp`](packages/mcp)           | Available | MCP server, MCP App and CLI: guide, validation, inspection, export |
| [`algoviz` for Typst](packages/typst)    | Local     | Typst package: figures and slides, via a Wasm plugin               |
| [`algoviz` for LaTeX](packages/latex)    | Local     | LaTeX package: TikZ figures in the document's fonts, via the CLI   |

## Design

What version 1.0 must do is in [`docs/requirements.md`](docs/requirements.md), and the order of work in [`docs/roadmap.md`](docs/roadmap.md).

The architecture is documented as decision records in [`docs/adr/`](docs/adr). In short: traces are event-sourced (actions are the source of truth and states are derived by pure reducers), layout is a pure function so the same visualization can be rendered anywhere, and every document is validated before rendering with errors an LLM can act on.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
