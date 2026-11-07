# 0027. The LaTeX package draws TikZ figures that a standalone algoviz command makes

## Status

Accepted

## Context

Students who write their notes in LaTeX want the figure of a chosen step from inside the document, as Typst users get it from the package of ADR 0026 (requirements, use case 1 and R5). Slides in Beamer come next: roadmap 1.5 turns the steps of a series into overlays (use case 3).

LaTeX cannot run JavaScript, but it can run a command through shell escape (`\write18`), as `minted` runs Pygments. So the package calls `algoviz export` (ADR 0025) and reads what it writes. Three questions follow:

- **What the command writes.** SVG needs a converter that LaTeX cannot call either (Inkscape for the `svg` package), and its text is drawn in the bundled faces (ADR 0024), not in the document's fonts. PDF has the same text problem, and each overlay would be its own image. TikZ is read by LaTeX itself: its text is set in the document's fonts, it scales with the page, and the frames of a series can share one picture, which is what Beamer overlays need.
- **How the command runs.** The `algoviz` command is a Node.js program today. Students writing LaTeX should not have to install Node.js, so the roadmap asks for a standalone executable.
- **How LaTeX talks to it.** The package must pass an algorithm id, an input in JSON, a step and a theme through a shell. This has to work the same in POSIX shells and in the `cmd.exe` that TeX Live uses on Windows, and under TeX's restricted shell escape. The package must also show the engine's errors, and must not run the command again when nothing changed.

### Measurements

A prototype bundled the CLI (`packages/mcp/src/cli.ts` and the engine, 0.6 MB of minified JavaScript) and built it three ways. Times are medians of 15 runs on an Apple M4 under macOS. Peak memory is measured for the Dijkstra figure.

|                                        | Node.js 24.22 | Node SEA | `bun build --compile` | QuickJS-ng host |
| -------------------------------------- | ------------- | -------- | --------------------- | --------------- |
| executable                             | needs Node.js | 123.5 MB | 89.6 MB               | 2.1 MB          |
| start and print the usage              | 47 ms         | as Node  | 21 ms                 | 21 ms           |
| one Dijkstra figure (`relax#3`)        | 61 ms         | as Node  | 35 ms                 | 45 ms           |
| every Dijkstra frame (27 files)        | 69 ms         | as Node  | 39 ms                 | 61 ms           |
| last frame of bubble sort, 1,024 steps | 93 ms         | as Node  | 66 ms                 | 324 ms          |
| peak memory                            | 72 MB         | as Node  | 54 MB                 | 14 MB           |

- **Node SEA** (single executable application) copies the official `node` binary and appends the bundle. Homebrew's Node links `libnode` dynamically and cannot carry the bundle, so the executable was not assembled. Its size is the official v24.22.2 macOS arm64 binary (122.6 MB) plus the prepared blob with its code cache (0.97 MB). It runs the same V8 as Node, so its times are Node's.
- **bun** 1.4.4 compiles the bundle into its runtime. It can build for every platform from one machine, but each file weighs about 90 MB.
- **QuickJS-ng host** is a small Rust program: rquickjs 0.14.0, QuickJS-ng 0.16.2, the same engine as the Typst plugin. The CLI's bytecode (0.73 MB) is compiled into the binary. The program gives the CLI five functions: read a file or standard input, write a file, make a directory, remove a file, and write to standard output or standard error. Bytecode that the Typst plugin compiled in WebAssembly loads in the native host as well, so the bytecode does not depend on the platform.
- **The same figures.** The QuickJS host's SVG and TikZ files, and bun's SVG files, are byte-identical to those of Node.
- QuickJS interprets, so long documents cost more: 324 ms for the longest run in the registry, against 66 ms with bun's JIT. A typical figure costs about as much as starting Node.

**In LaTeX.** The prototype package compiled a document of ten Dijkstra figures, with the QuickJS host as the command:

| Engine   | First run, ten calls | Cached run | Cached, without shell escape |
| -------- | -------------------- | ---------- | ---------------------------- |
| pdfLaTeX | 1.40 s               | 0.85 s     | 0.85 s                       |
| LuaLaTeX | 1.52 s               | 1.02 s     | 1.02 s                       |
| XeLaTeX  | 1.24 s               | 0.76 s     | 0.76 s                       |

A figure the command makes adds about 50 ms to the run that makes it; a cached figure costs only TikZ's time.

## Decision

### The TikZ painter, `@algoviz/tikz`

