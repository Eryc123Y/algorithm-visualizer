# algoviz for Typst

Step-by-step figures of algorithms and data structures in your Typst notes and slides. Name an algorithm, give it your input and pick a step, such as the moment Dijkstra's algorithm improves a distance on your graph, and get a vector figure. You can also pass a document that you wrote, or that an AI wrote for you, in the algoviz format.

The algoviz engine runs inside the package as a WebAssembly plugin, so nothing else needs to be installed. A figure is exactly the SVG that `algoviz export` writes, with its text drawn as outlines of the bundled fonts, so it looks the same everywhere.

```typ
#import "@preview/algoviz:0.1.0": algoviz

#let graph = (
  nodes: ("A", "B", "C", "D"),
  edges: (("A", "B", 4), ("B", "C", 1), ("A", "C", 7), ("C", "D", 2)),
)

#figure(
  algoviz("dijkstra", (graph: graph, source: "A"), step: "improve#3"),
  caption: [Dijkstra's algorithm from A: the edge from B improves C from 7 to 5.],
)
```

> **Not on Typst Universe yet.** Until it is published, use it as a local package:
>
> 1. In the algoviz repository, run `npm install`, then `npm run build -w @algoviz/typst` to build `engine.bc`.
> 2. Link `packages/typst/package` as `algoviz/0.1.0` in your local package directory: `~/Library/Application Support/typst/packages/local` on macOS, `~/.local/share/typst/packages/local` on Linux, `%APPDATA%\typst\packages\local` on Windows.
> 3. Import `@local/algoviz:0.1.0` instead of `@preview/algoviz:0.1.0`.
>
> The `examples/` folder next to this package has every example of this README as a file.

## One step: `algoviz`

```typ
#algoviz(source, input, step: -1, theme: "light", strict: false,
  width: auto, height: auto, fit: "contain", alt: auto)
```

- **`source`** is an algorithm id followed by its input, or a document alone.
- **`step`** names one frame:
  - a frame number: `0` is the starting state, `-1` the last frame (the default);
  - a step name, counted from 1: `"relax#3"` is the third step named `relax`;
  - a step inside a section: `"insert-5/relax#2"`.

  A section alone (`"insert-5"`) or a range (`"2..5"`) names several frames, so use it with `algoviz-series`.

- **`theme`** is `"light"`, `"dark"` or `"print"`.
- **`width`, `height`, `fit` and `alt`** are passed to `image`. `alt` defaults to the narration of the step.

`algoviz` returns an image, so it goes into `figure`, `grid`, `box` and the rest like any image. At its natural size, one pixel of the figure is 0.75 pt.

