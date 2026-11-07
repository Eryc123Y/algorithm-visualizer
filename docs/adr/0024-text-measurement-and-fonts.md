# 0024. Text is measured with bundled font metrics and outlined in standalone SVG

## Status

Accepted. Supersedes the text-width rule of ADR 0008.

## Context

Layout cannot measure rendered text (ADR 0003), so ADR 0008 estimates every width as characters × font size × `charWidthRatio` (0.6), and painters must draw values in a monospace font. The estimate fails in four ways:

- **Wide glyphs.** A CJK ideograph is 1 em wide, a colour emoji 1 to 1.25 em. A value such as "数组" gets cells and nodes sized for 1.2 em and overflows them.
- **Proportional fonts.** Titles use a sans-serif font, and the themes of roadmap 1.6 draw values in Lexend, STIX Two Text or DotGothic16. In these fonts "W" and "∞" are far wider than 0.6 em, and "i" far narrower.
- **Fonts that are missing.** A standalone SVG names its fonts and leaves the rest to the renderer. Typst's SVG renderer, librsvg and Inkscape (how LaTeX users convert SVG) use whatever fonts are installed, so the same figure looks different in every document. The figures of roadmap 1.2 to 1.5 go into students' notes and slides, where they must look the same everywhere.
- **Painters measure too.** Node notes, edge labels and self-loop labels are placed by the painter with its own copy of the 0.6 estimate.

Layout must stay a pure function of the document and its options, without the DOM, Node.js or heavy dependencies, because it runs in browsers, Workers and the Typst plugin (requirements, quality bar).

## Decision

### Fonts and their data

- **Bundled faces.** Two OFL-1.1 fonts, neither with a Reserved Font Name:
  - JetBrains Mono SemiBold for values, indices, pointer names, notes and edge labels;
  - Inter SemiBold for titles and labels such as "top" and "null".

  These are the fonts the light theme already names first, so the default look keeps its intent. Index texts move from weight 500 to 600, so each font role has a single face, and the player and standalone SVG draw the same weight.

- **Data, generated and committed.** `scripts/fonts.ts` downloads pinned releases (JetBrains Mono 2.304, Inter 4.1), checks their SHA-256, reads them with opentype.js (a dev dependency) and writes one TypeScript module per face. It runs only when a font changes, never in CI or at run time. Each face has two modules:
  - **Metrics:** an id, the CSS family, the weight, units per em, and the advance width of every code point the face has in Latin (Basic, Latin-1, Extended-A), Greek, Cyrillic, general punctuation, super- and subscripts, currency, letterlike symbols, arrows, mathematical operators, miscellaneous technical, geometric shapes, and miscellaneous symbols and dingbats. Runs of equal widths are stored as ranges, so the monospace face is a few ranges and Inter about 4 kB.
  - **Outlines:** glyph paths in integer font units with relative commands, for ASCII, the symbols of Latin-1, Greek letters, and symbols common in algorithm figures (∞ ≤ ≥ ≠ ± × ÷ ← → ⇒ ∈ ∅ ⌈ ⌉ ⌊ ⌋ ✓ ✗ and others). About 50 kB per face, under 20 kB gzipped.
- **Package.** A new leaf package, `@algoviz/fonts`, holds the types, the generated modules, `textWidth`, and `OFL.txt` with both copyright notices. Each generated module repeats the copyright and licence in its header, which the OFL allows. Its code is under the project's licence, and its font data under OFL-1.1. Figures drawn with the fonts are documents, which the OFL does not cover. `@algoviz/core` depends on it for metrics, and `@algoviz/svg` for outlines. The player's bundle therefore carries metrics (a few kB) but no outlines.

### Measuring

`textWidth(text, font)` returns a width in em. It sums advances in integer font units and divides once, so ASCII in JetBrains Mono is exactly 0.6 em per character, as before. For each code point, the first rule that applies decides its width:

1. **Zero width:** combining marks, zero-width joiners and spaces, variation selectors, emoji skin-tone modifiers and tag characters, and any code point that follows a zero-width joiner (the rest of a joined emoji).
2. **The face's table.**
3. **East Asian wide and fullwidth** (CJK ideographs, kana, Hangul syllables, fullwidth forms): 1 em, the most they take in CJK fonts.
4. **Emoji:** 1.25 em, and 0.625 em for each half of a flag. Apple Color Emoji is 1 em wide and Noto Color Emoji 1.245 em.
5. **Anything else:** 1 em. This bounds the glyphs of other scripts (Thai, Devanagari and Arabic measured at most 0.75 em in the system fonts we checked).