A new package, `packages/tikz`, turns a scene into TikZ. It draws from the shapes of the SVG painter.

- **Shapes.** `renderTikz(scene, { theme })` calls `paintScene` from `@algoviz/svg`, which decides every shape, colour, line width, dash and position, and writes the painted shapes as TikZ paths. So the two painters agree on geometry by construction. Only text and a few drawing details differ (below).
- **Coordinates.** The painter applies each item's transform itself: a translation, and for edges a rotation and a horizontal stretch. Every point is written in scene units, with y pointing down as in SVG, and the picture sets `x` and `y` to the unit, with y negative. TikZ's own `rotate` would turn the other way on such a flipped axis, so it is not used. Rectangles, circles and text are only ever translated; the painter throws if they are not, since that would be a bug.
- **Series.** `@algoviz/svg` gains `prepareScenes(document, { theme })`. It does what `prepareFigures` did before painting: it loads the document, lays it out once in the theme's fonts and measures one canvas over every frame (ADR 0025). It returns `SceneFrame`s (`frame`, `selector`, `width`, `height`, `narration`, `scene`). `prepareFigures` becomes `prepareScenes` followed by `renderSvg`. `@algoviz/tikz` has `prepareTikzFigures` and `exportTikzFigures`, built the same way, whose figures carry `tikz` in place of `svg`. A frame's TikZ figure and SVG figure therefore have the same size and positions.
- Like the other painters it uses neither the DOM nor Node.js.

### Text in the document's fonts

The document's fonts are not known when the command runs, so layout stays as it is: it measures text with the bundled faces (ADR 0024), JetBrains Mono for values and Inter for labels.

