# @algomotion/svg

The SVG painter of algomotion: it draws a scene from [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) as a standalone SVG string, and exports chosen frames of a document as figures for notes, handouts and slides. It uses no DOM and no Node.js APIs.

Text is drawn as glyph outlines of the bundled fonts, so a figure looks the same in a browser, in Typst and after conversion for LaTeX. Chinese, which the bundled fonts do not cover, stays text, drawn by the reader's fonts. Every figure of a document has the same size, so a series of steps lines up at one scale.

## Install

```sh
npm install @algomotion/svg
```

## Export figures

`exportFigures(document, options)` returns `{ ok: true, value }`, where `value.figures` holds one figure per frame with its `frame`, `selector`, `width`, `height`, `narration` and `svg`; or `{ ok: false, error }` with diagnostics.

```js
import { writeFileSync } from 'node:fs';

import { exportFigures } from '@algomotion/svg';

const doc = {
  version: '1.0',
  structures: { arr: { kind: 'array', initial: [5, 3, 8, 1] } },
  steps: [
    {
      actions: [{ target: 'arr', type: 'compare', i: 0, j: 1 }],
      meta: { id: 'compare', narration: 'Compare 5 and 3.' },
    },
    {
      actions: [{ target: 'arr', type: 'swap', i: 0, j: 1 }],
      meta: { id: 'swap', narration: '5 > 3, so swap them.' },
    },
  ],
};

const result = exportFigures(doc, {
  steps: ['compare', 'swap'],
  theme: 'print',
});
if (!result.ok) throw new Error(result.error[0].message);
for (const figure of result.value.figures) {
  writeFileSync(`arr-${figure.frame}.svg`, figure.svg);
  console.log(figure.frame, figure.selector, figure.width, figure.height);
}
// 1 compare 272 112
// 2 swap 272 112
```

The options:

- `steps`: selectors such as `relax#3`, `insert-5` or `2..5`, as `@algomotion/core` reads them, or frame numbers. Without it, every frame.
- `theme`: `light` (the default), `dark`, `print`, `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` or `turbo-c` (`themeNames`), or a theme of your own from `createTheme`.
- `layout`: `wide` (the default) or `narrow`, which puts side structures below the main one.
- `locale`: `en` (the default) or `zh`, the language of the words the layout draws itself, such as "(empty)" and "top". A document's own text is drawn as written.

An unknown theme, layout or locale is `UNKNOWN_THEME`, `UNKNOWN_LAYOUT` or `UNKNOWN_LOCALE` at `$.theme`, `$.layout` or `$.locale`.

## An algorithm's run, in Chinese

With [`@algomotion/recipes`](https://www.npmjs.com/package/@algomotion/recipes), run an algorithm on an input and draw its steps. `prepareFigures` loads the document once and draws any frame, or any series with `figures(selectors)`, on demand:

```js
import { runAlgorithm } from '@algomotion/recipes';
import { createTheme, prepareFigures } from '@algomotion/svg';

const run = runAlgorithm('dijkstra', 'A-B 4, B-C 1, A-C 7, C-D 2', {
  locale: 'zh',
});
if (!run.ok) throw new Error(run.error[0].message);

const theme = createTheme('textbook', { cell: { compare: { fill: '#ffd' } } });
const prepared = prepareFigures(run.value.document, {
  theme,
  layout: 'narrow',
  locale: 'zh',
});
if (prepared.ok) {
  const figure = prepared.value.figure('improve#3');
  if (figure.ok) console.log(figure.value.narration); // 4 + 1 = 5 < 7：C 经由 B 改进为 5。
}
```

To draw a single scene, `renderSvg(scene, { theme })` takes one from `layoutTrace` in `@algomotion/core`. Lay it out in the theme's fonts, `layoutTrace(trace, { fonts: resolveTheme(name).fontMetrics })`, so that its text fits.

## Related packages

- [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) lays out the scenes this package paints.
- [`@algomotion/fonts`](https://www.npmjs.com/package/@algomotion/fonts) holds the glyph outlines the text is drawn with.
- [`@algomotion/tikz`](https://www.npmjs.com/package/@algomotion/tikz) writes the same figures as TikZ for LaTeX.
- [`@algomotion/mcp`](https://www.npmjs.com/package/@algomotion/mcp) has the `algomotion export` command, which writes these figures to files.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

GPL-3.0-or-later. The figures you make are yours. Their text is drawn with outlines of fonts under the SIL Open Font License 1.1, from `@algomotion/fonts`.
