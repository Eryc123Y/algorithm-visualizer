# 0029. Figures place auxiliary structures beside the main one

## Status

Accepted

## Context

The owner's quality bar (requirements, added 2026-11-08) says a figure draws the structures an algorithm keeps besides its main one, such as Dijkstra's priority queue or a call stack, placed so the figure reads well in notes, slides and the player. Roadmap 1.8 builds that. A run of every module's first example on 2026-11-08 found:

| Module                                   | Draws today        | Missing                                                   |
| ---------------------------------------- | ------------------ | --------------------------------------------------------- |
| `dijkstra`, `prim`                       | `g:graph`          | the min-priority queue, each vertex with its key          |
| `kruskal`                                | `g:graph`, `sets`  | the edges in order of weight, with the current one marked |
| `heapsort`, `min-heap.*`, `max-heap.*`   | `array` as a tree  | the array itself, beside the tree and in step with it     |
| `merge-sort`, `quicksort`                | arrays             | the call stack                                            |
| the three tree walks, `topological-sort` | tree or graph, out | the call stack (`dfs` already draws `calls:stack`)        |

Three things stand in the way.

- **Placement.** `layoutState` (`packages/core/src/layout/index.ts`) stacks the structures in one column, in declaration order, each at the left margin. Every output lays out through it: the player, `algoviz export` and the CLI's `render`, the Typst plugin and the TikZ figures of the LaTeX package (all through `layoutTrace`). A second structure under a wide graph makes the figure tall, which wastes a slide: `dfs`'s call stack sits small under its graph today. A note column, on the other hand, is narrow, and there a tall figure is what fits.
- **A priority queue.** No kind holds items ordered by a key. `queue` is first-in, first-out; `array` can hold strings such as `"B 7"`, but then the keys are not data, nothing keeps the order, and a decrease-key is a remove and an insert that the reader has to follow.
- **Two views of one heap.** `array` with `view: "tree"` draws the heap as a tree only. The array, where heapsort's sorted part grows, is not drawn.

## Decision

All of this is protocol version **0.4** (ADR 0021): the `place` field, the `priorityQueue` kind and the `heap` view of `array`. Each is a protocol feature, so a document that uses none of them still says `0.3`. They land in separate pull requests, all before anything is published, under the one version.

### Placement: a `place` per structure, a `layout` per output

**The document says which structures are auxiliary.** Every structure declaration gains an optional `place`:

- `"main"`, the default: the structure is part of the main picture.
- `"side"`: the structure is auxiliary, such as a queue, a stack or a table of results, and goes in the side panel.

**The output says how much room there is.** Layout gains an option, `layout`:

- **`wide`**: the main structures form a column on the left, as today. The side structures form a second column to its right, starting at the top. The second column starts after the widest main structure, plus a gap (`columnGap`, 40 units).
- **`narrow`**: one column: the main structures, then the side structures.
- Within a column, structures keep their declaration order and the gap between them (`structureGap`), as today.
- With no side structure, or no main one, both layouts are the one column of today. Every document of version 0.3 or older is therefore laid out exactly as before.

**Defaults, by output:**

| Output                                                                    | Default  |
| ------------------------------------------------------------------------- | -------- |
| `<algo-player>` (attribute `layout`), and the MCP App and render tool     | `wide`   |
| `algoviz export` and `algoviz render` (`--layout`), and the library calls | `wide`   |
| Typst `algoviz`, `algoviz-series`, `algoviz-figures` (`layout:`)          | `narrow` |
| Typst `algoviz-slides`                                                    | `wide`   |
| LaTeX `\algoviz`, `\algovizfile` (key `layout`)                           | `narrow` |
| LaTeX in the `beamer` class                                               | `wide`   |

`beamerarticle` stays `narrow`: it typesets slides as notes. The Typst engine's cache and the LaTeX package's cache key both include the layout, so a figure drawn wide is never reused as a narrow one.

**One arrangement per series.** The layout is an option of the whole series, like the theme, and the arrangement depends only on the declarations and the layout, never on sizes. Block sizes come from metrics measured over the whole trace (ADR 0008), so the side column starts at the same place in every frame, and a series keeps one canvas and one scale (ADR 0025).

**Kinds may follow their region.** A kind's layout learns its region (`LayoutInput.region`: `"side"` in the side column of a wide figure, `"main"` otherwise). Only the priority queue uses it: a column in the side panel, a row elsewhere. Every other kind draws as today.

