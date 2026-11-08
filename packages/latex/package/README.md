# algoviz for LaTeX

Step-by-step figures of algorithms and data structures in your LaTeX notes and Beamer slides. Name an algorithm, give it your input and pick a step, such as the moment Dijkstra's algorithm improves a distance on your graph, and get a TikZ figure. You can also pass a document that you wrote, or that an AI wrote for you, in the algoviz format.

The figures are drawn with TikZ, so their text is set in your document's fonts and they scale with the page. Shapes, colours and positions are those of the SVG and Typst figures of the same step.

```latex
\documentclass{article}
\usepackage{algoviz}
\begin{document}
\algoviz[step=improve#3]{dijkstra}{
  "graph": {"nodes": ["A", "B", "C", "D"],
            "edges": [["A", "B", 4], ["B", "C", 1], ["A", "C", 7], ["C", "D", 2]]},
  "source": "A"}
\end{document}
```

```sh
latexmk -pdf -shell-escape notes.tex     # or -pdflua, -pdfxe
```

The package runs the `algoviz` command through shell escape, as `minted` runs Pygments. It keeps every figure in `_algoviz/`, so a figure that did not change is never made again, and cached figures need no shell escape at all.

> **Not on CTAN yet.** Until it is published:
>
> 1. **The command.** Build the standalone `algoviz` executable in the algoviz repository: `npm install`, then `npm run build:standalone -w @algoviz/mcp`. This needs rustup and a C compiler, and writes `packages/mcp/dist/standalone/algoviz`, a 2 MB program that needs no Node.js. Put it on your `PATH`, or name it with the package option `command=`. The Node.js CLI works too: `command={node /path/to/algoviz.js}`.
> 2. **The package.** Put `algoviz.sty` next to your document, or in your local `texmf` tree under `tex/latex/algoviz/`.
>
> The `examples/` folder next to this package has notes and slides to start from.

## Requirements

- LaTeX 2024-06-01 or later, as in TeX Live 2024, and TikZ. The package is tested with TeX Live 2026.
- pdfLaTeX, LuaLaTeX or XeLaTeX. `latex` with `dvips` works too, but PostScript has no transparency, so the shadows of the light and dark themes come out solid.
- Shell escape (`-shell-escape`) the first time a figure is made.

## Commands

| Command                                     | Draws                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `\algoviz[keys]{id}{input}`                 | a step of a registry algorithm, run on the input, given as JSON                 |
| `\algovizfile[keys]{doc.json}`              | a step of an algoviz document in a JSON file                                    |
| `\algovizfile[algorithm=id, keys]{in.json}` | a step of an algorithm whose input is in a JSON file                            |
| `\algovizinput[keys]{figure.tex}`           | a figure or series made by `algoviz export --format tikz`, without shell escape |
| `\algovizset{keys}`                         | sets keys for the figures that follow, in the current group                     |

`algoviz recipes` lists the algorithm ids and the inputs they take, and `algoviz guide` explains documents.

## Keys

