# 0030. Built-in themes are named, carry their fonts, and work in every output

## Status

Accepted

## Context

Requirement R6 asks for switchable themes that all work in every output: the player, SVG, the Typst and LaTeX packages, slides and print. Next to `light` (the default), `dark` and `print`, it names the directions of the theme lab: textbook annotations (课本批注) and building blocks (积木教具), each with a night variant, the answer sheet (答题卡) and the Turbo C lab (机房 Turbo C). Each direction was drawn with the existing hooks only: an `SvgTheme` (ADR 0009) for the figure and the `--algo-*` custom properties for the player chrome. What the lab could not show:

- **Names.** Only `light`, `dark` and `print` have names. The player, the CLI, the MCP render tool, Typst and LaTeX each accept a theme by name (ADR 0025 to 0028); the MCP tool even lists two.
- **Fonts.** The lab loaded STIX Two Text, Lexend, Noto Sans, DotGothic16 and three code faces from Google Fonts. ADR 0024 measures text with bundled metrics, outlines it in standalone SVG, and says new themes add their faces to `@algoviz/fonts`; the player loads no web fonts at all.
  - Two of the lab's faces have a Reserved Font Name: IBM Plex Mono ("Plex") and Share Tech Mono ("Share"). Subsetting a font makes a Modified Version, which may not carry a reserved name.
  - Google's own web subsets drop ∞, ≤, → and ✓, which algorithm figures use, so metrics must come from the full fonts.
- **LaTeX.** The TikZ figures set text in the document's fonts (ADR 0027), so a theme's typeface never reaches LaTeX. Turbo C without a monospaced face, or a textbook figure in sans serif, loses half its look.
- **Night themes on paper.** `dark` paints no background: its light text vanishes on a white page, in print, and in a Typst or LaTeX document.
- **Chrome.** The player knows the chrome of `light`, `dark` and `print` only; the lab set the rest by hand on each element.
- **Kinds.** ADR 0029 added the priority queue, the heap view and side panels, which every theme must cover.

## Decision

### The themes

| Id              | Name in the docs | Scheme | Values                  | Labels                 | Chrome text   | Code           | TeX values / labels |
| --------------- | ---------------- | ------ | ----------------------- | ---------------------- | ------------- | -------------- | ------------------- |
| `light`         | 默认             | light  | JetBrains Mono SemiBold | Inter SemiBold         | Inter         | JetBrains Mono | normal / sf         |
| `dark`          | 深色             | dark   | JetBrains Mono SemiBold | Inter SemiBold         | Inter         | JetBrains Mono | normal / sf         |
| `print`         | 打印             | light  | JetBrains Mono SemiBold | Inter SemiBold         | Inter         | JetBrains Mono | normal / sf         |
| `textbook`      | 课本批注         | light  | STIX Two Text SemiBold  | STIX Two Text SemiBold | STIX Two Text | Noto Sans Mono | rm / rm             |
| `textbook-dark` | 课本批注 · 夜间  | dark   | STIX Two Text SemiBold  | STIX Two Text SemiBold | STIX Two Text | Noto Sans Mono | rm / rm             |
| `blocks`        | 积木教具         | light  | Lexend SemiBold         | Lexend SemiBold        | Lexend        | DM Mono        | sf / sf             |
| `blocks-dark`   | 积木教具 · 夜间  | dark   | Lexend SemiBold         | Lexend SemiBold        | Lexend        | DM Mono        | sf / sf             |
| `answer-sheet`  | 答题卡           | light  | Noto Sans Mono SemiBold | Noto Sans SemiBold     | Noto Sans     | Noto Sans Mono | tt / sf             |
| `turbo-c`       | 机房 Turbo C     | dark   | DotGothic16             | DotGothic16            | DotGothic16   | DotGothic16    | tt / tt             |

- **`light` stays the default** in every output, and `light`, `dark` and `print` keep their ids. The light theme is refined in its colours and spacing, within the tokens it has; the pull request shows it before and after.
- **Colours** come from the lab's directions, changed where the tests below fail them.
- **Ids are English**, lower case with hyphens, which every output's validation already accepts (the LaTeX package checks `[a-z0-9-]+`). The documentation gives each its Chinese name.

### One registry, chosen by name everywhere

`themes` in `@algoviz/svg` maps every id to its `SvgTheme`, and `ThemeName` is the union of its keys. Everything that takes a theme name checks it against `themes`, and the error lists them all (`UNKNOWN_THEME`).

