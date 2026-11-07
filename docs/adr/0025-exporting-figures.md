# 0025. Figures are exported as a series of standalone SVG files that share one canvas

## Status

Accepted

## Context

Students put figures of chosen steps into their notes, and teachers put them into slides (requirements, use cases 1 and 3). R5 asks for standalone SVG of any step, any range of steps or all of them, and for the figures of one series to share one scale, so a sequence of steps lines up across pages.

Today the command line has `algoviz render`, which writes one frame. It serves models first: it keeps text as text elements (ADR 0024), takes one frame, and needs a document, so running an algorithm on an input takes `algoviz run` and a file in between. Nothing guarantees that two frames of a document come out the same size. Layout already uses metrics measured over the whole trace (ADR 0008), and with them every frame of every registry example has the same width and height, but no rule says a frame's figure is the same whichever frames are exported with it.

Three later items call this path. The Typst package (roadmap 1.3) runs the engine inside a WebAssembly plugin, so it needs a function without the DOM or Node.js. The LaTeX package (1.4) calls the `algoviz` command through shell escape. Slides (1.5) make one overlay per selected step.

## Decision

### Selecting a series, in `@algoviz/core`

`selectSeries(doc, selectors)` returns the frame numbers of a series:

- Each selector is an ADR 0020 selector, as text or a number, naming one frame or a range.
- The series is the union of what they name, in timeline order and without repeats. `relax#1` and `relax#3` give two frames; `insert-5` gives the frames of the section.
- No selectors means every frame, 0 to the last.
- The first selector that fails returns its error, with the codes of ADR 0020 (`INVALID_SELECTOR`, `NO_MATCH`, `OUT_OF_RANGE`) and the hint that lists the document's step names and sections.

It lives in `selector.ts` next to `selectFrames`. Slides (1.5) take their overlays from it.

The selector grammar of ADR 0020 does not change. A list is several selectors, not a new kind of selector, and "all" is the absence of one (or `0..-1`).

### Figures, in `@algoviz/svg`

`renderSeries(trace, frames, options)` returns one figure per frame: `{ frame, selector, width, height, svg }`.

- **One layout.** The trace is laid out once with metrics measured over all its frames, in the theme's fonts (`layoutTrace` with `theme.fontMetrics`, ADR 0024).
- **One canvas.** Every figure of a trace has the same width and height: the largest over all frames of the trace, not only the selected ones. Each scene keeps its place at the top left, and the space it does not use stays empty. A frame's figure therefore does not depend on which other frames are exported with it, so figures made one call at a time, as the Typst and LaTeX packages make them, also share one scale. Laying out every frame takes a few milliseconds for the registry's examples.
- **Standalone SVG.** Text is drawn as outlines (ADR 0024). The `data-key` attributes, which only the player's animation uses, are left out.
- **Description.** `renderSvg` gains a `description` option, written as a `<desc>` after the `<title>`. Each figure's description is the narration of the step that produced its frame, so a screen reader, or a reader of the file, learns what the figure shows.
- **`selector`** is the frame's most specific selector (`selectorOf`, ADR 0020), such as `insert-5/relax#2`.

`exportFigures(document, { steps, theme })` loads a document, selects its series and renders it. Its errors are diagnostics: the document's own, or the selector's at `$`. It uses neither the DOM nor Node.js, so the Typst plugin calls it with a document, or with the document that `runAlgorithm` (ADR 0019, 0022) returns for an algorithm and an input.

`theme` is a theme name or a theme object (`createTheme`), and defaults to `light`.

### The command

```
algoviz export <file> [--step <selector>]… [--theme light|dark|print] [--out <dir>] [--name <pattern>]
algoviz export <algorithm-id> --input <json|file> [the same options]
```

- **Source.** With `--input`, the first argument is a registry id, and the command runs that algorithm on the input with `runAlgorithm`, without a document file. Without `--input`, it is a document file, or `-` for standard input. `--input` takes JSON text when it starts with `{` or `[`, and otherwise reads a file, or standard input for `-`.
- **Steps.** `--step` may be given several times, and each value may be a comma-separated list. Without it, every frame is exported.
- **Theme.** `--theme` takes a built-in theme name; `light` is the default, as for `render` and the player.
- **Files.** `--out` is a directory, created if it is missing; the default is the current directory. Existing files are replaced. A value ending in `.svg` is a usage error that points at `--name`, since it is most likely meant as a file name.
- **Names.** `--name` is a pattern, `{name}-{frame}` by default, and `.svg` is appended. Its placeholders:
  - `{name}`: the document file's name without its extension, the algorithm id, or `figure` for standard input;
  - `{frame}`: the frame number, padded with zeros to the width of the document's last frame number, so the files sort in timeline order, and every export of one document pads the same way;
  - `{step}`: the frame's selector with `/` and `#` replaced by `_`, such as `insert-5_relax_2`. Step names and section ids cannot contain `_`, so different frames get different names.

  A pattern is a usage error if it names an unknown placeholder, contains a path separator, or gives two frames of the series the same name (a pattern without `{frame}` or `{step}` for more than one frame).

- **Output.** One line per file written: its path and the frame's selector.
- **Errors.** As for the other commands: exit code 1 with the code, path, message and hint of each diagnostic for an invalid document, an unknown algorithm (`UNKNOWN_ALGORITHM` at `$.id`), an input its schema rejects (`INVALID_SHAPE` under `$.input`) or a selector that matches nothing; exit code 2 with the usage for unknown options, missing arguments, unreadable files, JSON that does not parse and bad patterns. Nothing is written unless the whole series renders.

`algoviz render` stays as it is, one frame with text kept, for models and quick looks. `export` is the command for figures.

### Rejected

- **Metrics or canvas from the selected frames only.** Figures would be tighter, but the same frame would come out at a different size depending on what else was exported, and figures made one at a time would not line up.
- **`--out` as a file name for a single figure.** One meaning per option is simpler; `--name` names the file.
- **Raster or PDF output.** Typst reads SVG, LaTeX gets TikZ from its own painter (1.4), and converters from SVG exist.

### LaTeX and `#`

In LaTeX, `#` is the macro parameter character, so `step=relax#3` cannot be passed as it is. The ADR of roadmap 1.4 decides how the LaTeX package spells it. The command line takes the selectors of ADR 0020 unchanged: in shells, a `#` inside a word does not start a comment.

## Consequences

- The Typst package calls `exportFigures`, the LaTeX package calls `algoviz export`, and slides call `selectSeries`, so all three select steps and size figures the same way.
- Every figure of a document has one size, so figures placed at their natural size, or all at one width, share one scale. A figure can have empty space below or to the right when other frames of its document are larger.
- Exporting one frame lays out every frame of the document. That stays within milliseconds for the registry's examples and grows linearly with the length of a document.
- File names from `{frame}` change when a recipe gains or loses steps; names from `{step}` stay valid as long as the selector does.
- `renderSvg` has one more option, and `@algoviz/svg` depends on `@algoviz/spec` for diagnostics.