| Key               | Default                 | Meaning                                                                                                                                                                                                                                                                         |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `step`            | `-1`                    | The frame to draw (below).                                                                                                                                                                                                                                                      |
| `steps`           | none                    | A series of frames, one per slide in Beamer ([Slides](#slides)).                                                                                                                                                                                                                |
| `start`           | `+`                     | The slide of a series' first frame ([Slides](#slides)).                                                                                                                                                                                                                         |
| `theme`           | `light`                 | A built-in theme: `light`, `dark`, `print`, `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` or `turbo-c`.                                                                                                                                                  |
| `layout`          | `narrow`, Beamer `wide` | Where structures beside the main one go, such as a queue: below it or beside it.                                                                                                                                                                                                |
| `width`, `height` | natural                 | The figure's size. With both, the figure fits inside both and keeps its shape.                                                                                                                                                                                                  |
| `scale`           | `1`                     | A factor on the natural size.                                                                                                                                                                                                                                                   |
| `value font`      | the theme's             | The font of values in cells and nodes, indices, edge labels and pointers. By default the document's family the theme names: `\normalfont` for light, dark and print, `\rmfamily` for the textbook themes, `\sffamily` for blocks, `\ttfamily` for the answer sheet and Turbo C. |
| `label font`      | the theme's             | The font of titles and labels such as "top". By default `\sffamily`, but `\rmfamily` for the textbook themes and `\ttfamily` for Turbo C.                                                                                                                                       |
| `algorithm`       | none                    | With `\algovizfile`: the file is this algorithm's input, not a document.                                                                                                                                                                                                        |

An algorithm's figure draws what it keeps besides its main structure, such as Dijkstra's priority queue or a call stack. `layout=narrow` puts those structures below the main one, which suits a column of notes; `layout=wide` puts them beside it, which suits a slide. The default is `wide` in the `beamer` class and `narrow` everywhere else, `beamerarticle` notes included; `layout=auto` goes back to it.

At its natural size, a figure's values come out at 1.25 times the size of the text around it, and its labels at three quarters of it. A figure is never wider than the line, unless `width` or `height` says otherwise. Every figure of one run of an algorithm has the same canvas, so figures of different steps drawn at the same scale line up.

Package options, in `\usepackage[...]{algoviz}`:

- `command=algoviz`: the command to run, with a path or arguments if needed.
- `cachedir=_algoviz`: where the figures are kept.

## Steps

`step` takes a selector:

- a frame number: `0` is the starting state, `-1` the last frame;
- a step name, counted from 1: `relax#3` is the third step named `relax`;
- a step inside a section: `insert-5/relax#2`.

A selector that names several frames, such as a section or a range, is an error with `step`, since a figure is one frame; `steps` takes a series ([Slides](#slides)). If a step does not exist, the error box lists the step names the run has.

In ordinary text, write `step=relax#3`. Inside a macro definition or a Beamer frame without `[fragile]`, TeX reads `#` as a parameter, so write `step=relax\#3` there. That spelling works everywhere.

## Slides

In a Beamer frame, `steps` turns a figure into overlays: one slide per frame of a series, all in one picture, so nothing moves from slide to slide.

```latex
\begin{frame}{Dijkstra's algorithm, step by step}
  \centering
  \algovizfile[algorithm=dijkstra, steps]{graph.json}   % every frame
\end{frame}

\begin{frame}{Settling $a$}
  The queue hands out $a$, at distance $3$. \pause

  \centering
  \algovizfile[algorithm=dijkstra, steps=extract\#3..improve\#5]{graph.json}
\end{frame}
```

- **`steps`** takes the selectors of `step`, and series of them: a range such as `relax\#2..-1`, a section such as `insert-5`, or several separated by commas, in braces: `steps={0, relax\#2, -1}`. Without a value, it means every frame. The frames come in timeline order, each once. `step` and `steps` replace each other: the last one given applies.
- **Where it starts.** A series starts where Beamer's incremental count stands, as `<+>` does: on the frame's first slide, or after a `\pause` or `\item<+->` items before it. Content after it with `<+->` comes after its last frame. `start=3` starts it on slide 3 instead, and two series with `start=1` step together.
- **Where it ends.** The last frame stays until the frame ends. As after `\item<+->`, continue with `\onslide<+->` rather than `\pause`, which would add a slide that repeats the last frame.
- **Handouts.** With `\documentclass[handout]{beamer}`, in transparencies and in `beamerarticle` notes, a series shows its last frame. Outside Beamer it does too, with a warning.
- **Size.** `width`, `height` and `scale` apply to the whole series, which has the canvas of its largest frame. A series that names one frame is an ordinary figure, on every slide.
- **By hand.** The command writes a series into one file of the cache. `algoviz export … --format tikz --one-file` writes such a file outside LaTeX, and `\algovizinput` draws it as a series.

`examples/slides.tex` steps through a whole run, a range after a pause, and a section.

## The input

The input of `\algoviz` is JSON, as TeX reads it:

- The outer braces of an object may be left out: `{"source": "A", ...}` and `"source": "A", ...` are the same.
- Line breaks and repeated spaces are fine.
- Write `%` as `\%`, which TeX would otherwise read as the start of a comment. `\#`, `\{`, `\}`, `\&`, `\$` and `\_` also stand for the characters.
- Backslash escapes in JSON strings, such as `\n` and `\u00e9`, work as in JSON, except that TeX drops a space right after a letter escape such as `\n`: write `\u0020` for such a space. On Windows, where a command line holds at most 8,191 characters, inputs over about 3,500 characters are refused with a message; put them in a file and use `\algovizfile[algorithm=...]`, as for any input you would rather keep apart.

## The cache

Each figure is kept in `_algoviz/` under the MD5 of everything that changes its drawing: the input or the file's contents, the algorithm, the step, the theme, the layout, the file format and the package version.

- A figure found there is drawn without running anything, so the next runs of a document cost only TikZ's time.
- Fonts and sizes are applied when the figure is drawn, so changing them makes no new figure.
- Share or commit `_algoviz/` to compile the document where the command is missing or shell escape is off, such as on arXiv or for a co-author.
- The package deletes nothing. Delete `_algoviz/` to clean up, and after updating the `algoviz` command.
- Figure files carry a format number, and the package reads its own format only. A file that `algoviz export --format tikz` made with an older command stops with an error that names both formats: make it again with the command of this release.

## Errors

When a figure cannot be made, LaTeX reports an error, and a framed box takes the figure's place with the whole message. Possible causes:

- an unknown algorithm or theme;
- an input that the algorithm rejects;
- an invalid document;
- a step that names no frame.

The package also says when:

- shell escape is off and the figure is not in the cache yet;
- restricted shell escape, the TeX Live default, did not run `algoviz`, which is not in `shell_escape_commands`;
- the command made no figure, usually because it is not installed or not on the `PATH`.

## Engines

The package behaves the same with pdfLaTeX, LuaLaTeX and XeLaTeX:

- text is typeset by the document's fonts;
- the symbols algorithm figures use, such as `∞`, `∅`, `≤`, arrows and Greek letters, are drawn as math, which every engine has;
- other characters outside ASCII are typeset as in the document's own text, so with pdfLaTeX they need fonts that have them.

## Security

Shell escape lets a document run programs, so compile documents from others with care, as with `minted`. The package passes the shell only checked text:

- the command line holds the algorithm id, the step and the theme, each checked against the characters it may have;
- the input is passed as hexadecimal;
- file names are quoted, and rejected if they contain characters that shells read inside quotes.

## Not yet

- **Custom themes** made with `createTheme` reach the player and the library; a theme file for the command, so that they reach LaTeX too, is future work.

`algoviz` is a working name. The package, its licence and its publishing to CTAN wait for the project's 1.0 release.