| Output                     | How a theme is chosen                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<algo-player>`            | `theme="blocks"`; `auto` (the default: `light` or `dark` by the reader's colour scheme); or a pair, `theme="textbook textbook-dark"`, that follows the colour scheme between a day and a night theme |
| `algoviz export`, `render` | `--theme blocks`                                                                                                                                                                                     |
| MCP render tool            | `theme`, any id; `algoviz_show` keeps following the host's light or dark                                                                                                                             |
| Typst                      | `#algoviz(…, theme: "blocks")`, and in `algoviz-series`, `algoviz-figures`, `algoviz-slides`                                                                                                         |
| LaTeX                      | `\algoviz[theme=blocks]{…}{…}` or `\algovizset{theme=blocks}`                                                                                                                                        |
| Libraries                  | `renderSvg(scene, { theme: "blocks" })`, `exportFigures`, `createTheme("blocks", { … })`                                                                                                             |

Customisation does not change (ADR 0009): `createTheme(base, overrides)` takes any built-in theme as its base, and pages override any `--algo-*` property on the element.

### What a theme holds

- **TeX families.** `SvgTheme.tex` names, for values and for labels, the family the LaTeX package sets them in: `normal`, `rm`, `sf` or `tt` (below).
- **Weight from the face.** Painters draw text at the weight of the theme's face (`fontMetrics.value.weight`, `fontMetrics.label.weight`) instead of a fixed 600. A face with one weight, such as DotGothic16 at 400, is drawn as designed instead of being made bold by the browser. Themes with SemiBold faces draw exactly as before.
- **Family lists.** Each CSS list names the theme's face, then common CJK families (`'Noto Sans SC'`, `'PingFang SC'`, `'Microsoft YaHei'` or their serif counterparts), then fallbacks of a similar width, then the generic family.
- **Night themes paint their paper.** `dark`, `textbook-dark`, `blocks-dark` and `turbo-c` set `background` to their paper colour, so their figures stay legible on white paper, in print and in documents. Light themes stay transparent and take the page's colour.

### Fonts

- **Licences.** Every face is under the SIL Open Font License 1.1 without a Reserved Font Name: JetBrains Mono and Inter (ADR 0024), STIX Two Text, Lexend, Noto Sans, Noto Sans Mono, DM Mono and DotGothic16. Noto Sans Mono replaces the lab's IBM Plex Mono, and DotGothic16 its Share Tech Mono. Each face's licence is reproduced where its data is shipped: `packages/fonts/OFL.txt`, the player's font directory and the Typst package.
- **Source.** The new faces come from the `google/fonts` repository at one pinned commit, each file checked by its SHA-256. Variable fonts are instanced at the weight needed; static fonts are used as they are. JetBrains Mono and Inter keep their release archives, so the default theme's geometry does not move.
- **Generated, as in ADR 0024.** `npm run generate:fonts` writes the metrics and outlines of the five new figure faces into `@algoviz/fonts`, with the coverage ranges of ADR 0024: STIX Two Text SemiBold, Lexend SemiBold, Noto Sans SemiBold, Noto Sans Mono SemiBold and DotGothic16 Regular. Instancing and subsetting use `subset-font` (HarfBuzz compiled to WebAssembly), a development dependency that runs only in the script.
- **Glyphs a face lacks** are measured by ADR 0024's rules and stay text in standalone SVG, drawn by the renderer's fonts, as CJK is. STIX Two Text and DotGothic16 have no ∞ or ≤; such a value is measured at 1 em, which is more than any font gives it.
- **Web fonts in the player.** `@algoviz/elements` ships WOFF2 subsets of every face its chrome and figures draw, at the weights they use (400 and 600; DM Mono 400 and 500; DotGothic16 400). Each weight is split in two files, the Latin text (Basic Latin, Latin-1, General Punctuation) and the rest of the measured ranges, declared with `unicode-range` in one stylesheet, `fonts.css`. A browser downloads only the files whose characters the page draws: a page of the default theme loads the Latin files of Inter and JetBrains Mono.
  - The player links that stylesheet from the document's head the first time a player connects, resolved next to its own module (`import.meta.url`). It goes in the document, not the shadow root, because Chromium ignores `@font-face` there.
  - `AlgoPlayer.fontsUrl` points elsewhere, for a bundle that copies the files to another place, or turns loading off with `null`. The MCP App turns it off: its page is one file in a sandbox.
  - Where the stylesheet does not load, text falls back along the family lists. Layout measured the theme's faces, so text sits slightly differently; the lists name fallbacks close in width, and cells, nodes and badges leave a margin around their text.
- **CJK.** No CJK face is bundled; one weight of Noto Sans SC alone is several megabytes. CJK text is measured at 1 em (ADR 0024) and drawn by the platform's fonts in the player and in SVG, through the family lists, and by the document's fonts in Typst and LaTeX.
- **The Typst plugin and the standalone executable** embed `@algoviz/fonts`, so they outline text in every theme exactly as `algoviz export` does. What they fall back to is what SVG falls back to: a text with a character no outline covers stays text, which Typst draws with the document's fonts and the standalone writes unchanged.

### Fonts in TikZ

Text in a TikZ figure stays in the document's fonts (ADR 0027), so figures match the notes around them. The theme chooses only the family, from the document's own:

