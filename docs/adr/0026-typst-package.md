# 0026. The Typst package runs the engine in QuickJS inside a WebAssembly plugin

## Status

Accepted

## Context

Students write notes in Typst and want a figure of a chosen step from inside the document, without leaving it (requirements, use case 1 and R5). Typst cannot run commands, so the engine has to run inside Typst, and the only way Typst runs foreign code is a WebAssembly plugin. Such a plugin:

- exports functions that take byte buffers and return one, through the two functions Typst provides under `typst_env` (the `wasm-minimal-protocol`), and imports nothing else: no WASI, no clock, no files;
- runs in wasmi, an interpreter, not a just-in-time compiler (Typst 0.15.1 uses wasmi 1.0.9);
- must be pure. Typst memoizes each call by its arguments, keeps instances in a pool between calls, and may start more instances on other threads. `plugin.transition` calls a function once and derives a plugin whose instances start from a copy of the memory after that call; Typst memoizes the transition too.

The engine is TypeScript (ADR 0005): `@algoviz/spec`, `fonts`, `core`, `svg` and `recipes`, which use neither the DOM nor Node.js. ADR 0025 gave it `exportFigures`, which the Typst package must reach, so that a figure in Typst is the same SVG, byte for byte, as `algoviz export` writes.

### Options

1. **A JavaScript engine compiled to WebAssembly**, running the engine bundled into one script. Two were built and measured:
   - QuickJS-ng 0.16.2 through the Rust crate rquickjs 0.14.0, whose C sources compile for `wasm32-unknown-unknown` with a vendored libc and no WASI imports. The Typst packages jogs and ctxjs already run JavaScript in plugins of about 1 MB.
   - Boa 0.22, a JavaScript engine written in Rust.
2. **The engine ported to a language that compiles to WebAssembly**, such as Rust. It would run much faster in wasmi, but ADR 0005 keeps one implementation in TypeScript: a second one of the protocol, layout, painters and every recipe would drift from the first, and each new algorithm would be written twice. Not measured.
3. **No plugin**: users run `algoviz export` and include the files with `image`. This works today, but it needs Node.js, a step outside the document, and does not work in the Typst web app. It is not what use case 1 asks for.
4. **Other JavaScript engines**: SpiderMonkey (through ComponentizeJS or StarlingMonkey) and Javy target WASI or the component model, weigh several megabytes and would need every import stubbed; Porffor, an ahead-of-time compiler from JavaScript to WebAssembly, is experimental. Not measured.

### Measurements

The prototype bundles the engine (425 kB of minified JavaScript, 132 kB gzipped) and runs it in each engine. Each time is the median of five runs of `typst compile` (Typst 0.15.1, Apple M4) on a document with the figures named, so it includes Typst's own work: an empty document takes 8 ms and 19 MB. Dijkstra and `bst.delete` use their registry examples: 27 frames and 7 frames.

**Engines.** Painting the 27 Dijkstra scenes, laid out beforehand in Node, isolates JavaScript speed from validation:

|                            | QuickJS-ng             | Boa                                                |
| -------------------------- | ---------------------- | -------------------------------------------------- |
| plugin size                | 1.21 MB (0.42 MB gzip) | 3.32 MB                                            |
| evaluate the engine bundle | 760 ms                 | 3,878 ms                                           |
| paint 27 scenes            | 626 ms                 | 2,297 ms                                           |
| peak memory of Typst       | 43 MB                  | 91 MB                                              |
| runs the engine            | yes                    | no: a `TypeError` inside zod 4's object validation |

**Loading QuickJS-ng.** Three ways to get the engine into the plugin, each with a cache of laid-out documents (below):

| Time of `typst compile`                    | Source, `transition` | Bytecode, `transition` | Snapshot in the `.wasm` |
| ------------------------------------------ | -------------------- | ---------------------- | ----------------------- |
| engine ready, no figure                    | 760 ms               | 476 ms                 | 15 ms                   |
| one Dijkstra figure                        | 1,551 ms             | 1,280 ms               | 828 ms                  |
| ten Dijkstra figures, one call each        | 1,794 ms             | 1,498 ms               | 1,048 ms                |
| Dijkstra series, all 27 frames in one call | 2,194 ms             | 1,908 ms               | 1,451 ms                |
| `bst.delete` series, all 7 frames          | 1,042 ms             | 743 ms                 | 282 ms                  |
| files                                      | 1.21 MB + 0.42 MB    | 1.21 MB + 0.57 MB      | 7.18 MB (2.42 MB gzip)  |

- **Source** passes the bundle to the plugin, which parses and evaluates it, through `plugin.transition`.
- **Bytecode** does the same with QuickJS bytecode of the bundle, compiled ahead of time by the plugin itself. Natively, parsing takes 40 ms of the 60 ms that evaluation takes in all.
- **Snapshot** loads the engine at build time and writes the plugin's memory back into the `.wasm` as data, as Wizer does. About 3.3 MB of its 7 MiB are not zero, spread too finely among zeros to leave the zeros out.

**Cost of a call** (bytecode):