**Painters do not change.** Placement moves blocks; the scene items are the same, so the SVG and TikZ painters, the player's animation and the selectors are untouched.

### The priority queue: a new kind, `priorityQueue`

What a student needs to see in Dijkstra and Prim is the set of vertices still in Q, each with its key, in key order, so that EXTRACT-MIN visibly takes the front and DECREASE-KEY visibly moves a vertex forward. Q stays abstract, as in CLRS's text for these algorithms; how a binary heap does it is the heap modules' job.

**Declaration:** `{ "kind": "priorityQueue", "initial": [{ "id", "value", "key" }], "order"?: "min" | "max", "label"?, "place"? }`.

- An **item** is an element (`id`, `value`) with a **key**: a number, or `null` for no key yet. A null key is drawn as ∞ (−∞ in a max-queue) and comes after every number, in either order.
- `order` is `"min"` by default: the least key is at the front. With `"max"` the greatest is.
- **Ties** keep insertion order: of two items with equal keys, the one inserted first is nearer the front, also after a key change. Recipes that break ties by "the vertex listed first" insert in that order.
- In the authoring form an item may leave out `id`, which is then generated (`e0`, `e1`, …), as for every other kind.

**Actions:**

| Action      | Fields           | Effect                                                                                                      |
| ----------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `insert`    | `element`, `key` | Add an item; it takes its place by key. Its id must not have been used in this queue before (ADR 0007).     |
| `extract`   | —                | EXTRACT-MIN or EXTRACT-MAX: remove the front item. The queue must not be empty.                             |
| `setKey`    | `id`, `key`      | DECREASE-KEY or INCREASE-KEY: give the item a new key; it moves to its place, and is highlighted this step. |
| `peek`      | —                | Highlight the front item (this step). The queue must not be empty.                                          |
| `highlight` | `ids`            | Highlight items by id (this step); each must be in the queue.                                               |

Items are named by id, not by position, because positions change with every key change.

**Drawing.** Items in key order, each a cell with its value and, joined to it, a smaller cell with its key. In a row the key cell is under the value and the front is on the left; in a column (the side panel) the key cell is to the right and the front is at the top. A label "min" or "max" marks the front. Cells are keyed by item id, so an item slides to its new place when its key changes. The drawing uses the existing scene items (boxes and text), so painters need nothing new.

**Protocol.** A new kind under ADR 0012 and ADR 0021: schema in `@algoviz/spec`, reducer and layout in `@algoviz/core`, conformance fixtures, the JSON Schema, the MCP guide (`kinds/priorityQueue.md`), and property tests against a model.

### Kruskal's sorted edges: the `table` kind

CLRS sorts the edges once and takes them in order, so the figure shows the whole sorted list with the current edge marked. A `table` already draws it: one row of weights, `w`, with each column labelled by its edge (`C–F`), the current edge highlighted, and every edge taken settled. Edges left of the current one and not settled were skipped; the graph marks them rejected. No new kind is needed.

### Two views of one heap: `view: "heap"`, derived by layout

`array` gains a third view, `"heap"`: the complete binary tree of the `tree` view, with the row of the `row` view under it. Both are drawn from the one array state, with the same marks and pointers, so they cannot disagree. Tree nodes keep the keys of the `tree` view, and row cells get keys of their own, so a swap animates in both. Core stays pure: the reducer is unchanged, and the second view is layout only. The heap recipes and heapsort declare `view: "heap"`; documents that say `"tree"` keep drawing the tree alone.

### Recipes

Each recipe below gains its auxiliary structure, in the side panel unless the table says otherwise. Its steps, step names and anchors stay as they are, so selectors written in notes keep naming the same steps; every step keeps its narration and code anchors in both languages.

| Module                    | Adds, and where                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `dijkstra`, `prim`        | `Q: priorityQueue`, side: every vertex inserted at the start with its key, extracted at `extract`, `setKey` at `improve` or `lighter` |
| `kruskal`                 | `edges: table` of weights, main, under the graph; `sets` moves to the side                                                            |
| `heapsort`, `*-heap.*`    | `view: "heap"`                                                                                                                        |
| `merge-sort`, `quicksort` | `calls: stack`, side: one entry `sort a[p..r]` for each call that records a step                                                      |
| the three tree walks      | `calls: stack`, side: `walk x` for each call on a node                                                                                |
| `topological-sort`        | `calls: stack`, side: `visit u`, as `dfs` has                                                                                         |