| `tex`  | LaTeX                  |
| ------ | ---------------------- |
| normal | `\normalfont`          |
| rm     | `\normalfont\rmfamily` |
| sf     | `\normalfont\sffamily` |
| tt     | `\normalfont\ttfamily` |

- **In the file.** File format 2 starts each figure's colours with `\algoviz@fonts{<values>}{<labels>}`, for instance `\algoviz@fonts{tt}{tt}` for Turbo C. Files made by hand with `algoviz export --format tikz` and read with `\algovizinput` therefore keep their theme's families. The package reads format 2 only; the cache key holds the package version, so cached figures are made again.
- **Keys.** `value font` and `label font` still override, when set. Their initial value becomes empty, meaning the theme's family. The light, dark and print themes give `normal` and `sf`, the defaults of ADR 0027, so their figures do not change.
- Sizes, the scaling into a cell's room and the halos do not change.

### The player's chrome

- **Tokens per theme.** `@algoviz/elements` holds the `--algo-*` values of every built-in theme in one table keyed by `ThemeName`, so a theme without chrome does not compile. The table becomes `:host([data-resolved-theme="…"])` rules, each with its `color-scheme`. A page's own properties on the element still win.
- **`customTheme`** replaces the figure's theme only, as before; the chrome follows `theme`.
- **Print.** The chrome is printed as shown (`print-color-adjust: exact`), so a night theme prints legibly; the `print` theme is the one for paper.
- **The language switcher** becomes a `<select>` named "Code language" (the owner's request, 2026-11-08), in place of the row of pressed buttons. The `language` attribute, the reader's stored choice shared by every player on the site, and `currentLanguage` keep their meaning; the `languages` part names the select.
- **The playground's Theme menu** lists every built-in theme, with `auto`.

### Tests

For every built-in theme:

- **Contrast**, WCAG 2.2 AA:
  - 4.5:1 for every text and what it is drawn on: values on the fill of each role, each group and both red–black colours; badge text on the pointer colour; titles, indices and labels on the paper (the background, or the label halo where it is transparent); edge labels on their halo;
  - 4.5:1 in the chrome for the text, the muted text and every code token on the panel, the surface and the current line, and for the accent's text on the accent;
  - 3:1 for the check mark on settled cells (non-text contrast).
- **Never colour alone** (ADR 0009): compare's border is heavier than the default's; swap and visited are dashed; settled has its check mark; highlight differs from default in lightness or border; highlighted and selected edges are wider than default ones.
- **Every kind and output.** The existing per-theme loops run over every theme: SVG over the fixtures and registry examples, the TikZ well-formedness checks, the Typst plugin's byte-identity with Node and the standalone executable's. The Typst and LaTeX compile tests draw a figure in each theme, Beamer included. The E2E axe scan runs the player in each theme.
- **Fonts.** Each generated face's metrics agree with its outlines' advances, and every face a theme names is bundled with its licence.

### Rejected

- **Google Fonts at run time.** A request to a third party from every page that shows a player, which offline pages, strict content security policies and the MCP App's sandbox cannot make.
- **Fonts inlined in the player's bundle.** Every page would download every theme's faces, a few hundred kilobytes, to show one.
- **Outlines in the player.** ADR 0024 keeps the player's text as text, readable, selectable and accessible.
- **Themes mapped to fonts inside the LaTeX package.** Files read with `\algovizinput` do not say their theme, so they would lose it.
- **Night themes left transparent.** Their figures would be unreadable on paper, which is where Typst and LaTeX put them.
- **Night pairs by naming convention** (`textbook` following the scheme to `textbook-dark` on its own). An explicit pair is plain to read and pairs any two themes.
- **Google's web subsets as the source of metrics.** They lack the symbols algorithm figures use.

## Consequences

- Every theme from the lab ships, by the same name in every output, and the default stays the default.
- **Public interfaces:** the theme ids; `SvgTheme.tex`; painters taking the weight from the face; `AlgoPlayer.fontsUrl`; the player's theme pairs; the language `<select>`; TikZ file format 2 and the empty initial value of `value font` and `label font`; the MCP render tool's `theme` enum.
- **Size.** `@algoviz/fonts` and the Typst engine grow by the outlines of five faces, and the player's bundle by their metrics; the pull request records the numbers. The web fonts are files next to the player and cost a page only what it draws.
- **Output changes.** `dark` figures now paint their background. Everything else in `light`, `dark` and `print` draws as before, apart from the light theme's refinement.
- **Tests take longer.** The per-theme loops run nine themes instead of three; the Typst plugin's comparison grows from 180 series to 540.
- **Adding a theme** means an `SvgTheme`, its chrome tokens and TeX families, and its faces if they are new; the tests pick it up from `themes`.
- Theme files for LaTeX and the CLI, so that custom themes reach every output (ADR 0027), remain future work.
