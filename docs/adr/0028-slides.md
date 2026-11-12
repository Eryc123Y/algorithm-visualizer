# 0028. Slides step through a series, one overlay per frame

## Status

Accepted; how `algoviz-slides` sizes its frames is superseded by ADR 0033

## Context

Teachers want to step through an algorithm in a lecture with the slide controls: each step becomes an overlay in Beamer or a subslide in a Typst slide framework (requirements, use case 3, and R5). Roadmap 1.5 builds this on what exists:

- **Step selection.** `selectSeries` (ADR 0025) turns selectors into the frames of a series: a range, a section or a list of step names. The LaTeX package calls it through `algoviz export --step`, and the Typst package through its engine's `steps`.
- **One canvas.** Every figure of a document has the same size (ADR 0025), so the frames of a series can sit on top of each other without moving.
- **LaTeX.** The package (ADR 0027) draws one figure per file. A file holds `\algoviz@figure{format}{width}{height}{colours}{drawing}`, and ADR 0027 left it to this item to put a series into one `tikzpicture` with `\only<n>` per frame. It also left open how the package learns the files of a series: `export` names one file per frame after its frame number, which TeX cannot know in advance, and TeX cannot read the command's standard output.
- **Typst.** The package (ADR 0026) returns figures as images; `algoviz-series` returns one per frame. The slide frameworks, polylux and touying, decide which content shows on which subslide with their own `only`, `uncover` and `alternatives`.

Three questions follow: how the LaTeX package gets a series from the command, which Beamer command shows each frame, and how the Typst package works with frameworks it does not know.

### What was tried

**Beamer**, TeX Live 2026, Beamer 3.77. A `tikzpicture` with a fixed bounding box and one `\only` per frame:

| Mode               | `\only<k>` per frame                   | With `handout:0`, `trans:0`, `article:0`, and `:1` on the last frame |
| ------------------ | -------------------------------------- | -------------------------------------------------------------------- |
| presentation       | one frame per slide                    | one frame per slide                                                  |
| `handout`, `trans` | one slide, every frame over the others | one slide, the last frame                                            |
| `beamerarticle`    | every frame over the others            | the last frame                                                       |

With `<+>` in place of the numbers, a series after a `\pause` starts on slide 2, and one on a frame of its own starts on slide 1.

Beamer's own package for a sequence of pictures, `xmpmulti`, also starts it at the current pause: its pictures are separated by `\pause` unless an overlay specification such as `<+>` is given.

**Typst 0.15.1**, with the newest versions it can download: polylux 0.4.0 and touying 0.8.0.

- `#alternatives(..algoviz-series(…))` works in touying, also with relative sizes such as `height: 70%`, and starts after a `#pause`.
- In polylux, `alternatives` measures its children in unbounded space to size one box for all of them. An image with a relative size measures as nothing there, so `width: 80%` or `height: 70%` gives blank subslides. Absolute sizes work.
- Each framework's `only(subslides, body)` takes a subslide number or a string such as `"3-"`. touying finds `only` inside `box` and `place` when it counts a slide's subslides; polylux counts through state, so it finds it anywhere. With every frame placed at the top left of one box, sized by a hidden copy of the first frame, both frameworks step through the frames, with relative sizes too.

## Decision

### A series in one file: `algoviz export --one-file`

`algoviz export` gains `--one-file`. With it, the command writes every figure of the series into the one file that `--name` names, in timeline order, separated by blank lines.

- It needs `--format tikz`; with SVG it is a usage error, as an SVG file holds one picture.
- There is one file, so a `--name` pattern with `{frame}` or `{step}` is a usage error with it, and the default name is `{name}`.
- The file is written whole or not at all, like every figure file, and nothing is written unless the whole series renders.
- The command prints one line per figure, as before: the file's path and the frame's selector, so every line names the same file.

**The file format stays version 1.** A figure file holds one or more `\algoviz@figure` calls instead of one. Every file the command wrote before is still valid. A package of an earlier release draws each figure of a series file as its own picture, one after another.

