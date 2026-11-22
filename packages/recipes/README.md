# @algomotion/recipes

The algorithm registry of algomotion: 132 modules, one for each algorithm and each operation of a data structure, with a stable id, a Zod input schema, examples, and code in pseudocode and Python. Running a module records its run as a document. The package also has `Recorder`, a typed recorder for documents of your own.

## Install

```sh
npm install @algomotion/recipes@alpha
```

## Run an algorithm

`runAlgorithm(id, input, options)` checks the input, records the run and replays the document through the engine. It returns `{ ok: true, value }`, where `value` has the `document`, the operations' `results` and, for a data structure, its final state as `after`; or `{ ok: false, error }` with diagnostics.

```js
import { runAlgorithm } from '@algomotion/recipes';

// Delete 3 from the tree that inserting these keys builds.
const run = runAlgorithm('bst.delete', { from: [8, 3, 10, 1, 6], key: 3 });
if (!run.ok) throw new Error(run.error[0].message);
console.log(run.value.document.steps.length); // 5
console.log(run.value.after); // [ 8, 6, 1, 10 ]: the tree after the deletion, as a `from`
```

An input is a value of the module's schema, such as the object above, in which a list, a graph or a list of operations may be written in the notation people write on paper: `5 2 4 6 1 3`, `A-B 4, B-C 1` (`->` for a directed edge) or `insert 4, delete 3`. A module that needs one thing takes that thing alone, such as a graph for `dijkstra`, and without an input runs on its first example. `readInput(text)` reads text as the command line and the player do: JSON, a JSON object without its outer braces, or a notation. The [inputs guide](https://algomotion.turing2234.com/guide/inputs/) has every form. An input that does not fit says where:

```js
const bad = runAlgorithm('dijkstra', 'A-B 4, B-C x');
if (!bad.ok) console.log(bad.error[0].code, bad.error[0].message);
// INVALID_NOTATION Expected a weight or "," after "B-C", not "x" (character 12)
```

An unknown id is `UNKNOWN_ALGORITHM` at `$.id`, and an input the module cannot show, such as a pop from an empty heap, is `INVALID_ARGUMENT`.

## In Simplified Chinese

`{ locale: 'zh' }` records the run in Simplified Chinese: its title, narration, section titles and labels. Step names, selectors, code and diagnostics stay as they are, so `improve#3` names the same step in both languages. Every module is translated.

```js
const zh = runAlgorithm('dijkstra', 'A-B 4, B-C 1, A-C 7, C-D 2', {
  locale: 'zh',
});
if (zh.ok) console.log(zh.value.document.title); // Dijkstra 算法
```

## The registry

`algorithms` lists every module, and `findAlgorithm(id)` finds one. Each has an `id`, `title`, `topic`, `summary`, `input` (its Zod schema), `examples` and `code`; `titleOf(module, locale)` and `summaryOf(module, locale)` give the title and summary in a locale. A data structure has one module per operation, such as `bst.delete`, whose input is the starting structure `from` and the operation's arguments, and one for a sequence, such as `bst`, which runs up to 8 operations. The [catalogue](https://algomotion.turing2234.com/algorithms/) shows every module with its input and the names of its steps.

## Record your own

```js
import { Recorder } from '@algomotion/recipes';

const r = new Recorder({ title: 'Swap' });
const a = r.add('a', { kind: 'array', initial: [2, 1] });
r.step('Swap the two values.');
a.swap({ i: 0, j: 1 });
const doc = r.build();
```

Every handle has one method per action of its structure's kind, typed from the protocol. `r.step({ id: 'swap', narration: '…' })` names a step, and `r.section(id, title)` starts a section. `build()` checks the document against the protocol and throws a `RangeError` if it cannot be shown.

## Related packages

- [`@algomotion/spec`](https://www.npmjs.com/package/@algomotion/spec): the document format that runs are recorded in.
- [`@algomotion/core`](https://www.npmjs.com/package/@algomotion/core) replays the documents; `runAlgorithm` uses it to check every run.
- [`@algomotion/svg`](https://www.npmjs.com/package/@algomotion/svg) draws a run's steps as figures, and [`@algomotion/elements`](https://www.npmjs.com/package/@algomotion/elements) plays it in a page.
- [`@algomotion/mcp`](https://www.npmjs.com/package/@algomotion/mcp) serves the registry to AI assistants and as the `algomotion` command.

Website and guide: <https://algomotion.turing2234.com>, <https://algomotion.turing2234.com/guide/>. Source, issues and design records: <https://github.com/Eryc123Y/algorithm-visualizer>.

## Licence

GPL-3.0-or-later. The documents and figures you make with it are yours.
