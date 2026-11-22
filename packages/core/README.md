# @algomotion/core

The algomotion engine: the structure kinds and their reducers, the timeline that replays a document into frames, frame selectors, and the layout that turns a frame into a scene. Layout is a pure function with no DOM, so the player, the SVG painter and the TikZ painter all draw the same scenes.

## Install

```sh
npm install @algomotion/core@alpha
```

The layout's `locale` option, and with it everything in Chinese, came after `1.0.0-alpha.1`, so it needs a later version, or this repository's sources.

## Replay a document

`loadTrace` parses a document with [`@algomotion/spec`](https://www.npmjs.com/package/@algomotion/spec), then replays every step and checks each action against the state it meets. It returns `{ ok: true, value }` with a trace, or `{ ok: false, error }` with diagnostics. Frame 0 is the initial state, and frame `n` the state after step `n`.

```js
import { layoutTrace, loadTrace, selectFrame } from '@algomotion/core';

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

const loaded = loadTrace(doc);
if (!loaded.ok) throw new Error(loaded.error[0].message);
const trace = loaded.value;

// A selector names a frame by its step, so it survives edits elsewhere.
const frame = selectFrame(trace.visualization, 'swap');
if (frame.ok) {
  const { state, step } = trace.frame(frame.value);
  console.log(frame.value, step.meta.narration); // 2 5 > 3, so swap them.
  console.log(state.arr.state.data.map((cell) => cell.value)); // [ 3, 5, 8, 1 ]
}

// One layout for the whole trace, so sizes do not jump between frames.
const scene = layoutTrace(trace).sceneAt(2);
console.log(scene.width, scene.height); // 272 112
```

Errors that depend on the state come from the replay, in the same form as the parser's:

```js
const late = loadTrace({
  ...doc,
  steps: [{ actions: [{ target: 'arr', type: 'swap', i: 0, j: 9 }] }],
});
if (!late.ok) console.log(late.error[0].code, late.error[0].path);
// OUT_OF_RANGE $.steps[0].actions[0].j
```

## Selectors and layout

A selector is a frame number (`-1` is the last), a step name (`relax#3` is the third step named `relax`), a step in a section (`insert-5/relax`), a section (`insert-5`) or a range (`a..b`). `selectFrame`, `selectFrames`, `selectSeries`, `selectorOf`, `stepNameAt` and `sectionAt` read them.

A scene is a list of items (boxes, nodes, edges, text, badges and arrows) with semantic roles instead of colours, and stable keys that a painter can animate between frames. `layoutTrace(trace, options)` takes:

- `layout`: `'wide'` (the default) puts side structures, such as Dijkstra's priority queue, beside the main one; `'narrow'` puts them below, for a column of notes.
- `fonts`: the metrics text is measured with, from [`@algomotion/fonts`](https://www.npmjs.com/package/@algomotion/fonts).
- `locale`: `'en'` (the default) or `'zh'`, for the few words the layout draws itself, such as "(empty)" and "top". A document's own text is drawn as written.

## Related packages

- [`@algomotion/spec`](https://www.npmjs.com/package/@algomotion/spec): the document format and its parser.
- [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg) and [`@algomotion/tikz`](https://www.npmjs.com/package/@algomotion/tikz) paint scenes as SVG and TikZ figures.
- [`@algomotion/elements`](https://www.npmjs.com/package/@algomotion/elements): the player, which animates from one scene to the next.
- [`@algomotion/recipes`](https://www.npmjs.com/package/@algomotion/recipes) writes documents for 132 algorithms.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

GPL-3.0-or-later.