### Beamer: `steps` and `start`

`\algoviz` and `\algovizfile` gain two keys:

- **`steps`**: the selectors of a series, with the rules of `selectSeries`: a range, a section, a step name, or several of them separated by commas (`steps={relax#1, relax#3}`, braced because of the comma). Without a value, it means every frame. Spaces are ignored, so the list is checked with the step's pattern of ADR 0027 and passed as one `--step`. `#` is written as `step` takes it: `#` in ordinary text and fragile frames, `\#` everywhere.
- **`start`**: the slide of the series' first frame. `+`, the default, starts it where Beamer's incremental count stands, as `<+>` does: on the frame's first slide, or after a `\pause` or `<+->` items before it. A number starts it on that slide. Two series that should step together both take `start=1`. Any other value is an error that names it.

`step` and `steps` replace each other: whichever is set last applies, so `\algovizset{steps}` followed by `\algoviz[step=3]` draws one frame.

**One file per series.** The package calls the command as for a figure, with `--step=<list>` (or no `--step` for every frame) and `--one-file`. The cache key covers `steps:<list>` in place of the step, so a series and a figure never share a key. Everything else of ADR 0027 holds: the checks, the cache, errors in the document.

**Drawing.** The package reads every `\algoviz@figure` of a file, then draws them:

- **One frame** is a figure, as before, whatever `steps` said.
- **Several frames** share one `tikzpicture`. Its canvas is the largest figure in the file, which for files the command made is every figure's size. The unit comes from it as for one figure, so `width`, `height` and `scale` apply to the whole series. Each frame defines its colours and draws its drawing inside its own TikZ `scope`, since colour numbers are local to a figure.
- **In Beamer** (the `beamer` class, or `beamerarticle`), frame _k_ of _n_ is drawn inside `\only<s| handout:0| trans:0| article:0>`, and the last frame inside `\only<s-| handout:1| trans:1| article:1>`. _s_ is `+` with the default `start`, or `start + k − 1`. So each slide shows one frame; the last frame stays until the frame ends, if more overlays follow; and handouts, transparencies and `beamerarticle` notes show the last frame, as the frame looks when it ends.
- **Elsewhere** the picture shows the last frame, with a warning that overlays need Beamer.

`\algovizinput` draws a file the same way: a file of several figures, such as one made with `algoviz export --one-file` by hand, is a series. `steps` means nothing to it; `start` does.

**`\only`, not `\uncover`, `\visible` or `\alt`.** The frames of a series share one place. Beamer still typesets covered content, and with `\setbeamercovered{transparent}` every covered frame would show faintly through the visible one. `\alt` takes two branches, so _n_ frames would nest _n_ deep. With `\only`, a slide holds one frame's drawing, and the bounding box, set outside the frames, keeps the picture's size the same on every slide.

### Typst: `algoviz-slides`

```typ
#import "@preview/touying:0.8.0": *        // or polylux:0.4.0
#import "@preview/algoviz:0.1.0": algoviz-slides

#algoviz-slides(only, "dijkstra", (graph: graph, source: "A"), steps: auto, height: 70%)
```

`algoviz-slides(only, source, input, steps: auto, start: 1, theme: "light", strict: false, width: auto, height: auto, fit: "contain")`:

