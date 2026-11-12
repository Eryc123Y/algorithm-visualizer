# algomotion for LaTeX

Step-by-step figures of algorithms and data structures in your LaTeX notes and Beamer slides. Name an algorithm, give it your input and pick a step, such as the moment Dijkstra's algorithm improves a distance on your graph, and get a TikZ figure. You can also pass a document that you wrote, or that an AI wrote for you, in the algomotion format.

The figures are drawn with TikZ, so their text is set in your document's fonts and they scale with the page. Shapes, colours and positions are those of the SVG and Typst figures of the same step.

```latex
\documentclass{article}
\usepackage{algomotion}
\begin{document}
\algomotion[step=improve#3]{dijkstra}{A-B 4, B-C 1, A-C 7, C-D 2}
\end{document}
```

```sh
latexmk -pdf -shell-escape notes.tex     # or -pdflua, -pdfxe
```

The package runs the `algomotion` command through shell escape, as `minted` runs Pygments. It keeps every figure in `_algomotion/`, so a figure that did not change is never made again, and cached figures need no shell escape at all.

> **Not on CTAN yet.** Until it is published:
>
> 1. **The command.** Build the standalone `algomotion` executable in the algomotion repository: `npm install`, then `npm run build:standalone -w @algomotion/mcp`. This needs rustup and a C compiler, and writes `packages/mcp/dist/standalone/algomotion`, a 3 MB program that needs no Node.js. Put it on your `PATH`, or name it with the package option `command=`. The Node.js CLI works too: `command={node /path/to/algomotion.js}`.
> 2. **The package.** Put `algomotion.sty` next to your document, or in your local `texmf` tree under `tex/latex/algomotion/`.
>
> The `examples/` folder next to this package has notes and slides to start from.

## Requirements

- LaTeX 2024-06-01 or later, as in TeX Live 2024, and TikZ. The package is tested with TeX Live 2026.
- pdfLaTeX, LuaLaTeX or XeLaTeX. `latex` with `dvips` works too, but PostScript has no transparency, so the shadows of the light and dark themes come out solid.
- Shell escape (`-shell-escape`) the first time a figure is made.

## Commands