- With the engine loaded, a figure of a document not seen before takes 690 ms for Dijkstra and 180 ms for `bst.delete`.
- A figure of another step of a document already laid out takes about 25 ms.
- A call repeated with the same arguments is free: Typst memoizes it.
- Without the cache, every call runs the algorithm and lays out every frame again: ten Dijkstra figures took 7,916 ms instead of 1,794 ms (both loading source).
- Time grows with the length of a document. The longest run in the registry, bubble sort on 32 numbers in reverse order (1,024 steps), takes 11.6 s for its first figure. Natively, QuickJS spends about 300 ms on it: 70 ms running the algorithm, 40 ms validating the document and 200 ms laying out every frame for the canvas (ADR 0025). wasmi runs the same code 15 to 40 times slower than native QuickJS, and in Node the whole export takes 20 ms for Dijkstra.

**Memory.** The plugin's linear memory is 1.2 MiB when instantiated, 7.1 MiB with the engine loaded and 9.3 MiB after the Dijkstra series. Typst peaks at 40 to 45 MB for these documents.

**Correctness.** For every registry example in every built-in theme, 180 series of all frames, the plugin's SVG is byte-identical to `exportFigures` in Node, with bytecode and with the snapshot alike.

## Decision

### QuickJS-ng in a Rust plugin

The plugin is a Rust crate, `packages/typst/plugin/`, built for `wasm32-unknown-unknown` with rquickjs and the `wasm-minimal-protocol` crate. It exports three functions:

- `compile(source)` returns QuickJS bytecode of the engine, and is used only to build the package;
- `load(bytecode)` evaluates the engine, and is called once through `plugin.transition`;
- `render(request)` passes a JSON request to the engine and returns its JSON response.

Its only imports are the two of the protocol. The clock QuickJS asks for always reads 0, so nothing the engine computes can depend on the time.

### The engine entry

`packages/typst/src/` is a small TypeScript entry, bundled with the engine.

- **Request:** `{ "algorithm": id, "input": … }` or `{ "document": … }`, with either `step`, one selector, or `steps`, a list of selectors, and `theme`, a built-in theme name.
- **Response:** `{ "ok": true, "frames": n, "figures": [{ frame, selector, width, height, narration, svg }] }`, or `{ "ok": false, "diagnostics": […] }` with the diagnostics of ADR 0019, 0020 and 0025.
- **Steps:**
  - `step` names one frame with the rules of `selectFrame` (ADR 0020), as `algoviz render` and the player's `frame` attribute do: a section or a range of several frames is an error.
  - `steps` selects a series with `selectSeries` (ADR 0025); no steps means every frame.
- **Cache:** the entry keeps the last eight prepared documents, keyed by the JSON of the source and the theme, so a second figure of the same document costs only its own layout and painting. The cache cannot change the output, since layout is a pure function (ADR 0003), and the tests compare cached and uncached figures. The plugin therefore stays pure in Typst's sense.

`@algoviz/svg` gains the function the cache holds on to, so the plugin and `algoviz export` share one implementation:

- `prepareFigures(document, { theme })` loads a document once, and reports the theme's and the document's errors as `exportFigures` does.
- It returns the number of frames, `figure(selector)` for one frame and `figures(selectors)` for a series; these two report the selector's errors.
- The canvas is measured over every frame the first time a figure is drawn.
- `exportFigures` becomes `prepareFigures` followed by `figures`.
- `Figure` gains `narration`, the narration of the step that produced the frame, which the SVG already carries as its `<desc>`. Typst uses it as the image's alternative text.

### Loading: bytecode through `plugin.transition`

The package ships the plugin and the engine's bytecode as two files, `plugin.wasm` and `engine.bc`, and loads them once:

```typ
#let engine = plugin.transition(plugin("plugin.wasm").load, read("engine.bc", encoding: none))
```

Typst memoizes the transition, so watch mode, editors and the web app load the engine once per session. Only a one-shot `typst compile` pays the 0.5 s every time.

### The Typst interface

```typ
#import "@preview/algoviz:0.1.0": algoviz, algoviz-series, algoviz-figures

#algoviz("dijkstra", (graph: (nodes: ("A", "B", "C"), edges: (("A", "B", 4), ("B", "C", 1), ("A", "C", 7))), source: "A"), step: "relax#2")
#algoviz(json("heap.json"), step: 3, theme: "dark", width: 60%)
#grid(columns: 3, ..algoviz-series("bst.delete", (from: (8, 3, 10, 1, 6), key: 3)))
```

- **`algoviz(source, input, step: -1, theme: "light", strict: false, ..)`** returns one image.
  - **Source:** a registry id followed by its input, or a document alone, such as one read with `json`.
  - **Step:** one frame, named as ADR 0020 names frames; -1, the last frame, is the default, as for `algoviz render`.
  - **Theme:** `"light"`, `"dark"` or `"print"`.
  - **Image:** `width`, `height`, `fit` and `alt` go to `image`. `alt` defaults to the step's narration.