**When a call leaves the stack.** A call is pushed in its first step and popped in its last own step when it has one (`merged`, `finish`). A call that ends with no step of its own (quicksort, the tree walks) is popped at the start of the next step, before that step's other actions: each frame shows the calls active during its step. The calls still open after the last step are popped in that step, so the last frame shows the finished run, as it already does for pointers.

**Recursion left without a stack.**

- MAX-HEAPIFY (heapsort and the heap modules) calls itself only as its last act, so it is a loop: the pointer `i` already shows where it is.
- FIND-SET with path compression (`disjoint-set`, `kruskal`): its recursion follows the path to the root, which the forest draws.
- The BST, AVL and trie operations walk one path down the tree, which their pointer shows.

**Placement elsewhere.** The existing auxiliaries move to the side too, as they read better beside the main structure on a slide: `bfs`'s queue, `dfs`'s call stack, `insertion-sort`'s `key`, `balanced-brackets`' stack and `floyd-warshall`'s `dist` table. Arrays that line up with the main one, such as `merge-sort`'s `aux` and `counting-sort`'s `c` and `b`, stay under it.

### Tests

- **Spec:** `place`, the kind and the view validate; their features set the minimum version to `0.4`; `0.3` documents still parse; fixtures valid and invalid.
- **Core:**
  - the reducer of `priorityQueue` against a model of a stable sorted list, with property tests: order, ties, errors on an empty queue and on unknown or repeated ids;
  - placement: both layouts, the region each structure gets, documents without `place` laid out exactly as before, and every structure in the same place in every frame;
  - the scene invariants (unique keys, items inside the scene, a constant size) over new fixtures in both layouts.
- **Recipes:** the queue's contents at each step against an independent Dijkstra and Prim; the edges table against a sorted reference; the stack against the recursion of a reference implementation; property tests on random inputs; every step named and anchored in both languages.
- **Outputs:** the CLI's `--layout`; the player's `layout` attribute (E2E); the Typst and LaTeX defaults and the option, including Beamer's.
- **By eye:** Dijkstra and Prim with the queue, Kruskal with the sorted edges, heapsort with both views and one recursive algorithm with its stack, each in the player, in a Typst note and in a Beamer slide.

### Rejected

- **Choosing the arrangement from sizes** (beside when it fits a target aspect ratio). The choice would depend on the data, so two inputs of one algorithm would look different, and on per-frame sizes, so it would need a measuring pass to stay put in a series.
- **A grid in the document** (`"layout": [["g", "Q"], ["dist"]]`). It fixes one arrangement, so the same document could not suit both a slide and a note column; it also names structures that must then be checked.
- **Placement rules per kind** (stacks always beside). Hidden rules; whether a structure is auxiliary depends on the algorithm, not on its kind.
- **A binary heap as Dijkstra's queue** (`array` with `view: "tree"`). Every sift-up and sift-down becomes a step, which buries the graph algorithm; the heap modules show those steps.
- **An `array` of strings such as `"B 7"`** for the queue, or `"C–F 2"` for Kruskal. The keys would not be data, the recipe would keep the order by hand, and a reader of the document could not tell a queue from a row of labels.
- **Kruskal's edges in a priority queue.** It would drain as edges are taken, losing which ones were taken and skipped, and CLRS sorts once.
- **The recipe writing both views of a heap** (two structures, every action twice). Documents double in size, and hand-written ones can let the views drift apart.
- **A general view of another structure** (`viewOf: "heap"`). ADR 0002 defers references between structures; one more `view` value covers the need.

## Consequences

- Figures of Dijkstra, Prim, Kruskal, the heaps and the recursive procedures show what the algorithm keeps, and the same document draws wide on slides and in the player and narrow in notes.
- **Public interfaces:**
  - protocol 0.4: `place` on every declaration, the `priorityQueue` kind, `view: "heap"`;
  - `LayoutOptions.layout` and `columnGap`, and `LayoutInput.region`;
  - `layout` in the series options of `@algoviz/svg` and `@algoviz/tikz`;
  - `--layout` for `algoviz export` and `render`;
  - the player's `layout` attribute;
  - the Typst functions' `layout:` and the LaTeX key `layout`.
- Recipes write `0.4` once they use any of it, so a copy of the player that reads only `0.3` refuses their documents with the hint to update; nothing is published yet.
- Hand-written and model-written documents get `place` from the guide; nothing places a structure in the side panel on its own.
- Built-in themes (roadmap 1.6) cover the new kind and both layouts.