Kerning and ligatures are ignored: they rarely widen text, and JetBrains Mono's ligatures keep their width. Spaces are measured; a renderer that collapses them only narrows the text. Titles add their 0.02 em letter spacing.

### Layout gets the metrics from the theme

- **Options.** `LayoutOptions.fonts` holds the metrics of both roles, `{ value, label }`, and replaces `charWidthRatio`. The default is JetBrains Mono SemiBold and Inter SemiBold. `uniformFont(0.6)` gives the old estimate to anyone who needs it.
- **Metrics in em.** Trace-wide metrics (ADR 0008) store widths in em instead of character counts, for example the widest value. `KindRuntime.measure` receives the layout's fonts, and `measureTrace(trace, fonts)` and `measureState(vis, state, fonts)` pass them on. Widths in em scale with font size, so the node that shrinks its font for long values (ADR 0013) still works from one measurement.
- **One font pair per scene.** Metrics measured with one pair must be laid out with the same pair. A series of figures (roadmap 1.2) shares both, so its figures share one scale.
- **Themes.** `SvgTheme` gains `fontMetrics`, the pair its painter draws with, next to `fonts`, the CSS family lists whose first family names that face. Callers pass `theme.fontMetrics` as the layout's `fonts`. The player does so and lays the trace out again when the pair changes, which never happens between light and dark, because they share fonts.
- **New fonts.** The built-in themes of roadmap 1.6 add their faces to `@algoviz/fonts` with the same script. A custom theme with another font either brings metrics generated by the script from its font file, or borrows the metrics of the bundled face closest to it.

Layout stays pure: metrics are plain data passed in the options.

### Painting

- **Player and `paintScene`: text elements.** Text stays `<text>`, naming the theme's fonts. The player's DOM stays readable, its text selectable and accessible. The player does not load web fonts; that comes with the themes of roadmap 1.6, whose fonts are installed almost nowhere. Without the face, a renderer falls back along the family list. Monospace fallbacks are about as wide (Menlo and SF Mono 0.6 em), and CJK and emoji were measured at their widest, so values still fit.
- **Standalone SVG: outlines.** `renderSvg` draws each text as one `<path>` built from the face's outlines, with an `aria-label` holding the text, so the figure looks the same in any browser, in Typst and after conversion for LaTeX. A text with a code point the face has no outline for stays a `<text>` element; CJK and emoji are drawn this way, by whatever fonts the renderer has, inside the room measured for them.
- **`outlineText: false`** gives `<text>` everywhere: a smaller file with selectable text, for renderers that have the fonts. The MCP render tool uses it, because a model reads the SVG as text, and outlines would multiply its size.
- **Embedding was rejected.** An `@font-face` rule with a data URL needs CSS (ADR 0009), and Typst, librsvg and Inkscape ignore it. Subsetting a font at run time would also need a heavy dependency.
- **Painters measure with the theme.** Note, edge-label and loop-label placement use `textWidth` with the theme's metrics, through the same helpers as layout.
- **Vertical metrics are unchanged.** The baseline stays 0.35 em below the centre of a text, for text elements and outlines alike.

### Typst and LaTeX

- **Typst (roadmap 1.3).** The package returns the outlined SVG, so a figure looks the same whatever fonts a document has. CJK text inside a figure is drawn by the document's fonts through Typst's own fallback.
- **TikZ (roadmap 1.4).** The TikZ painter lays out with the same scene but sets text in the document's fonts (`\ttfamily` for values, the main font for titles), so figures match the notes around them. Each text sits in a macro that scales it down, never up, when the document's font is wider than the room layout gave it, so the geometry holds in any font. Whether LaTeX documents get a theme whose metrics approximate Latin Modern is for the ADR of 1.4.

## Consequences

- Long numbers, long strings, CJK and emoji fit their cells, nodes, badges and labels. In the default theme, ASCII values, indices and pointer names keep their exact geometry, and titles change slightly, because they are now measured in Inter.
- Standalone SVG grows by roughly 200 bytes for each character drawn. Its text cannot be selected or searched in a PDF; the root `<title>` and the `aria-label`s describe it.
- A theme's fonts now affect geometry, not only colour: switching to a theme with other fonts lays the trace out again.
- Conformance layout fixtures depend on the bundled metrics. The metrics are part of the layout contract, plain data that other implementations can load.
- Adding or updating a font means running the script, reviewing the generated modules and keeping the licence notices.
- ADR 0012's `KindRuntime.measure` takes the fonts as a third argument, and ADR 0008's rule that values use a monospace font no longer holds.
