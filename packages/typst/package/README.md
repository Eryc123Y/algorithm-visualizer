# algomotion for Typst

Step-by-step figures of algorithms and data structures in your Typst notes and slides. Name an algorithm, give it your input and pick a step, such as the moment Dijkstra's algorithm improves a distance on your graph, and get a vector figure. You can also pass a document that you wrote, or that an AI wrote for you, in the algomotion format.

The algomotion engine runs inside the package as a WebAssembly plugin, so nothing else needs to be installed. A figure is exactly the SVG that `algomotion export` writes, with its text drawn as outlines of the bundled fonts, so it looks the same everywhere.

```typ
#import "@preview/algomotion:0.1.0": algomotion

#figure(
  algomotion("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3"),
  caption: [Dijkstra's algorithm from A: the edge from B improves C from 7 to 5.],
)
```

The graph is written as an edge list, and Dijkstra's algorithm starts at its first node; see [Algorithms and inputs](#algorithms-and-inputs).

> **Not on Typst Universe yet.** Until it is published, use it as a local package:
>
> 1. In the algomotion repository, run `npm install`, then `npm run build -w @algomotion/typst` to build `engine.bc`.
> 2. Link `packages/typst/package` as `algomotion/0.1.0` in your local package directory: `~/Library/Application Support/typst/packages/local` on macOS, `~/.local/share/typst/packages/local` on Linux, `%APPDATA%\typst\packages\local` on Windows.
> 3. Import `@local/algomotion:0.1.0` instead of `@preview/algomotion:0.1.0`.
>
> The `examples/` folder next to this package has every example of this README as a file.

## One step: `algomotion`

```typ
#algomotion(source, input, step: -1, theme: "light", layout: auto, strict: false,
  width: auto, height: auto, fit: "contain", alt: auto)
```

- **`source`** is an algorithm id followed by its input, or a document alone. Without an input, the algorithm runs on its first example.
- **`step`** names one frame:
  - a frame number: `0` is the starting state, `-1` the last frame (the default);
  - a step name, counted from 1: `"relax#3"` is the third step named `relax`;
  - a step inside a section: `"insert-5/relax#2"`.

  A section alone (`"insert-5"`) or a range (`"2..5"`) names several frames, so use it with `algomotion-series`.

- **`theme`** is a built-in theme: `"light"` (the default), `"dark"`, `"print"`, `"textbook"`, `"textbook-dark"`, `"blocks"`, `"blocks-dark"`, `"answer-sheet"` or `"turbo-c"`.
- **`layout`** says where the structures an algorithm keeps besides its main one go, such as Dijkstra's priority queue or a call stack: `"narrow"`, the default here, puts them below the main structure, for a column of notes; `"wide"` puts them beside it. `algomotion-slides` draws wide by default.
- **`width`, `height`, `fit` and `alt`** are passed to `image`. `alt` defaults to the narration of the step.

`algomotion` returns an image, so it goes into `figure`, `grid`, `box` and the rest like any image. At its natural size, one pixel of the figure is 0.75 pt.