- **`only`** is the slide framework's own `only`, passed in. The package imports no framework: it cannot know which version a deck uses, and an `only` from another copy of a framework would not see the deck's subslide counter. Any function that takes a subslide number or a string such as `"3-"`, and a body, works; polylux 0.4.0 and touying 0.8.0 are tested.
- **`steps`** selects the frames as `algoviz-series` does: `auto` for every frame, a selector, or an array of them.
- **`start`** is the subslide of the first frame, 1 by default. Neither framework's `only` follows pauses, so after touying's `#pause` the deck gives `start` itself.
- **Layout.** The result is one box. A hidden copy of the first frame, sized with `width`, `height` and `fit` as `algoviz` sizes an image, gives the box its size. Each frame is placed at the box's top left with the same sizes, inside `only(start + k − 1, …)`, and the last inside `only("m-", …)`, with `m` its subslide. The box keeps its size on every subslide, before the series starts too. Every frame keeps its narration as `alt`.
- **One frame** is the image alone, as in LaTeX. **An error** is the error box of `algoviz`, or a stop with `strict: true`.
- **Handouts** follow the framework: touying's handout mode keeps a slide's last subslide, which shows the last frame; polylux's handout mode leaves `only` as it is.

`alternatives(..algoviz-series(…))` stays possible in touying, where it also follows `#pause`. The README shows `algoviz-slides`, which works the same in both frameworks.

### Tests

- **`npm run check`**: the CLI's `--one-file`, its usage errors and its output; a series file holds the figures `export` writes one by one, in order.
- **`npm run test:latex`**:
  - a hand-made series file, whose frames carry distinct words, in Beamer's presentation, handout and trans modes, in `beamerarticle` and in an article: which words each page shows, `start` as a number and as `+` after `\pause`, and the warning;
  - the Beamer example with pdfLaTeX and LuaLaTeX: one call per series, one page per frame, each page's text the same as a page that draws that frame alone, the cache on a second run.
- **`npm run test:typst`**:
  - `algoviz-slides` with a stand-in `only` that records its arguments: the subslides each frame gets, `start`, the last frame's open range, one frame, and errors;
  - decks with polylux 0.4.0 and touying 0.8.0: their page counts, and each page drawing its frame's SVG. Typst downloads the frameworks from Typst Universe the first time; when it cannot, these tests are skipped with a message that says so, and nothing is vendored.
- **By hand**: compiled slides are looked at, and their images go into the pull request.

### Rejected

- **One file per frame and a list file.** The package would read a list, then one file per frame, and a run stopped between files would leave a partial series. One file is written whole, and its existence means the series is complete.
- **`step` naming several frames.** `step` keeps the rules of `selectFrame`, as in Typst, where `algoviz` and `algoviz-series` are separate. A separate key says which one the author meant.
- **Starting every series on slide 1.** After a `\pause`, its first frame would be covered on slide 1 and never seen.
- **Showing the first frame before a series starts.** Beamer's `<+>` shows nothing before its slide; the picture keeps its size, so nothing moves when the series starts.
- **Every frame, one after another, outside Beamer.** In `beamerarticle` notes the frame's slides become one page, and its last state is what the page should show. Notes that want several frames side by side use one `\algoviz` per frame, which line up at one scale (ADR 0025).
- **Typst: `alternatives` as the helper's building block.** polylux's `alternatives` measures its children, so relative sizes vanish.
- **Typst: importing polylux or touying.** It would tie the package to one version of each, and a second copy of a framework keeps its own subslide state.
- **Typst: a `framework: "touying"` switch.** The helper would have to follow each framework's internals; the framework's own `only` is public and stable.

## Consequences

- A teacher steps through any series in Beamer with one `\algoviz[steps=…]`, and in polylux or touying with one `algoviz-slides`. The frames come from the same selectors as `export`, and they keep one size.
- **Public interfaces:**
  - the CLI has `--one-file`;
  - a TikZ figure file may hold several figures, at format version 1;
  - the LaTeX package has the keys `steps` and `start`, and `\algovizinput` draws series files;
  - the Typst package has `algoviz-slides`.
- **Beamer typesets a frame once per slide**, so the package reads a series file on every slide and `\only` skips the frames that slide does not show. A cached series costs only TikZ's time on each slide, and the command runs once per series.
- **Handouts and notes** show a series' last frame, in Beamer's modes, `beamerarticle` and touying's handout mode.
- **Typst decks after `#pause`** give `start` themselves; Beamer decks need not.
- The Typst slide tests need the network once, to download the frameworks.
