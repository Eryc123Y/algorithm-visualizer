# @algomotion/spec

The algomotion document format: the Zod schemas and TypeScript types of protocol 1.0, the parser that checks a document and expands its shorthands, and the JSON Schema. Every other algomotion package reads documents through it.

A document declares structures, such as an array or a graph, and a timeline of steps, each applying actions such as `compare` or `swap`. The [document guide](https://algomotion.turing2234.com/guide/documents/) describes the format.

## Install

```sh
npm install @algomotion/spec@alpha
```

## Validate a document

`parseVisualization` takes any value, such as JSON written by a person or a model, and returns `{ ok: true, value }` with the document in canonical form, or `{ ok: false, error }` with a list of diagnostics. It does not throw.

```js
import { formatErrors, parseVisualization } from '@algomotion/spec';

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

const parsed = parseVisualization(doc);
if (parsed.ok)
  console.log(parsed.value.steps.length); // 2
else console.error(formatErrors(parsed.error));
```

Each diagnostic has a stable `code`, a `path` into the input, a `message` and often a `hint`, so that a model can correct its own output:

```js
const bad = parseVisualization({
  ...doc,
  steps: [{ actions: [{ target: 'arr', type: 'push', value: 4 }] }],
});
if (!bad.ok) console.log(formatErrors(bad.error));
// UNKNOWN_ACTION at $.steps[0].actions[0].type: "push" is not an action of array "arr" (hint: Valid actions for array: set, swap, insert, remove, compare, highlight, pointer, settle, align, check.)
```

The parser checks what can be checked without running the document. Whether an action fits the state it meets, such as an index past the end of the array at that step, is checked when [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) replays it.

## JSON Schema

The schema ships with the package, for editors and for other languages:

```js
import schema from '@algomotion/spec/visualization.schema.json' with { type: 'json' };
```

`visualizationJsonSchema()` builds the same schema in code.

## Also here

- `PROTOCOL_VERSION` (`'1.0'`) and `upgradeDocument`. A 1.x version only adds to the protocol, and documents that say a 0.x version are read as 1.0.
- `kinds` and `kindNames`: the eleven structure kinds, from `array` to `plane`, and their actions.
- Share links: `shareLink(base, content)`, `shareFragment` and `readShareFragment` write and read a document, or an algorithm and its input, in the fragment of a player page's address ([ADR 0040](https://github.com/Eryc123Y/algorithm-visualizer/blob/main/docs/adr/0040-share-links.md)).
- Locales: `LOCALES` (`'en'` and `'zh'`) and `localeOf(tag)`, which maps a BCP 47 tag such as `zh-Hans` to one ([ADR 0045](https://github.com/Eryc123Y/algorithm-visualizer/blob/main/docs/adr/0045-chinese-in-the-product.md)). The protocol has no language field: a document is in the language it was written in.
- `ok`, `err` and `Result`, the `{ ok, value }` or `{ ok, error }` form in which the algomotion packages return what can fail.

## Related packages

- [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) replays a document and lays out its frames.
- [`@algomotion/recipes`](https://www.npmjs.com/package/@algomotion/recipes) writes documents: ready-made runs of 132 algorithms, and a typed recorder.
- [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg) and [`@algomotion/elements`](https://www.npmjs.com/package/@algomotion/elements) draw them as figures and in the player.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

GPL-3.0-or-later. The documents you write and the figures made from them are yours.