| Command                                        | Draws                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `\algomotion[keys]{id}{input}`                 | a step of a registry algorithm, run on the input ([The input](#the-input))         |
| `\algomotionfile[keys]{doc.json}`              | a step of an algomotion document in a JSON file                                    |
| `\algomotionfile[algorithm=id, keys]{in.json}` | a step of an algorithm whose input is in a file                                    |
| `\algomotioninput[keys]{figure.tex}`           | a figure or series made by `algomotion export --format tikz`, without shell escape |
| `\algomotionset{keys}`                         | sets keys for the figures that follow, in the current group                        |

`algomotion recipes` lists the algorithm ids and the inputs they take, and `algomotion guide` explains documents.

## Keys

| Key               | Default                 | Meaning                                                                                                                                                                                                                                                                         |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `step`            | `-1`                    | The frame to draw (below).                                                                                                                                                                                                                                                      |
| `steps`           | none                    | A series of frames, one per slide in Beamer ([Slides](#slides)).                                                                                                                                                                                                                |
| `start`           | `+`                     | The slide of a series' first frame ([Slides](#slides)).                                                                                                                                                                                                                         |
| `theme`           | `light`                 | A built-in theme: `light`, `dark`, `print`, `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` or `turbo-c`.                                                                                                                                                  |
| `layout`          | `narrow`, Beamer `wide` | Where structures beside the main one go, such as a queue: below it or beside it.                                                                                                                                                                                                |
| `width`, `height` | natural, Beamer filled  | The figure's size. With both, the figure fits inside both and keeps its shape. In Beamer, a side not given is the slide's ([Slides](#slides)).                                                                                                                                  |
| `scale`           | none                    | A factor on the natural size. `scale` without a value goes back to the default.                                                                                                                                                                                                 |
| `value font`      | the theme's             | The font of values in cells and nodes, indices, edge labels and pointers. By default the document's family the theme names: `\normalfont` for light, dark and print, `\rmfamily` for the textbook themes, `\sffamily` for blocks, `\ttfamily` for the answer sheet and Turbo C. |
| `label font`      | the theme's             | The font of titles and labels such as "top". By default `\sffamily`, but `\rmfamily` for the textbook themes and `\ttfamily` for Turbo C.                                                                                                                                       |
| `algorithm`       | none                    | With `\algomotionfile`: the file is this algorithm's input, not a document.                                                                                                                                                                                                     |

An algorithm's figure draws what it keeps besides its main structure, such as Dijkstra's priority queue or a call stack. `layout=narrow` puts those structures below the main one, which suits a column of notes; `layout=wide` puts them beside it, which suits a slide. The default is `wide` in the `beamer` class and `narrow` everywhere else, `beamerarticle` notes included; `layout=auto` goes back to it.

At its natural size, a figure's values come out at 1.25 times the size of the text around it, and its labels at three quarters of it. A figure is never wider than the line, unless `width` or `height` says otherwise. In Beamer a figure fills the frame instead ([Slides](#slides)); `scale=1` gives it its natural size there. Every figure of one run of an algorithm has the same canvas, so figures of different steps drawn at the same scale line up.

Package options, in `\usepackage[...]{algomotion}`:

- `command=algomotion`: the command to run, with a path or arguments if needed.
- `cachedir=_algomotion`: where the figures are kept.

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
  \algomotionfile[algorithm=dijkstra, steps]{graph.json}   % every frame
\end{frame}

\begin{frame}{Settling $a$}
  The queue hands out $a$, at distance $3$. \pause

  \centering
  \algomotionfile[algorithm=dijkstra, steps=extract\#3..improve\#5]{graph.json}
\end{frame}
```

- **`steps`** takes the selectors of `step`, and series of them: a range such as `relax\#2..-1`, a section such as `insert-5`, or several separated by commas, in braces: `steps={0, relax\#2, -1}`. Without a value, it means every frame. The frames come in timeline order, each once. `step` and `steps` replace each other: the last one given applies.
- **Where it starts.** A series starts where Beamer's incremental count stands, as `<+>` does: on the frame's first slide, or after a `\pause` or `\item<+->` items before it. Content after it with `<+->` comes after its last frame. `start=3` starts it on slide 3 instead, and two series with `start=1` step together.
- **Where it ends.** The last frame stays until the frame ends. As after `\item<+->`, continue with `\onslide<+->` rather than `\pause`, which would add a slide that repeats the last frame.
- **Handouts.** With `\documentclass[handout]{beamer}`, in transparencies and in `beamerarticle` notes, a series shows its last frame. Outside Beamer it does too, with a warning.
- **Size.** In the `beamer` class, a figure or a series fills the frame: it is as large as fits in the line's width and three quarters of the text height, keeping its shape, so a tall figure no longer runs off the slide and a narrow one grows. `width` and `height` replace their side of that box only: `height=0.6\textheight` leaves room for text and is still capped by the line, and `width=0.5\linewidth` is still capped by the height. `scale` gives the natural size times `scale`. In a column, the line is the column's; two figures side by side need `width=0.45\linewidth` each, or a column each. Figures of one run share a canvas, so they come out at one scale on frames with the same room.
- **A series** has the canvas of its largest frame, and `width`, `height` and `scale` apply to the whole of it. A series that names one frame is an ordinary figure, on every slide.
- **By hand.** The command writes a series into one file of the cache. `algomotion export … --format tikz --one-file` writes such a file outside LaTeX, and `\algomotioninput` draws it as a series.

`examples/slides.tex` steps through a whole run, a range after a pause, and a section.

## The input

The input of `\algomotion` is a notation, or JSON ([ADR 0032](../../../docs/adr/0032-algorithm-and-input.md)):

```latex
\algomotion{insertion-sort}{5 2 4 6 1 3}                     % a list
\algomotion{dijkstra}{A-B 4, B-C 1, A-C 7, C-D 2}            % a graph, from its first node
\algomotion{topological-sort}{shirt->tie, tie->jacket, socks} % a directed graph
\algomotion{inorder-tree-walk}{[4, 2, 6, 1, 3, null, 7]}     % a tree in level order
\algomotion{bst}{"from": "8 3 10 1 6", "ops": "insert 4, delete 3"}
\algomotion{dijkstra}{"graph": "A-B 4, B-C 1", "source": "C"}
\algomotion{kruskal}{}                                        % the first example
```

- **Lists** are numbers separated by commas or spaces, optionally in brackets; a level order writes `null` for a gap.
- **Graphs** are edge lists: `-` joins an undirected edge and `->` a directed one, a number after a space is the weight, and a name alone is a node without edges. Names are letters, digits and `_`. Write the edges on several lines if you like, but separate them with commas, since TeX turns a line break into a space.
- **Operations** of a data structure are written as exercises write them: `insert 4, delete 3`.
- An input that needs only one thing may be that thing alone, such as a sort's values or a graph algorithm's graph, which then starts at its first node; `"source"` (`"root"` for Prim) picks another. Empty braces run the algorithm on its first example.
- Anything that starts with `{`, `[` or `"` is JSON, with the structured forms that `algomotion recipes` lists, such as `"graph": {"nodes": [...], "edges": [["A", "B", 4], ...]}`. A notation error names the token and its position: `INVALID_NOTATION at $.input: Expected a weight or "," after "B-C", not "x" (character 12)`.

As TeX reads it:

- The outer braces of an object may be left out: `{"source": "A", ...}` and `"source": "A", ...` are the same.
- Line breaks and repeated spaces are fine.
- Write `%` as `\%`, which TeX would otherwise read as the start of a comment. `\#`, `\{`, `\}`, `\&`, `\$` and `\_` also stand for the characters.
- Backslash escapes in JSON strings, such as `\n` and `\u00e9`, work as in JSON, except that TeX drops a space right after a letter escape such as `\n`: write `\u0020` for such a space. On Windows, where a command line holds at most 8,191 characters, inputs over about 3,500 characters are refused with a message; put them in a file and use `\algomotionfile[algorithm=...]`, as for any input you would rather keep apart.

## The cache

Each figure is kept in `_algomotion/` under the MD5 of everything that changes its drawing: the input or the file's contents, the algorithm, the step, the theme, the layout, the file format and the package version.

- A figure found there is drawn without running anything, so the next runs of a document cost only TikZ's time.
- Fonts and sizes are applied when the figure is drawn, so changing them makes no new figure.
- Share or commit `_algomotion/` to compile the document where the command is missing or shell escape is off, such as on arXiv or for a co-author.
- The package deletes nothing. Delete `_algomotion/` to clean up, and after updating the `algomotion` command.
- Figure files carry a format number, and the package reads its own format only. A file that `algomotion export --format tikz` made with an older command stops with an error that names both formats: make it again with the command of this release.

## Errors

When a figure cannot be made, LaTeX reports an error, and a framed box takes the figure's place with the whole message. Possible causes:

- an unknown algorithm or theme;
- an input that the algorithm rejects;
- an invalid document;
- a step that names no frame.

The package also says when:

- shell escape is off and the figure is not in the cache yet;
- restricted shell escape, the TeX Live default, did not run `algomotion`, which is not in `shell_escape_commands`;
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

The package's licence and its publishing to CTAN wait for the project's 1.0 release.
