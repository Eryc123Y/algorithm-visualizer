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

`@algoviz/recipes` has a typed recorder for producing documents from running code, and ready-made visualizations of 29 algorithms: seven sorts, binary search, list reversal, bracket matching, BST, AVL, traversals, binary heap, trie, union–find, BFS, DFS, Dijkstra, Bellman–Ford, Prim, Kruskal, topological sort, Floyd–Warshall, LCS, edit distance, 0/1 knapsack and two hashing schemes.

```ts
import { dijkstra, Recorder } from '@algoviz/recipes';

const doc = dijkstra(
  {
    nodes: ['A', 'B', 'C'],
    edges: [
      ['A', 'B', 4],
      ['B', 'C', 1],
      ['A', 'C', 7],
    ],
  },
  'A',
);

// Or record your own: every handle method is typed from the protocol.
const r = new Recorder({ title: 'Swap' });
const a = r.add('a', { kind: 'array', initial: [2, 1] });
r.step('Swap the two values.');
a.swap({ i: 0, j: 1 });
const mine = r.build();
```

The playground's example menu shows every recipe.

## For models

[`@algoviz/mcp`](packages/mcp) lets a model write documents: it reads a guide written for models, validates its document (every step is replayed, and each error says where and why), inspects the state at any frame to check the result, and renders frames to SVG. In clients that display MCP Apps, `algoviz_show` then opens the interactive player right in the conversation. The same tools work as the `algoviz` command line. [`evals/`](evals) measures how well models do on 27 undergraduate tasks, each checked for what a correct visualization must show.

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

Attributes: `src`, `frame`, `theme` (`auto` · `light` · `dark` · `print`), `speed` (ms per step), `autoplay`, `loop`, `hide-controls`, `hide-code`. Style the chrome with CSS custom properties such as `--algo-accent`, or pass a full scene theme as the `customTheme` property.

For a purely visual animation without any teaching chrome, use display mode: it shows only the structures, plays and loops by itself, and pauses while off screen.

```html
<algo-player mode="display" speed="700" src="bubble-sort.json"></algo-player>
```

Display mode also accepts `once` (play a single time) and `motion` (`linear` · `arc`).

## Packages

| Package                                  | Status    | Purpose                                                           |
| ---------------------------------------- | --------- | ----------------------------------------------------------------- |
| [`@algoviz/spec`](packages/spec)         | Available | Protocol schemas, types, validation and JSON Schema               |
| [`@algoviz/core`](packages/core)         | Available | Structure kinds, reducers, timeline engine and layout to scenes   |
| [`@algoviz/svg`](packages/svg)           | Available | Renders scenes to standalone SVG (no DOM needed)                  |
| [`@algoviz/elements`](packages/elements) | Available | `<algo-player>`: interactive, animated player (Lit Web Component) |
| [`@algoviz/recipes`](packages/recipes)   | Available | Typed recorder and visualizations of classic algorithms           |
| [`@algoviz/mcp`](packages/mcp)           | Available | MCP server, MCP App and CLI: guide, validation, inspection, SVG   |

## Design

What version 1.0 must do is in [`docs/requirements.md`](docs/requirements.md), and the order of work in [`docs/roadmap.md`](docs/roadmap.md).

The architecture is documented as decision records in [`docs/adr/`](docs/adr). In short: traces are event-sourced (actions are the source of truth and states are derived by pure reducers), layout is a pure function so the same visualization can be rendered anywhere, and every document is validated before rendering with errors an LLM can act on.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
