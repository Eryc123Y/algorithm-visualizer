# @algomotion/tikz

The TikZ painter of algomotion: it writes the figures of [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg) as TikZ for the algomotion LaTeX package, with the same shapes, colours, positions and size, and leaves the text to the fonts of the LaTeX document. `algomotion export --format tikz` and the LaTeX package's `\algomotion` command are built on it.

The output is not standalone TikZ. It calls macros of the LaTeX package, and a document draws it with `\algomotioninput`.

## Install

```sh
npm install @algomotion/tikz
```

## Write a figure

`exportTikzFigures(document, options)` returns `{ ok: true, value }`, where `value.figures` holds one figure per frame with its `frame`, `selector`, `width`, `height`, `narration` and `tikz`; or `{ ok: false, error }` with diagnostics.

```js
import { writeFileSync } from 'node:fs';

import { exportTikzFigures } from '@algomotion/tikz';

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

const result = exportTikzFigures(doc, { steps: ['swap'], theme: 'textbook' });
if (!result.ok) throw new Error(result.error[0].message);
const [figure] = result.value.figures;
writeFileSync('swap.tex', figure.tikz);
console.log(figure.frame, figure.selector); // 2 swap
```

Then, in LaTeX:

```latex
\documentclass{article}
\usepackage{algomotion}
\begin{document}
\algomotioninput{swap.tex}
\end{document}
```

The LaTeX package is not on CTAN yet; the [LaTeX guide](https://algomotion.turing2234.com/guide/latex/) says how to install it from the repository or the GitHub release.

The options are those of `exportFigures` in `@algomotion/svg`: `steps` (selectors or frame numbers), `theme`, `layout` (`wide` or `narrow`) and `locale` (`en` or `zh`, for the words the layout draws itself, such as "(empty)"). Each theme names the TeX family its text is set in: serif for the textbook themes, sans serif for blocks, typewriter for Turbo C.

`prepareTikzFigures(document, options)` loads a document once and draws any frame with `figure(selector)`, or a series with `figures(selectors)`. `renderTikz(scene, { theme })` writes a single scene from `@algomotion/core`.

## Related packages

- [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg) decides every shape and position; this package writes them as TikZ.
- [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) replays documents and lays out their frames.
- [`@algomotion/mcp`](https://www.npmjs.com/package/@algomotion/mcp) has the `algomotion` command, which the LaTeX package runs to make figures.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

GPL-3.0-or-later. The figures you make are yours.
