# algoviz (working name)

An AI-native library for step-by-step visualizations of algorithms and data structures, for developers and teachers.

A visualization is a declarative JSON document: the structures involved and a timeline of steps, each applying actions such as `compare` or `swap`. People write it with code, LLMs write it directly, and the library validates it and renders it as an interactive player, a static image, or a figure in Typst or LaTeX.

> Status: early development. Eight structure kinds work end to end (protocol, timeline engine, layout, static SVG and an interactive player), with ready-made visualizations of the classic undergraduate algorithms, and an MCP server through which models write, check and render documents.

```json
{
  "version": "0.1",
  "structures": { "arr": { "kind": "array", "initial": [5, 3, 8, 1] } },
  "steps": [
    {
      "actions": [{ "target": "arr", "type": "compare", "i": 0, "j": 1 }],
      "meta": { "line": 3, "narration": "Compare 5 and 3." }
    },
    {
      "actions": [{ "target": "arr", "type": "swap", "i": 0, "j": 1 }],
      "meta": { "line": 4, "narration": "5 > 3, so swap them." }
    }
  ]
}
```

## Structures

| Kind         | For                                                        | Notable actions                                              |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `array`      | sorting, searching, two pointers; `view: "tree"` for heaps | `compare` `swap` `set` `insert` `remove` `pointer` `settle`  |
| `stack`      | call stacks, bracket matching, DFS                         | `push` `pop` `peek`                                          |
| `queue`      | BFS, schedulers; also a deque                              | `enqueue` `dequeue` `pushFront` `popBack` `peek`             |
| `linkedList` | singly, doubly and circular lists                          | `insert` `remove` `link` `pointer` `visit`                   |
| `tree`       | BST, AVL, red–black, tries, recursion trees, union–find    | `addNode` `setChild` `rotate` `setColor` `annotate` `visit`  |
| `graph`      | traversals, shortest paths, spanning trees, flows          | `addEdge` `setWeight` `markEdge` `annotate` `visit` `settle` |
| `table`      | dynamic programming, adjacency matrices                    | `set` `depend` `highlight` `settle`                          |
| `hashTable`  | separate chaining                                          | `insert` `remove` `highlight` `settle`                       |

Shorthands keep documents short: `"initial": [5, 3, 8]` generates element ids, a tree can be given in LeetCode `levelOrder`, and a graph as `"nodes": ["A", "B"]` with `"edges": [["A", "B", 4]]`. The JSON Schema is in [`packages/spec/schema`](packages/spec/schema).

## Recipes

`@algoviz/recipes` holds ready-made visualizations of classic algorithms and data structures, and a typed recorder for producing documents from running code.

Every algorithm, and every operation of a data structure, is a module of one registry ([ADR 0019](docs/adr/0019-algorithm-registry.md)) with a stable id, a Zod input schema, examples, and its code in pseudocode and Python. `runAlgorithm(id, input)` checks the input, records the run and validates the document:

```ts
import { runAlgorithm, Recorder } from '@algoviz/recipes';

// Delete 3 from the tree that inserting these keys builds.
const run = runAlgorithm('bst.delete', { from: [8, 3, 10, 1, 6], key: 3 });
if (run.ok) console.log(run.value.document, run.value.after);
else console.error(run.error); // e.g. INVALID_SHAPE at $.input.key

// Or record your own: every handle method is typed from the protocol.
const r = new Recorder({ title: 'Swap' });
const a = r.add('a', { kind: 'array', initial: [2, 1] });
r.step('Swap the two values.');
a.swap({ i: 0, j: 1 });
const mine = r.build();
```

The registry holds these modules, by topic ([ADR 0022](docs/adr/0022-registry-details.md), [ADR 0023](docs/adr/0023-remaining-modules.md)). They follow the procedures of CLRS where CLRS has them.

- **Sorting:** `insertion-sort`, `merge-sort`, `heapsort`, `quicksort`, `counting-sort`, `bubble-sort`, `selection-sort`.
- **Searching:** `binary-search`.
- **Lists:** `reverse-linked-list`, `balanced-brackets`.
- **Trees:** `bst` (search, insert, delete), `avl` (insert), `inorder-tree-walk`, `preorder-tree-walk`, `postorder-tree-walk`, `trie` (insert, search), `disjoint-set` (union, find-set).
- **Heaps:** `min-heap` (push, pop, decrease-key), `max-heap` (push, pop, increase-key).
- **Hashing:** `hash-chaining` and `linear-probing`, each with insert and search.
- **Graphs:** `bfs`, `dfs`, `topological-sort`, `dijkstra`, `bellman-ford`, `prim`, `kruskal`, `floyd-warshall`.
- **Dynamic programming:** `lcs`, `edit-distance`, `knapsack`.