- **`algoviz-series(source, input, steps: auto, ..)`** returns an array of images, one per frame of the series. `auto` means every frame. All figures of a document share one canvas (ADR 0025), so they share one scale when they are placed at their natural size or at one width.
- **`algoviz-figures(source, input, steps: auto, theme: "light")`** returns the engine's response as a dictionary: the frames, and each figure's selector, size, narration and SVG. It serves captions, custom layouts and the slides of roadmap 1.5.
- **Errors in the document.** If the engine reports an error, the figure is replaced by a box that lists each diagnostic's code, path, message and hint. Such errors are an unknown algorithm or theme, an input the algorithm's schema rejects, an invalid document, or a selector that names no frame or several. The hint of a selector error lists the document's step names, so a wrong step shows the right ones.
  - The box carries the label `<algoviz-error>`, so `typst query` lists every failed figure of a document.
  - `strict: true` stops compilation with the same text instead.
  - Arguments of the wrong type, such as a number for `theme` or a misspelt named argument, always stop compilation, as Typst's own functions do.

The package needs Typst 0.15 or later, the oldest version it is tested with.

### Build, tests and what is committed

`packages/typst/` is a workspace, `@algoviz/typst`.

- **`packages/typst/package/`** holds exactly what will be published: `typst.toml`, `lib.typ`, the README with examples, `plugin.wasm`, `engine.bc`, and the OFL of the bundled fonts, whose outlines the engine carries. The package's own licence is the owner's choice when it is published (roadmap 4.3).
- **`plugin.wasm` is committed.** `npm run build:plugin -w @algoviz/typst` builds it:
  - Rust 1.99.1, pinned in `rust-toolchain.toml`;
  - the crates locked in `Cargo.lock`;
  - clang from LLVM 23, which the script checks, for QuickJS's C;
  - paths remapped, so the bytes do not depend on the machine.

  With `--check`, it rebuilds and compares the result with the committed file. The plugin changes only when the crate or its dependencies do. Committing it keeps every other step free of a Rust toolchain: the bytecode, the tests and CI.

- **`engine.bc` is built, not committed.** `npm run build -w @algoviz/typst` bundles the entry with Vite and compiles it by running the committed plugin in Node. It changes with every change to the engine and takes seconds to build.
- **`npm run check` (Node only).** Node's WebAssembly runs the plugin through a small host for the protocol. The tests check that the plugin's SVG is byte-identical to `exportFigures` for every registry example in every theme, both cold and from the cache, and that errors come back as diagnostics.
- **`npm run test:typst`** needs the `typst` command, so it stays out of `npm run check`:
  - it compiles the examples;
  - it uses `typst query` to compare SVG made inside Typst with Node's, byte for byte;
  - it checks the error box and strict mode.

`algoviz` is a working name (roadmap 4.1). It appears in `typst.toml`, the three function names, the README and the examples; the files inside the package have neutral names. Publishing to Typst Universe waits for the owner (roadmap 4.3).

### Rejected

- **Boa.** It is about five times slower to load the engine and four times slower to paint. Its plugin is almost three times the size, it uses twice the memory, and it fails inside zod.
- **A snapshot in the `.wasm`.** It saves 460 ms on each one-shot compile. In exchange, the package is four times larger than the chosen two files, and seven times larger than comparable packages of about 1 MB. It also needs our own rewriter of WebAssembly binaries. Reconsider if one-shot compiles turn out to matter more than the download.
- **Source instead of bytecode.** Loading takes about 280 ms longer, and the only gain is one build step fewer.
- **The engine embedded in `plugin.wasm`.** Every change to a recipe would need the Rust toolchain and a new committed binary.
- **No cache in the plugin.** Several figures of one run are the common case in notes, and each would lay out the whole document again.

## Consequences

- Students get figures in Typst from an algorithm and its input, or from a document, without installing anything else. The figures are the same as those of `algoviz export`, and the tests keep them so.
- **Speed.**
  - The first figure of a document costs time in proportion to its number of steps: about 0.7 s for Dijkstra's example and 11.6 s for the 1,024 steps of the longest bubble sort.
  - Further figures of the same document cost tens of milliseconds, and figures that did not change cost nothing in watch mode.
  - For very long documents, `algoviz export` with `image` stays the fast route; the README says so.
  - The cost of laying out every frame under QuickJS is now worth profiling.
  - In the web app, wasmi itself runs as WebAssembly in the browser, which is likely slower. This was not measured.
- **Two build paths.** A change to the engine needs only Node to rebuild `engine.bc`. A change to rquickjs, the protocol crate or the Rust code needs the Rust toolchain and clang, and a new `plugin.wasm` in the same pull request.
- **Tests split.** CI runs the Node tests. The Typst tests run where `typst` is installed.
- **Public interfaces.** `@algoviz/svg` exports `prepareFigures`, and `Figure` has `narration`. The Typst functions, their arguments and the request and response of the engine entry are a package interface, changed only by a new ADR.
- The plugin keeps up to eight laid-out documents per instance. Memory stays around 10 MiB for documents of the registry's size, and the cache bounds it for long documents.
