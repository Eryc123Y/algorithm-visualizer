# algoviz for LaTeX

Step-by-step figures of algorithms and data structures in your LaTeX notes and Beamer slides. Name an algorithm, give it your input and pick a step, such as the third relaxation of Dijkstra's algorithm on your graph, and get a TikZ figure. You can also pass a document that you wrote, or that an AI wrote for you, in the algoviz format.

The figures are drawn with TikZ, so their text is set in your document's fonts and they scale with the page. Shapes, colours and positions are those of the SVG and Typst figures of the same step.

```latex
\documentclass{article}
\usepackage{algoviz}
\begin{document}
\algoviz[step=relax#3]{dijkstra}{
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

| Command                                     | Draws                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `\algoviz[keys]{id}{input}`                 | a step of a registry algorithm, run on the input, given as JSON       |
| `\algovizfile[keys]{doc.json}`              | a step of an algoviz document in a JSON file                          |
| `\algovizfile[algorithm=id, keys]{in.json}` | a step of an algorithm whose input is in a JSON file                  |
| `\algovizinput[keys]{figure.tex}`           | a figure made by `algoviz export --format tikz`, without shell escape |
| `\algovizset{keys}`                         | sets keys for the figures that follow, in the current group           |

`algoviz recipes` lists the algorithm ids and the inputs they take, and `algoviz guide` explains documents.

## Keys

| Key               | Default                | Meaning                                                                        |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `step`            | `-1`                   | The frame to draw (below).                                                     |
| `theme`           | `light`                | `light`, `dark` or `print`.                                                    |
| `width`, `height` | natural                | The figure's size. With both, the figure fits inside both and keeps its shape. |
| `scale`           | `1`                    | A factor on the natural size.                                                  |
| `value font`      | `\normalfont`          | The font of values in cells and nodes, indices, edge labels and pointers.      |
| `label font`      | `\normalfont\sffamily` | The font of titles and labels such as "top".                                   |
| `algorithm`       | none                   | With `\algovizfile`: the file is this algorithm's input, not a document.       |

At its natural size, a figure's values come out at 1.25 times the size of the text around it, and its labels at three quarters of it. A figure is never wider than the line, unless `width` or `height` says otherwise. Every figure of one run of an algorithm has the same canvas, so figures of different steps drawn at the same scale line up.

Package options, in `\usepackage[...]{algoviz}`:

- `command=algoviz`: the command to run, with a path or arguments if needed.
- `cachedir=_algoviz`: where the figures are kept.

## Steps

`step` takes a selector:

- a frame number: `0` is the starting state, `-1` the last frame;
- a step name, counted from 1: `relax#3` is the third step named `relax`;
- a step inside a section: `insert-5/relax#2`.

A selector that names several frames, such as a section or a range, is an error here, since a figure is one frame. If a step does not exist, the error box lists the step names the run has.

In ordinary text, write `step=relax#3`. Inside a macro definition or a Beamer frame without `[fragile]`, TeX reads `#` as a parameter, so write `step=relax\#3` there. That spelling works everywhere.

## The input

The input of `\algoviz` is JSON, as TeX reads it:

- The outer braces of an object may be left out: `{"source": "A", ...}` and `"source": "A", ...` are the same.
- Line breaks and repeated spaces are fine.
- Write `%` as `\%`, which TeX would otherwise read as the start of a comment. `\#`, `\{`, `\}`, `\&`, `\$` and `\_` also stand for the characters.
- TeX reads other backslash escapes inside JSON strings, such as `\n` or `é`, as commands. Put such input in a file and use `\algovizfile[algorithm=...]`. Do the same with long inputs on Windows, where a command line holds at most 8,191 characters.

## The cache

Each figure is kept in `_algoviz/` under the MD5 of everything that changes its drawing: the input or the file's contents, the algorithm, the step, the theme, the file format and the package version.

- A figure found there is drawn without running anything, so the next runs of a document cost only TikZ's time.
- Fonts and sizes are applied when the figure is drawn, so changing them makes no new figure.
- Share or commit `_algoviz/` to compile the document where the command is missing or shell escape is off, such as on arXiv or for a co-author.
- The package deletes nothing. Delete `_algoviz/` to clean up, and after updating the `algoviz` command.

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

- **Beamer overlays** of the steps of a series, inside one picture, come with roadmap 1.5.
- **Custom themes**, beyond the three built-in ones, come with roadmap 1.6.

`algoviz` is a working name. The package, its licence and its publishing to CTAN wait for the project's 1.0 release.