A data structure has one module per operation, such as `bst.delete`, which starts from a structure the caller describes, and one for its sequence, such as `bst`, which runs up to 8 operations. `algorithms` lists every module.

MCP, the `algoviz` command line and the playground's example menu read the registry, grouped by topic.

## For models

[`@algoviz/mcp`](packages/mcp) lets a model write documents: it reads a guide written for models, validates its document (every step is replayed, and each error says where and why), inspects the state at any frame to check the result, and renders frames to SVG. In clients that display MCP Apps, `algoviz_show` then opens the interactive player right in the conversation. The same tools work as the `algoviz` command line. [`evals/`](evals) measures how well models do on 28 undergraduate tasks, each checked for what a correct visualization must show.

## Embedding

Build the standalone bundle with `npm run build -w @algoviz/elements`, then:

```html
<script type="module" src="algoviz-player.js"></script>

<algo-player theme="auto">
  <script type="application/json">
    { "version": "0.1", "structures": { … }, "steps": [ … ] }
  </script>
</algo-player>
```

Attributes: `src`, `frame`, `theme` (`auto` · `light` · `dark` · `print`), `speed` (ms per step), `autoplay`, `loop`, `hide-controls`, `hide-code`, `language`. Style the chrome with CSS custom properties such as `--algo-accent`, or pass a full scene theme as the `customTheme` property.

`frame` takes a frame number or a selector that names a step by meaning, so a link or a page keeps showing the same step when a document gains steps elsewhere: `frame="relax#3"` (the third step named `relax`), `frame="insert-5/fixup-case-3"` (counting inside section `insert-5`), `frame="insert-5"` (that section, from its first step) or `frame="-1"` (the last frame). Documents give steps names with `meta.id` and group them into `sections` ([ADR 0020](docs/adr/0020-step-names-and-sections.md)); the timeline shows the sections, and Page Up and Page Down move between them. Page scripts read `player.stepName` and `player.section` (the section's id, title and start), and the `algo-frame` event carries `stepName` and `sectionId`. The `frame` property reads back as a number once the document has loaded.

A document can give its code in several languages, such as pseudocode in the conventions of CLRS and Python, with steps pointing at an anchor in each (`sources` and `meta.at`, [ADR 0017](docs/adr/0017-multi-language-source.md)). The player then shows a language switcher above the code and keeps the frame when the reader switches. Pseudocode comes first unless `language="python"` asks for another. Once a reader picks a language, that choice wins over both. It is remembered for the site when the browser allows local storage, and otherwise for the page, and every player follows it, also in other tabs. `player.currentLanguage` says which language is on show. The BST and heap operations come in both languages.

For a purely visual animation without any teaching chrome, use display mode: it shows only the structures, plays and loops by itself, and pauses while off screen.

```html
<algo-player mode="display" speed="700" src="bubble-sort.json"></algo-player>
```

Display mode also accepts `once` (play a single time) and `motion` (`linear` · `arc`).

## Packages

| Package                                  | Status    | Purpose                                                           |
| ---------------------------------------- | --------- | ----------------------------------------------------------------- |
| [`@algoviz/spec`](packages/spec)         | Available | Protocol schemas, types, validation and JSON Schema               |
| [`@algoviz/fonts`](packages/fonts)       | Available | Metrics and outlines of the bundled fonts, and text measurement   |
| [`@algoviz/core`](packages/core)         | Available | Structure kinds, reducers, timeline engine and layout to scenes   |
| [`@algoviz/svg`](packages/svg)           | Available | Standalone SVG with text as glyph outlines (no DOM needed)        |
| [`@algoviz/elements`](packages/elements) | Available | `<algo-player>`: interactive, animated player (Lit Web Component) |
| [`@algoviz/recipes`](packages/recipes)   | Available | Typed recorder and visualizations of classic algorithms           |
| [`@algoviz/mcp`](packages/mcp)           | Available | MCP server, MCP App and CLI: guide, validation, inspection, SVG   |

## Design

What version 1.0 must do is in [`docs/requirements.md`](docs/requirements.md), and the order of work in [`docs/roadmap.md`](docs/roadmap.md).

The architecture is documented as decision records in [`docs/adr/`](docs/adr). In short: traces are event-sourced (actions are the source of truth and states are derived by pure reducers), layout is a pure function so the same visualization can be rendered anywhere, and every document is validated before rendering with errors an LLM can act on.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
