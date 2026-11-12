# 0033. Slide figures fill the frame

## Status

Accepted. Amends ADR 0027 (the LaTeX package's sizes) and ADR 0028 (`algoviz-slides`).

## Context

Teachers put figures on slides (requirements, use case 3). Today a slide figure is sized as in notes:

- **LaTeX** (ADR 0027): without `width`, `height` or `scale`, a figure is drawn at its natural size, one scene unit to a sixteenth of the font size, and shrunk to `\linewidth` if it would be wider. Nothing looks at the frame's height, so a tall figure runs off the bottom of the slide, and a narrow one stays small on a wide slide. The Beamer example sets `height=0.72\textheight` on every figure to work around it, which in turn lets a wide figure run off the side, since a `height` alone is not capped by the line.
- **Typst** (ADR 0028): `algoviz-slides` sizes every frame as `image` does. Without `width` and `height`, a figure is its SVG's natural size, 0.75 pt per pixel, shrunk to the region's width. The examples set `height: 75%`.

Roadmap 1.10 asks that a slide figure fill the frame's width and a share of its height by default, keeping its shape, while notes keep today's sizes and users can still choose a size. ADR 0025 must hold: every figure of a document has one canvas, so figures of one document drawn into the same space share one scale.

### Measurements

The last frame of each registry example, in the wide layout that slides use (ADR 0029). Canvas sizes are in scene units, which are SVG pixels. The unit is the length of one scene unit on the slide; text and lines scale with it.

| Figure        | Canvas     | Beamer 4:3, before → fill | Beamer 16:9, before → fill      | polylux 16:9, before → fill |
| ------------- | ---------- | ------------------------- | ------------------------------- | --------------------------- |
| Kruskal       | 1050 × 424 | 0.29 pt → 0.29 pt         | 0.38 pt → 0.38 pt               | 0.72 pt → 0.69 pt           |
| Dijkstra      | 574 × 412  | 0.54 pt → 0.49 pt         | 0.69 pt (283 pt tall) → 0.46 pt | 0.75 pt → 0.71 pt           |
| binary search | 452 × 204  | 0.68 pt → 0.68 pt         | 0.69 pt → 0.88 pt               | 0.75 pt → 1.43 pt           |

The frames, measured in TeX Live 2026 and Typst 0.15.1: Beamer 4:3 has a 307 pt line and 269 pt of text height; Beamer 16:9 (`aspectratio=169`) 398 pt by 252 pt; a polylux slide with 1.5 cm margins 757 pt by 389 pt; touying's simple theme 742 pt by 374 pt, its title being in the header. Fill here is three quarters of the height.

- **Width-bound figures** do not grow. Kruskal's wide canvas is two and a half times as wide as it is tall, because the canvas covers the widest frame of the run (ADR 0025). On every slide its line width is the limit already, so filling the frame cannot make it larger; at most it shrinks it a little, by 5 % in polylux, where today it takes 306 pt of the 389 pt and leaves no room for text.
- **Tall figures** stop running off the slide. Dijkstra's natural figure is 283 pt tall in a 16:9 Beamer frame of 252 pt.
- **Narrow figures** grow: binary search by 28 % in Beamer 16:9 and 1.9 times in polylux.

## Decision

### The slide box

On a slide, a figure fits inside a box and keeps its shape. The box is as wide as the line and three quarters of the frame's height:

- in Beamer, `\linewidth` by `0.75\textheight`, at the place where the figure is drawn, so a figure in a column takes the column's width;
- in Typst, 100 % by 75 % of the region `algoviz-slides` is laid out in, which `layout` gives: the slide's body, or a column's.

Three quarters leave room for a frame title and a line or two of text in Beamer's and the frameworks' default themes. The figure is as large as fits: its scale is the smaller of the box's width over the canvas width and the box's height over the canvas height. It may come out larger than its natural size.

**Choosing a size.** `width` and `height` replace their side of the box, and only that side; the other keeps its default. So `height=0.6\textheight` in Beamer, or `height: 60%` in Typst, is a smaller share of the frame, still capped by the line, and `width=0.5\linewidth` is half the line, still capped by the frame. With both, the box is both, as before. A figure that should overflow the frame gets a box larger than it.

**One scale.** The size depends only on the canvas and the box. Every figure of a document has one canvas (ADR 0025), so its figures on slides with the same box, such as full-width figures on frames of one deck, share one scale, and so do the frames of a series, which share one picture or one box. Figures of different documents fill the box each at its own scale, as figures given one width do today.

### LaTeX: in the `beamer` class

A figure's unit comes from the first of these that applies:

1. **`width` or `height`** is given: the figure fits inside the box made of the given sides. In Beamer the sides not given are the slide box's; elsewhere they are unbounded, as today.
2. **`scale`** is given: the natural size times `scale`, never wider than the line, as today. `scale=1` asks for the natural size on a slide.
3. **In the `beamer` class**: the slide box.
4. **Elsewhere**: the natural size, never wider than the line, as today.

- `scale` has no value by default, instead of `1`. `scale` without a value, like `width=0pt` and `height=0pt` as before, goes back to the default, so `\algovizset{scale=1}` in a preamble can be undone for one figure with `\algoviz[scale]…`.
- It applies to `\algoviz`, `\algovizfile` and `\algovizinput`, to one figure and to a series alike: a series' picture is sized once, from its canvas.
- `beamerarticle` notes, and every other class, are notes: rules 1, 2 and 4 are those of ADR 0027 word for word.
- ADR 0027 said that without `width` or `height`, a figure is shrunk to the line if it would be wider. That remains true for notes; in Beamer the slide box replaces it.

### Typst: `algoviz-slides`

`algoviz-slides` keeps its signature. Its `width` and `height` default to `auto`, which on a slide means the slide box's side: 100 % and 75 %. Lengths, ratios and relative lengths such as `100% - 2cm` are resolved against the region.

- **`fit: "contain"`**, the default: the figure fits inside the box, keeping its shape, and its box is the figure's size, not the slide box's. Content after it follows the figure, not three quarters of the slide.
- **`fit: "cover"` or `"stretch"`**: every frame is an image of the box's size, as `image` makes it.
- Each frame, and the hidden copy that gives the series its box (ADR 0028), resolves its size with its own `layout`, inside `only`. touying counts a slide's subslides by finding `only` in its content, and cannot look inside a `layout` callback, so `only` stays outside it. A `layout` placed inside the series' box sees the same region as the box, so every frame gets the same size.
- In an unbounded region, such as inside polylux's `alternatives`, the height has no limit and the width alone sizes the figure. In a region unbounded both ways, the figure keeps its natural size.
- A series of one frame is sized the same way.
- `algoviz` and `algoviz-series` keep their sizes: they do not know that they are on a slide. A single figure on a slide is `algoviz-slides` with one step, such as `steps: "relax#3"`.

### Tests

- **`npm run test:latex`**: figure files of known canvases (wide, tall, narrow and upright) in Beamer frames at 4:3 and 16:9 are measured in a box, whose size TeX writes to the log: each fits the slide box, touches one of its sides and keeps its shape. `width`, `height` and `scale` give the sizes above, a series is the size of its figure alone, a column's figure fills the column, and a plain article and `beamerarticle` notes give the sizes of ADR 0027. Kruskal's, Dijkstra's and binary search's figures, made by the command, fill a 16:9 slide in pdfLaTeX and LuaLaTeX.
- **`npm run test:typst`**: `algoviz-slides` with a stand-in `only` that calls each frame's `layout` with a chosen region: every frame of a series alike, fitting the slide box and touching a side; `width`, `height` (lengths, ratios, relative lengths), `fit`, unbounded regions, a one-frame series and the errors for other types. Decks with polylux 0.4.0 and touying 0.8.0 draw the three registry figures inside the slide box that `layout` reports there, and the example decks keep their pages.
- **By hand**: the example decks before and after, compared in the pull request.

### Rejected

- **Filling the height that is left.** Neither Beamer nor Typst knows, when a figure is drawn, what the rest of the frame holds: Beamer typesets a frame in a box, and a Typst `1fr` block takes all the room left and pushes what follows to the bottom. A fixed share is predictable, and the same in both.
- **A canvas per series** (the selected frames only), which would make Kruskal's figures larger. A figure's size would depend on which frames are shown with it, which ADR 0025 rules out.
- **Choosing the wide or narrow layout from the frame's shape.** The canvas is known only after the engine runs, so LaTeX would call the command twice; and for the figures measured, the wide layout wins on every slide anyway.
- **A cap on enlargement**, such as twice the natural size. Small figures would no longer fill the frame, and slides are read from afar. Authors who want a smaller figure give `height` or `scale`.
- **New keys, such as `fill=0.75`.** `height` already says the share, and `scale=1` the natural size.
- **`width` and `height` meaning an exact size on slides**, as `image` takes them. A wide figure given `height: 60%` would run off the side, as it does today.
- **Slide sizes for Typst's `algoviz` and `algoviz-series`.** They cannot tell a slide from a page of notes without importing a framework, which ADR 0028 rejects.

## Consequences

- A figure on a slide is as large as the frame allows, in Beamer and in polylux and touying, without size keys, and it never runs off the slide.
- Figures that the line's width already limits, such as Kruskal's in the wide layout, do not grow; making them larger would take a different canvas or layout.
- **Behaviour changes on slides:**
  - Beamer figures without size keys fill the slide box; `scale=1` gives the old size.
  - A Beamer `width` or `height` alone is now capped by the other side of the slide box.
  - `algoviz-slides` frames fill the slide box, and a `width` or `height` alone is capped by the other side. With `fit: "contain"`, the frames' box is the figure's size rather than the given box.
- Notes do not change, in LaTeX, `beamerarticle` or Typst.
- **Public interfaces:** the LaTeX key `scale` has no value by default, and `scale` without a value is the default; `algoviz-slides`'s `width` and `height` mean the slide box's sides. The TikZ file format, the cache key and the command do not change, so cached figures stay valid.