To find the step names, ask for a step that does not exist. The error lists the names the document has (see [Errors](#errors)).

### Algorithms and inputs

Every algorithm of the algoviz registry is available, with the input its schema describes. A few examples:

| Id                                             | Input                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `insertion-sort`, `merge-sort`, `quicksort`, … | `(values: (5, 2, 4, 6, 1, 3))`                                       |
| `binary-search`                                | `(values: (1, 3, 5, 7, 9), target: 7)`                               |
| `bst.insert`, `bst.delete`, `bst.search`       | `(from: (8, 3, 10, 1, 6), key: 3)`                                   |
| `min-heap.push`                                | `(from: (5, 3, 8, 1, 9, 2), value: 0)`                               |
| `bfs`, `dijkstra`, `bellman-ford`              | `(graph: (nodes: ("A", "B"), edges: (("A", "B", 4),)), source: "A")` |
| `prim`                                         | `(graph: …, root: "A")`                                              |
| `dfs`, `kruskal`, `floyd-warshall`             | `(graph: …)`                                                         |
| `lcs`, `edit-distance`                         | `(first: "ABCBDAB", second: "BDCABA")`                               |

`algoviz recipes` (the command line) lists every id with the JSON Schema of its input, and `examples/inputs.typ` draws each row of this table. An input that does not fit the schema is reported with the path of the wrong field, such as `$.input.key`.

## Several steps: `algoviz-series`

```typ
#algoviz-series(source, input, steps: auto, theme: "light", strict: false,
  width: auto, height: auto, fit: "contain")
```

It returns an array of images, one per frame, each with its step's narration as `alt`. `steps: auto` means every frame; otherwise give one selector or an array of them, in any order. Sections and ranges count too, and the frames come out in timeline order, without repeats.

All figures of a document share one canvas, the largest of its frames. They therefore line up at one scale when you place them at their natural size or all at one width:

```typ
#import "@preview/algoviz:0.1.0": algoviz-series

#grid(
  columns: 3,
  gutter: 8pt,
  ..algoviz-series("bst.delete", (from: (8, 3, 10, 1, 6), key: 3), width: 100%),
)
```

## Slides: `algoviz-slides`

```typ
#algoviz-slides(only, source, input, steps: auto, start: 1, theme: "light",
  strict: false, width: auto, height: auto, fit: "contain")
```

It steps through a series in a slide deck, one frame per subslide, with your slide framework's own `only`. All frames share one box, sized by the first, so nothing moves from subslide to subslide. With [touying](https://typst.app/universe/package/touying):

```typ
#import "@preview/touying:0.8.0": *
#import themes.simple: *
#import "@preview/algoviz:0.1.0": algoviz-slides

#show: simple-theme.with(aspect-ratio: "16-9")

== Dijkstra's algorithm, step by step

#align(center, algoviz-slides(only, "dijkstra", (graph: graph, source: "A"), height: 75%))
```

With [polylux](https://typst.app/universe/package/polylux), the same call goes inside `#slide[…]`, with polylux's `only`.

- **`only`** is the framework's `only`, passed in, as algoviz does not import a framework. It works with any function that takes a subslide number or a string such as `"3-"`, and a body. polylux 0.4.0 and touying 0.8.0 are tested.
- **`steps`** selects the frames as for `algoviz-series`: `auto` for every frame, a range such as `"relax#2..-1"`, a section such as `"insert-5"`, or an array of selectors.
- **`start`** is the subslide of the first frame. The last frame stays from its subslide to the end of the slide. Neither framework's `only` follows `#pause`, so after a `#pause` in touying, give the subslide yourself, such as `start: 2`.
- **`width`, `height` and `fit`** size every frame as for `algoviz`; relative sizes such as `height: 75%` work in both frameworks. Each frame keeps its step's narration as `alt`.
- A series of one frame is the image alone, on every subslide. An error shows in a box, as for `algoviz`.
- In touying's handout mode, which keeps the last subslide of each slide, a series shows its last frame.

`examples/slides-polylux.typ` and `examples/slides-touying.typ` step through a whole run, a range from the second subslide, and a section.

## Documents

A document is the JSON format algoviz draws from: its structures, and a timeline of steps that apply actions such as `compare` or `swap`. Read one with `json` and pass it in place of the algorithm and its input:

```typ
#let heap = json("heap.json")

#algoviz(heap, step: "pop/swap#1", width: 60%)
```

`algoviz run <id> <input>` writes the document of an algorithm. A model can write one through the algoviz MCP server, which also checks it.

## Themes

- `"light"` is the default.
- `"print"` is greyscale.
- `"dark"` is meant for dark pages. Its background is transparent, so put it on a dark page or block.

To change a default for a whole document, use `with`:

```typ
#let algoviz = algoviz.with(theme: "print")
```

## Errors

If the algorithm, its input, the document, the step or the theme is wrong, a box with the error takes the figure's place, and the rest of the document still compiles. Each error has a code, the path of what is wrong, a message and often a hint. A wrong step's hint lists the step names and sections of the document.

- Pass `strict: true` to stop compilation with the error instead.
- Every error box carries its diagnostics as `metadata` labelled `<algoviz-error>`, so you can list the failed figures of a document:

  ```sh
  typst eval --in notes.typ 'query(<algoviz-error>).map(m => m.value)'
  ```

Arguments of the wrong type, such as a number for `theme` or a misspelt argument name, stop compilation, as with Typst's own functions.

## The engine's data: `algoviz-figures`

`algoviz-figures(source, input, steps: auto, theme: "light")` returns the engine's answer as a dictionary, for captions and custom layouts:

```typ
#let series = algoviz-figures("bst.delete", (from: (8, 3, 10, 1, 6), key: 3), steps: (0, -1))
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

There is no time limit. For very long documents, `algoviz export` writes the SVG files outside Typst, and `image` includes them.

## Limits

- Text is drawn as outlines for Latin and Greek letters, digits and common symbols. Other text, such as Chinese characters or emoji, stays text, drawn by your document's fonts. Typst shows colour emoji in SVG images as missing glyphs.
- Recursion in the engine stops at a few hundred levels, with an error in place of the figure. This is far deeper than any algorithm of the registry goes, but a hand-written document with very deep nesting could reach it.

## Licence

The package's licence will be chosen before it is published. The bundled fonts, JetBrains Mono and Inter, whose outlines draw the figures' text, are under the SIL Open Font License 1.1 (`OFL.txt`).
