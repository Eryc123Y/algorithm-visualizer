# @algomotion/elements

`<algo-player>`, the interactive algomotion player, as a Lit web component. It runs an algorithm on your input, or plays a document, step by step: the structures animate, each step's narration and line of code show beside them, and the reader can play, pause and step. The package also holds the standalone bundle for pages without a bundler.

## Install

```sh
npm install @algomotion/elements@alpha
```

Register the element once:

```js
import '@algomotion/elements/define';
```

Then name an algorithm and give its input:

```html
<algo-player
  algorithm="dijkstra"
  input="A-B 4, B-C 1, A-C 7, C-D 2"
  frame="improve#3"
></algo-player>
```

The player imports the algorithm registry, `@algomotion/recipes`, the first time a player has `algorithm`, so a bundler can split it off; a page that shows only documents never loads it.

## From a CDN

Without a bundler, load the standalone bundle, which includes Lit and every algomotion package it needs, from a CDN that serves npm packages:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@algomotion/elements@alpha/dist/cdn/algomotion-player.js"
></script>

<algo-player algorithm="insertion-sort" input="5 2 4 6 1 3"></algo-player>
```

Put an exact version in place of `alpha`, such as `1.0.0-alpha.1`, to pin it. To host the bundle yourself, copy `dist/cdn/` from the package and keep its files together under their names: `algomotion-player.js`, `algomotion-recipes.js` (the registry, loaded the first time a player has `algorithm`) and the `fonts/` folder.

## Attributes

- `algorithm` and `input`: a registry id and its input, in notation or JSON. Without `input`, the algorithm runs on its first example.
- `src`, or an inline `<script type="application/json">`: a document, or the input when `algorithm` is set. The `visualization` property takes a document object.
- `frame`: the frame to open at, a number or a selector such as `relax#3`, `insert-5` or `-1`.
- `theme`: a built-in theme such as `textbook`, `auto` (light or dark by the reader's colour scheme), or a day and a night theme, `"textbook textbook-dark"`.
- `layout` (`wide` or `narrow`), `speed`, `autoplay`, `loop`, `hide-controls`, `hide-code`, `language` (such as `python`), and `mode="display"` for an animation without controls.
- `lang`, inherited like any `lang`, so `<html lang="zh-Hans">` is enough: with a Chinese tag, the controls are in Simplified Chinese and an algorithm's run is recorded in Chinese. A document's own text shows as written.

The player fires `algo-load`, `algo-frame` (with `index`, `stepName` and `sectionId`) and `algo-error` (with the diagnostics). The [web guide](https://algomotion.turing2234.com/guide/web/) lists every attribute, property, event and CSS custom property.

## With a bundler

The player links the themes' web fonts from `fonts/fonts.css` next to its module, the first time a player shows. A bundler moves the module away from that folder, so import the stylesheet with the bundler instead and turn the link off before the first player connects:

```js
import { AlgoPlayer } from '@algomotion/elements';
import '@algomotion/elements/fonts.css';

AlgoPlayer.fontsUrl = null;
customElements.define('algo-player', AlgoPlayer);
```

Or copy `dist/fonts/` to your site and set `AlgoPlayer.fontsUrl` to its `fonts.css`. With `null` and no stylesheet, text falls back to similar fonts installed on the reader's system.

## Related packages

- [`@algomotion/recipes`](https://www.npmjs.com/package/@algomotion/recipes): the 132 algorithms that `algorithm` names.
- [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) replays documents and lays out the scenes the player animates.
- [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg): the same frames as static figures, and `createTheme` for the player's `customTheme` property.
- [`@algomotion/mcp`](https://www.npmjs.com/package/@algomotion/mcp) shows this player inside AI conversations.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

GPL-3.0-or-later. The web fonts in `dist/fonts/` and `dist/cdn/fonts/` keep their own licence, the SIL Open Font License 1.1, which `OFL.txt` beside them reproduces.