To find the step names, ask for a step that does not exist. The error lists the names the document has (see [Errors](#errors)).

### Algorithms and inputs

Every algorithm of the algomotion registry is available, with the input its schema describes. Inputs take the short notations people already write, as strings, or the structured forms as Typst values:

| Id                                                     | Input                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `insertion-sort`, `merge-sort`, `quicksort`, …         | `"5 2 4 6 1 3"`, `(5, 2, 4, 6, 1, 3)` or `(values: (5, 2, 4, 6, 1, 3))`   |
| `binary-search`                                        | `(values: "1 3 5 7 9", target: 7)`                                        |
| `inorder-tree-walk`, …                                 | `"[4, 2, 6, 1, 3, null, 7]"`, a tree in LeetCode's level order            |
| `bst.insert`, `bst.delete`, `bst.search`               | `(from: "8 3 10 1 6", key: 3)`                                            |
| `bst`, `min-heap`, … (several operations)              | `(from: "8 3 10 1 6", ops: "insert 4, delete 3")`                         |
| `min-heap.push`                                        | `(from: "5 3 8 1 9 2", value: 0)`                                         |
| `bfs`, `dijkstra`, `bellman-ford`, `prim`              | `"A-B 4, B-C 1, A-C 7"`, or `(graph: "A-B 4, B-C 1", source: "C")`        |
| `dfs`, `kruskal`, `floyd-warshall`, `topological-sort` | `"A-B 4, B-C 1, A-C 7"`; `"shirt->tie, tie->jacket"` for a directed graph |
| `lcs`, `edit-distance`                                 | `(first: "ABCBDAB", second: "BDCABA")`                                    |

- **Lists** are numbers separated by commas or spaces, optionally in brackets; a level order writes `null` for a gap.
- **Graphs** are edge lists: `-` joins an undirected edge and `->` a directed one, a number after a space is the weight, and a name alone is a node without edges. Names are letters, digits and `_`, and nodes come in the order they first appear. A graph algorithm starts at the first node unless `source` (`root` for Prim) says otherwise.
- **Operations** are written as exercises write them, each with its arguments in order: `"insert 4, delete 3"`.
- An input that needs only one thing may be that thing alone, as the table's first and graph rows show. The structured forms work too, such as `(graph: (nodes: ("A", "B"), edges: (("A", "B", 4),)), source: "A")`.

`algomotion recipes` (the command line) lists every id with the JSON Schema of its input, and `examples/inputs.typ` draws each row of this table. An input that does not fit is reported with the path of the wrong field, such as `$.input.key`, and a notation with the token and its position, such as `INVALID_NOTATION at $.input: Expected a weight or "," after "B-C", not "x" (character 12)`.

## Several steps: `algomotion-series`

```typ
#algomotion-series(source, input, steps: auto, theme: "light", layout: auto,
  strict: false, width: auto, height: auto, fit: "contain")
```

It returns an array of images, one per frame, each with its step's narration as `alt`. `steps: auto` means every frame; otherwise give one selector or an array of them, in any order. Sections and ranges count too, and the frames come out in timeline order, without repeats.

All figures of a document share one canvas, the largest of its frames. They therefore line up at one scale when you place them at their natural size or all at one width:

```typ
#import "@preview/algomotion:0.1.0": algomotion-series

#grid(
  columns: 3,
  gutter: 8pt,
  ..algomotion-series("bst.delete", (from: (8, 3, 10, 1, 6), key: 3), width: 100%),
)
```

## Slides: `algomotion-slides`

```typ
#algomotion-slides(only, source, input, steps: auto, start: 1, theme: "light",
  layout: auto, strict: false, width: auto, height: auto, fit: "contain")
```

It steps through a series in a slide deck, one frame per subslide, with your slide framework's own `only`. All frames share one box, sized by the first, so nothing moves from subslide to subslide. With [touying](https://typst.app/universe/package/touying):

```typ
#import "@preview/touying:0.8.0": *
#import themes.simple: *
#import "@preview/algomotion:0.1.0": algomotion-slides

#show: simple-theme.with(aspect-ratio: "16-9")

== Dijkstra's algorithm, step by step

#align(center, algomotion-slides(only, "dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2"))
```

With [polylux](https://typst.app/universe/package/polylux), the same call goes inside `#slide[…]`, with polylux's `only`.

- **`only`** is the framework's `only`, passed in, as algomotion does not import a framework. It works with any function that takes a subslide number or a string such as `"3-"`, and a body. polylux 0.4.0 and touying 0.8.0 are tested.
- **`steps`** selects the frames as for `algomotion-series`: `auto` for every frame, a range such as `"relax#2..-1"`, a section such as `"insert-5"`, or an array of selectors.
- **`start`** is the subslide of the first frame. The last frame stays from its subslide to the end of the slide. Neither framework's `only` follows `#pause`, so after a `#pause` in touying, give the subslide yourself, such as `start: 2`.
- **Size.** A frame fills the slide: it is as large as fits in the width of the region it is in and three quarters of its height, keeping its shape. A tall figure no longer runs off the slide, and a narrow one grows past its natural size. `width` and `height` replace their side of that box only, so `height: 60%` leaves room for text and is still capped by the width; they take lengths, ratios and relative lengths such as `100% - 2cm`. Two series side by side go in a `grid`, whose cells are the regions they fill. With `fit: "contain"`, the default, the series' box is the figure's size; `"cover"` and `"stretch"` make every frame the box itself, as `image` does. Figures of one document share a canvas, so they come out at one scale on slides with the same room. Each frame keeps its step's narration as `alt`.
- **One figure on a slide.** `algomotion` and `algomotion-series` keep their natural size, as they cannot tell a slide from a page; use `algomotion-slides` with one step, such as `steps: "relax#3"`, to fill the slide.
- A series of one frame is the image alone, on every subslide. An error shows in a box, as for `algomotion`.
- In touying's handout mode, which keeps the last subslide of each slide, a series shows its last frame.

`examples/slides-polylux.typ` and `examples/slides-touying.typ` step through a whole run, a range from the second subslide, and a section.

## Documents

A document is the JSON format algomotion draws from: its structures, and a timeline of steps that apply actions such as `compare` or `swap`. Read one with `json` and pass it in place of the algorithm and its input:

```typ
#let heap = json("heap.json")

#algomotion(heap, step: "pop/swap#1", width: 60%)
```

`algomotion run <id> <input>` writes the document of an algorithm. A model can write one through the algomotion MCP server, which also checks it.

## Themes

Every function takes `theme:`, and every theme works in notes, in series and on slides. The figures look the same as in the player and in `algomotion export`, because the package draws their text with the theme's own fonts.

| `theme`           | 中文            | Look                                                                              |
| ----------------- | --------------- | --------------------------------------------------------------------------------- |
| `"light"`         | 默认            | The default                                                                       |
| `"dark"`          | 深色            | Light on dark, with its own background                                            |
| `"print"`         | 打印            | Greyscale, for handouts                                                           |
| `"textbook"`      | 课本批注        | Black ink, highlighter and pens on a textbook figure, in STIX Two Text            |
| `"textbook-dark"` | 课本批注 · 夜间 | The same page in night mode                                                       |
| `"blocks"`        | 积木教具        | Bold classroom blocks, in Lexend                                                  |
| `"blocks-dark"`   | 积木教具 · 夜间 | The same blocks on a dark mat                                                     |
| `"answer-sheet"`  | 答题卡          | Red printed frames and pencil marks, in Noto Sans; prints well in black and white |
| `"turbo-c"`       | 机房 Turbo C    | The blue Turbo C screen, in the pixel font DotGothic16                            |

```typ
#algomotion("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "relax#3", theme: "textbook")
```

The night themes and Turbo C paint their own background, so they read on white paper too; the light ones are transparent. To change the theme of a whole document, use `with`:

```typ
#let algomotion = algomotion.with(theme: "textbook")
#let algomotion-series = algomotion-series.with(theme: "textbook")
```

## Errors

If the algorithm, its input, the document, the step or the theme is wrong, a box with the error takes the figure's place, and the rest of the document still compiles. Each error has a code, the path of what is wrong, a message and often a hint. A wrong step's hint lists the step names and sections of the document.

- Pass `strict: true` to stop compilation with the error instead.
- Every error box carries its diagnostics as `metadata` labelled `<algomotion-error>`, so you can list the failed figures of a document:

  ```sh
  typst eval --in notes.typ 'query(<algomotion-error>).map(m => m.value)'
  ```

Arguments of the wrong type, such as a number for `theme` or a misspelt argument name, stop compilation, as with Typst's own functions.

## The engine's data: `algomotion-figures`

`algomotion-figures(source, input, steps: auto, theme: "light", layout: auto)` returns the engine's answer as a dictionary, for captions and custom layouts:

```typ
#let series = algomotion-figures("bst.delete", (from: (8, 3, 10, 1, 6), key: 3), steps: (0, -1))
#grid(columns: 2, ..series.figures.map(f => figure(
  image(bytes(f.svg), format: "svg"),
  caption: raw(f.selector),
)))
```

- On success, it is `(ok: true, frames: n, figures: …)`. Each figure has its `frame` number, its `selector` (such as `"delete-3/no-left"`), `width` and `height` in pixels, its step's `narration` when it has one, and the `svg` text.
- On failure, it is `(ok: false, diagnostics: …)`, with the `code`, `path`, `message` and `hint` of each error.

## Speed

The engine is JavaScript that runs in Typst's WebAssembly interpreter, so it is much slower than in a browser. Measured with `typst compile` on an Apple M4:

- **Loading the engine** takes about 0.5 s each time Typst compiles from scratch. Editors, `typst watch` and the web app keep it loaded, so they pay it once.
- **The first figure of a document** costs time in proportion to its number of steps, because every frame is laid out to find the shared canvas:
  - about 0.2 s for a binary search tree operation;
  - about 0.7 s for Dijkstra's algorithm on six vertices;
  - 11.6 s for bubble sort on 32 numbers in reverse order, which has 1,024 steps.
- **More figures of the same document** cost a few tens of milliseconds each.
- **A figure that did not change** costs nothing when Typst compiles again.

There is no time limit. For very long documents, `algomotion export` writes the SVG files outside Typst, and `image` includes them.

## Limits

- Text is drawn as outlines for Latin and Greek letters, digits and common symbols. Other text, such as Chinese characters or emoji, stays text, drawn by your document's fonts. Typst shows colour emoji in SVG images as missing glyphs.
- Recursion in the engine stops at a few hundred levels, with an error in place of the figure. This is far deeper than any algorithm of the registry goes, but a hand-written document with very deep nesting could reach it.

## Licence

The package is free software under the GNU General Public License, version 3 or later (`LICENSE`). The figures it draws are yours. The bundled fonts, whose outlines draw the figures' text (JetBrains Mono, Inter, STIX Two Text, Lexend, Noto Sans, Noto Sans Mono and DotGothic16), are under the SIL Open Font License 1.1 (`OFL.txt`).
