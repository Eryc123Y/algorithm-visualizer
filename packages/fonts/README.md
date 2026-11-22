# @algomotion/fonts

The fonts algomotion draws with, as data: the advance widths that layout measures text with, the glyph outlines that standalone SVG draws text with, and `textWidth`. It uses no DOM and no Node.js APIs. It has no font files; the player's web fonts are in [`@algomotion/elements`](https://www.npmjs.com/package/@algomotion/elements).

The faces are Inter, JetBrains Mono, STIX Two Text, Lexend, Noto Sans and Noto Sans Mono, all SemiBold, and DotGothic16 Regular. Each built-in theme takes its faces from them.

## Install

```sh
npm install @algomotion/fonts
```

Most code uses it through [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) and [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg), which depend on it.

## Measure text

```js
import {
  interSemiBold,
  jetbrainsMonoSemiBold,
  textWidth,
} from '@algomotion/fonts';

// Widths are in em: multiply by the font size.
console.log(textWidth('relax', interSemiBold) * 14); // 33.5029296875
console.log(textWidth('relax', jetbrainsMonoSemiBold) * 14); // 42
console.log(textWidth('松弛', interSemiBold)); // 2
```

A character the face does not have gets a fallback width: 1 em for CJK and other wide characters, 1.25 em for emoji, 1 em for anything else. No CJK font is bundled, so Chinese text in a figure stays text, drawn by the reader's or the document's fonts. `uniformFont(advance)` makes a face whose every glyph is `advance` em wide.

## The faces

Each face is two exports with the same `id`:

- metrics, such as `interSemiBold` (a `FontMetrics`): the CSS family and weight, `unitsPerEm` and the advance widths by code point;
- outlines, such as `interSemiBoldOutlines` (a `FontOutlines`): each glyph as SVG path data in font units, with y pointing down and the origin on the baseline.

Both are plain values, so they can be passed in layout options or read by other implementations. `@algomotion/fonts/encode` holds the encodings that the repository's generator script writes them with; you do not need it to use them.

## Related packages

- [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) measures text with the metrics when it lays out a frame.
- [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg) draws text with the outlines, so a figure needs no fonts installed.
- [`@algomotion/elements`](https://www.npmjs.com/package/@algomotion/elements) ships the themes' faces as web fonts, for the player.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

The code is under GPL-3.0-or-later. The metrics and outlines are derived from fonts under the SIL Open Font License 1.1, and keep that licence; `OFL.txt` in the package reproduces it with each font's copyright notice.