- **Placement.** Each text becomes a call to `\algoviz@text` with its anchor point on the baseline, its alignment (left, centre or right), its size in scene units, its role (value or label), its colour, its halo and the text itself. The package sets the text in the document's fonts and places its baseline at the anchor, as SVG's `text-anchor` does.
- **Fonts.** The keys `value font` and `label font` name the fonts. They default to `\normalfont` for values, indices, edge labels and badges, and to `\normalfont\sffamily` for titles and labels such as "top". Weights follow the document; the bundled faces' SemiBold is not copied.
- **Size.** The package sets the text at the current font size and scales its box to the text's size in the scene. Asking for the exact size with `\fontsize` would make pdfLaTeX's default Computer Modern, which comes in fixed sizes only, substitute and warn on every figure.
- **Room.** The bundled faces are wide: a JetBrains Mono character is 0.6 em, while digits in Computer Modern, Latin Modern, Times and Palatino are 0.5 em. Text in the usual document fonts therefore fits where layout measured it, with room to spare. As a safety net, the painter passes the width that text inside a cell, a node or a badge may take: the cell's or badge's width less a margin, or the node's diameter less a margin. The package scales such a text down if it comes out wider. Free-standing text, such as titles, indices and edge labels, keeps its size, as layout spaced it with the wider faces.
- **Characters.**
  - LaTeX's special characters (`\ { } # $ % & _ ~ ^`) and the characters that OT1 fonts draw as other glyphs (`< > | "`) become the commands that print them.
  - Pairs that TeX fonts join into ligatures (`--`, `''`, `,,`, `!``) are kept apart.
  - The symbols algorithm figures use, such as `∞`, `∅`, `≤`, arrows and Greek letters, become math commands, which every engine and encoding has.
  - Any other character is written in UTF-8, for the document to typeset as it would in its own text. In pdfLaTeX that needs the character to be set up, as for any text.
- **Halos.** SVG outlines edge and node labels with a halo in the background colour, so they stay legible over lines. TikZ cannot stroke glyphs in every engine: the PDF text render mode needs driver-specific literals, `pdfrender` does not support XeTeX, and DVI output has neither. Instead the package draws a box of the halo colour behind the text, extending as far as the halo would. This is the TikZ idiom for labels on lines (`fill=white`), and it is the one visible difference in drawing.

### Themes in TikZ

A theme is chosen by name, `light`, `dark` or `print`, as for SVG and Typst. It is applied by the same `paintScene`, so every built-in theme, now and from roadmap 1.6, works in LaTeX without code of its own.

- **Colours.** Every colour a figure uses becomes an `xcolor` colour defined from its hexadecimal value (`\definecolor{algoviz@c3}{HTML}{0F7B6C}`), local to the picture and numbered in order of first use. A colour with alpha, such as the light theme's shadow `rgba(20, 45, 38, 0.1)`, becomes the colour plus `fill opacity` or `draw opacity`.
- **Styles.** Line widths, dash patterns and corner radii become TikZ options in scene units: `line width=1.25\algoviz@u`, `dash pattern=on 2\algoviz@u off 2.5\algoviz@u`, `rounded corners=8\algoviz@u`. The figure scales as a whole, with its lines and text.
- **No TikZ styles per role.** A role's look comes from the theme, as in SVG, so the same theme gives the same figure in every output. Themes with custom tokens (R6) reach LaTeX when the command accepts a theme file; that is left to roadmap 1.6.

### The file format

`algoviz export --format tikz` writes one `.tex` file per figure:

```tex
% algoviz figure for LaTeX, format 1: Dijkstra's algorithm
% Frame 11, relax#3.
% 9 + 9 = 18 ≥ 0: keep A at 0.
% Draw it with \algovizinput from the algoviz LaTeX package.
\algoviz@figure{1}{390.77}{412}{%
\algoviz@color{1}{1F2A26}%
…
}{%
\path[draw=algoviz@c2,line width=3.5\algoviz@u] (230.71,104) -- (303.45,146);
\algoviz@text{272.58,119.68}{c}{12}{0}{value}{algoviz@c1}{algoviz@c3,1.75\algoviz@u}{7}
…
}%
```

- **`\algoviz@figure{format}{width}{height}{colours}{drawing}`** gives the format number, now `1`, and the canvas size in scene units. The package checks the format and draws the figure. A file of another format is an error that asks for a command and a package of the same release.
- **The drawing** is plain TikZ: `\path` commands with colours and lengths as above, and `\algoviz@text` for text.
- **Comments** at the top name the figure, the frame, its selector and its narration, so a file can be told apart from others in the cache.
- **The package's macros.** The file needs the package and is read with `@` as a letter. `\algovizinput{file.tex}` does that, for files made with the command by hand, without shell escape.
- **Slides.** Since every figure of a document has the same canvas (ADR 0025), the frames of a series can share one `tikzpicture`. Roadmap 1.5 defines `\algoviz@figure` so that each frame's drawing goes into the shared picture inside `\only<n>`. One frame per file, as for SVG, keeps `export`'s naming rules unchanged.

### The command: `algoviz export --format tikz`

`algoviz export` (ADR 0025) gains three options:

- **`--format svg|tikz`.** `svg` is the default. `tikz` writes `.tex` files: `--name` patterns get `.tex` appended instead of `.svg`. An `--out` value ending in `.svg` or `.tex` is a usage error, as before.
- **`--input-hex <hex>`.** The input as hexadecimal UTF-8, in place of `--input`. Programs that cannot quote JSON for every shell, such as the LaTeX package, use it: hexadecimal digits mean the same to `sh` and `cmd.exe`. Giving both, an odd number of digits or bytes that are not UTF-8 is a usage error.
- **`--error-file <file>`.** On an error, exit code 1 or 2, the command also writes the message to this file, creating its directory. For a usage error, the file has the message without the usage text. A successful run removes the file. TeX cannot read a command's standard error, so this is how the package learns what went wrong.

The package's call, for `\algoviz[step=relax#3]{dijkstra}{…}`:

```sh
algoviz export dijkstra --input-hex=7b2267… --step=relax#3 --theme=light --format=tikz --out=_algoviz --name=<key> --error-file=_algoviz/<key>.err
```

For a document file, the file name is the first argument, in double quotes: `algoviz export "notes/heap.json" --step=… …`.

- Every value is checked before it reaches the shell:
  - the algorithm id against `[a-z0-9][a-z0-9.-]*`;
  - the step against `[A-Za-z0-9#/.,-]+`;
  - the theme against `[a-z0-9-]+`;
  - a file name must not contain `"`, `$`, `` ` ``, `\`, `%`, `!`, `^`, `&`, `|`, `<`, `>`, `;`, `*`, `?` or control characters.
- A value that fails is a LaTeX error that names it, and nothing runs.
- The step is passed as `--step=…`, so its `#` is never at the start of a word, where `sh` would read a comment.
- The command line holds nothing else from the document, so the document cannot run commands through the package. The command itself comes from the package option `command`, which the author sets in the preamble.

### The standalone executable

The standalone `algoviz` is the CLI's JavaScript in QuickJS-ng, in a small native Rust program: `packages/mcp/standalone/`.

- **Why QuickJS.** At 2.1 MB it is 40 times smaller than bun's executable and 60 times smaller than Node's. It starts as fast as bun, and a typical figure costs about as much as starting Node. TeX distributions ship small native programs; an executable of about 100 MB per platform would not fit there. Being small and limited to files, it could one day be listed in TeX Live's `shell_escape_commands`, as `latexminted` is, so that the package works under restricted shell escape. That is the owner's decision when publishing (roadmap 4.3).
- **The same CLI.** The executable runs `packages/mcp/src/cli.ts`, every command except the MCP server. Only the host differs:
  - the bundle replaces `node:fs` and `node:path` with small modules over the host's functions;
  - the authoring guide's Markdown is bundled into the JavaScript instead of read from `guide/`.
- **Build.** `npm run build:standalone -w @algoviz/mcp`:
  - bundles the CLI with Vite (Node only);
  - builds the Rust crate, whose build script compiles the bundle to QuickJS bytecode with the crate's own rquickjs and includes it in the binary;
  - writes `packages/mcp/dist/standalone/algoviz`, or `algoviz.exe` on Windows.
- **Toolchain.** The build needs rustup and a C compiler for the host: the Rust version is pinned in `rust-toolchain.toml` and the crates in `Cargo.lock`, with the same rquickjs as the Typst plugin. It builds for the platform it runs on; `--target` takes another triple if the toolchain has it. Builds for macOS, Linux and Windows, and their publishing, belong to roadmap 4.3. Nothing is published before then.
- **Not committed.** The executable is built, unlike `plugin.wasm`, because every change to the engine changes it, and it is built per platform.
- **Exit codes** are the CLI's: 0, 1 for errors in a document, input or step, 2 for usage errors. An exception inside the engine is a bug: the CLI writes its message to the error file, and the executable exits with 70 after printing the message and stack.
- **The npm package** keeps its Node.js `algoviz`, which behaves the same.

### The LaTeX package, `algoviz.sty`

`packages/latex/` is a workspace, `@algoviz/latex`. `package/` holds what will be published: `algoviz.sty` and its README. The package needs TikZ and LaTeX 2024-06-01 or later, as in TeX Live 2024, for expl3's `\str_mdfive_hash:n` (2023-05) and `\str_set_convert:Nnnn` with its fixes of 2023-12. It is tested with TeX Live 2026.

```tex
\usepackage{algoviz}           % options: command=algoviz, cachedir=_algoviz

\algoviz[step=relax#3]{dijkstra}{"graph": {"nodes": ["A", "B", "C"],
  "edges": [["A", "B", 4], ["B", "C", 1], ["A", "C", 7]]}, "source": "A"}
\algovizfile[step=3, theme=print]{heap.json}                 % a document
\algovizfile[algorithm=dijkstra, step=relax#2]{graph.json}   % an input in a file
\algovizinput{figures/dijkstra-11.tex}                       % made by hand
\algovizset{width=0.8\linewidth}
```

- **Commands.**
  - `\algoviz[keys]{id}{input}` runs a registry algorithm on its input.
  - `\algovizfile[keys]{file}` reads a JSON document. With `algorithm=<id>`, the file is that algorithm's input instead.
  - `\algovizinput[keys]{file}` draws a figure file made by `algoviz export --format tikz`.
  - `\algovizset{keys}` sets keys for what follows, within the current group.
- **Keys.**
  - `step`: one frame, with the rules of `selectFrame` (ADR 0020). It defaults to `-1`, the last frame, as in Typst.
  - `theme`: `light` by default.
  - `width` and `height`: the figure's size. With both, the figure fits inside both and keeps its shape.
  - `scale`: a factor on the natural size.
  - `value font` and `label font`, as above.
- **Natural size.** One scene unit is a sixteenth of the current font size, so values (20 units) come out at 1.25 times the surrounding text and labels (12 units) at three quarters of it. In a 10 pt document, the Dijkstra example is 244 pt wide. Without `width` or `height`, the figure is shrunk to `\linewidth` if it would be wider.
- **Package options.** `command` names the executable, for example `command=/opt/algoviz/algoviz` or `command=npx algoviz`. `cachedir` names the cache directory. Both are preamble-only.
- **`#` in steps.** `step=relax#3` works in ordinary text. Inside a macro definition or a Beamer frame without `fragile`, TeX reads `#` as a parameter, so `step=relax\#3` is the spelling that works everywhere. The package accepts both, and turns the doubled `##` that TeX makes of a parameter character back into one. The selector grammar of ADR 0020 does not change.
- **The input argument** is JSON as TeX reads it.
  - The braces of an object may be left out, since TeX takes the outer pair off anyway: `{"source": "A", …}` and `"source": "A", …` are the same.
  - `\#`, `\%`, `\{`, `\}`, `\&`, `\$` and `\_` stand for the characters, and `%` must be written `\%`.
  - Line breaks and repeated spaces become single spaces, which JSON ignores outside strings.
  - TeX reads other backslash escapes inside JSON strings, such as `\n` and `é`, as control sequences. Such input goes in a file, with `\algovizfile[algorithm=…]`.
  - On Windows, a command line holds at most 8,191 characters, which limits the input to about 4,000 bytes there. Longer inputs also go in a file.

### Calling the command and the cache

For each figure, the package:

1. **Turns the arguments into text.** The algorithm id, the input, the step and the theme are detokenized and unescaped as above. The input is converted to hexadecimal UTF-8: in pdfTeX it is already bytes; in LuaTeX and XeTeX it is encoded first.
2. **Computes the key**, the MD5 of `algoviz tikz <format> <package version>`, the kind of source (`algorithm`, `document` or `input`), the id, the input text or the MD5 of the file's contents, the step and the theme. Keys use expl3's `\str_mdfive_hash:n` and `\file_mdfive_hash:n`, which every engine has.
3. **Reads a cached figure.** If `<cachedir>/<key>.tex` exists, the package draws it and runs nothing. Cached figures therefore need no shell escape: a document whose `_algoviz/` is shared compiles where the command is missing, such as on arXiv or for a co-author without it.
4. **Runs the command** otherwise, if shell escape allows it, as shown above. The command creates the cache directory and writes the figure there. Both TeX and the shell resolve the path from the current directory, so `-output-directory` changes nothing, and TeX itself writes no file for the package.
5. **Draws the figure**, or reports why there is none:
   - **An error file** holds the engine's diagnostics, such as an unknown algorithm, a rejected input or a step that names no frame. The first line becomes a LaTeX error. The figure is replaced by a framed box that lists every line, whose hint names the document's step names (ADR 0020), as in Typst.
   - **Neither file**: the command did not run. Under unrestricted shell escape, the error says the command was not found and shows the command line. Under restricted shell escape, the TeX Live default, it says that `algoviz` is not in `shell_escape_commands` and that `-shell-escape` is needed.
   - **Shell escape off**: the error says to compile with `-shell-escape`.

Figures are not reused across changes:

- The key covers everything that changes the drawing: input, step, theme, format and package version.
- Fonts and sizes are applied by TeX when the figure is drawn, so changing them needs no new figure.
- The command's version is not in the key, since asking it would take a call on every run. A new package release makes every figure again; after updating only the command, delete the cache.
- Errors are not cached: a figure that failed is tried again on the next run.
- The package deletes nothing. Figures no longer used stay in the cache, a few kilobytes each, until the user deletes the directory.

### pdfLaTeX, LuaLaTeX and XeLaTeX

`\usepackage{algoviz}` behaves the same on all three, and the tests compile the examples with each.

- **Shell escape:** expl3's `\sys_shell_now:n` runs commands in all three (LuaTeX through Lua's `os.execute`), and `\sys_if_shell…` reports the mode.
- **Hashes:** expl3 provides MD5 on all three. The hexadecimal input differs by engine only in how it is computed, not in its result.
- **Text:**
  - pdfLaTeX typesets in OT1 or T1 with the document's input encoding;
  - LuaLaTeX and XeLaTeX typeset in TU with `fontspec`'s fonts;
  - the escaping above gives the same characters on all three.
- **Drawing:** every TikZ driver used (pdfTeX, LuaTeX, `dvipdfmx` for XeTeX) supports the opacity of shadows.
- **DVI:** `latex` with `dvips` draws the figures too, but PostScript has no transparency, so the light and dark themes' shadows come out solid there. The `print` theme has none.

### Build, tests and what is committed

- **`@algoviz/tikz`** has unit and property tests in `npm run check`:
  - the escaping;
  - colours and every kind of shape;
  - transforms: rotated edges and self-loops, checked against points that an independent reading of the SVG gives;
  - every fixture and every registry example in every theme gives a well-formed file: balanced braces, only known commands, every colour defined, finite numbers inside the canvas;
  - its text anchors and shapes match the SVG of the same frame, one for one.
- **The CLI's tests** cover `--format tikz`, `--input-hex` and `--error-file`.
- **`npm run test:standalone`** builds the executable if needed. It checks that its SVG and TikZ files are byte-identical to the Node CLI's for every registry example, and checks its exit codes and error files. It needs the Rust toolchain, so it stays out of `npm run check`.
- **`npm run test:latex`** compiles the package's examples, an article and a Beamer deck, with `pdflatex`, `lualatex` and `xelatex` through `latexmk`. It checks:
  - the cache: a second run calls nothing;
  - the error box;
  - the messages for shell escape off and for a missing command.

  It needs TeX Live and stays out of `npm run check`. The command it calls is the Node CLI by default, or the executable named by `ALGOVIZ_COMMAND`.

- **Committed:** the `.sty`, its README and the examples. Not committed: figures in caches, PDFs and the executable.

`algoviz` is a working name (roadmap 4.1). It appears in the package name, the commands, the `algoviz@` prefix of the file format's macros, the cache directory `_algoviz` and the executable. Publishing to CTAN and releasing executables wait for the owner (roadmap 4.3), and so does the package's licence.

### Rejected

- **SVG or PDF figures with `\includegraphics`.** Their text is in the bundled faces, not the document's. SVG needs Inkscape through a second shell escape. Each Beamer overlay would be a separate image.
- **Measuring text in TeX before layout.** Layout would depend on the document's fonts, so the same step would look different from the SVG, the Typst figure and other documents. It would also need two passes and two calls. The bundled faces' generous widths and the shrink-to-fit of cell text make this unnecessary.
- **Glyph halos with PDF text render modes.** These need code for each driver; `pdfrender` covers pdfTeX and LuaTeX but not XeTeX, and DVI has no such mode.
- **Node SEA and `bun build --compile`.** At 123 MB and 90 MB they are 40 to 60 times the size of the QuickJS host for the same CLI; bun is faster only on very long documents. bun's cross-compiling is convenient, but the size goes to every user.
- **Passing JSON on the command line, quoted.** POSIX shells and `cmd.exe` quote differently, and `cmd.exe` cannot pass `"` safely inside a quoted argument. Hexadecimal needs no quoting anywhere.
- **TeX writing a request file for the command.** TeX cannot create the cache directory on the first run. With `-output-directory`, TeX writes into that directory while the command runs in the current one.
- **Redirecting standard error to a file in the cache.** A shell opens the redirection before the command runs, so on the first run the directory does not exist yet, and restricted shell escape refuses redirections anyway.
- **Caching errors.** An error may come from an older command, which caching would keep after an update. Errors are rare and cheap to repeat.
- **Scaling the whole picture with `\scalebox`.** It would work, but lengths in scene units let TikZ compute the final size, line widths and bounding box directly. Scaling each text alone avoids font substitutions without scaling anything else.
- **TikZ styles per role (`algoviz/compare/.style=…`)** as the way to theme. Figures would differ between LaTeX and the other outputs, and every theme would need a second definition.

## Consequences

- Students get native figures in LaTeX from an algorithm and its input, or from a document. Text is in the document's fonts, and positions and colours are those of the SVG and Typst figures for the same step.
- **Speed.** A new figure costs about 50 ms of the run that makes it, and a figure that did not change costs only TikZ's time, with or without shell escape. Cached figures make documents portable to places without the command.
- **One more package.** `@algoviz/tikz` follows `@algoviz/svg`, since both draw the same painted scene: a change to a shape in `paintScene` shows in both, and the tests compare them.
- **Public interfaces:**
  - `@algoviz/svg` exports `prepareScenes` and `SceneFrame`;
  - `@algoviz/tikz` exports `renderTikz`, `prepareTikzFigures` and `exportTikzFigures`;
  - the CLI has `--format`, `--input-hex` and `--error-file`;
  - the TikZ file format (version 1), the LaTeX commands and keys, and the cache key are package interfaces, changed only by a new ADR.
- **Two build paths for the executable.** It needs Rust and a C compiler, as `plugin.wasm` does, but it is built rather than committed. Releasing it for every platform is part of roadmap 4.3.
- **Documents do not run commands.** Only checked text and hexadecimal reach the shell. Shell escape remains a risk for documents from others, as with `minted`, and the README says so.
- **Text differs from SVG.** In TikZ figures, text uses the document's fonts, regular weight by default, and its widths. Labels on lines sit on boxes rather than glyph halos.
- **Slides.** Roadmap 1.5 builds Beamer overlays from the same figures: one picture, one canvas, `\only<n>` per frame.
