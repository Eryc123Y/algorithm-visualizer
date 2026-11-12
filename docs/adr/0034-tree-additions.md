# 0034. Trees get root order, NIL slots, named notes, edge marks and root lists

## Status

Accepted

## Context

Phase 2 of the roadmap covers five entries that the `tree` kind cannot draw today: red–black insert and delete, the order-statistic tree, the interval tree, the Fibonacci heap and Huffman codes. The roadmap's table names what each one needs (S1–S5) and lets one record cover all five. A look at the kind (`packages/spec/src/kinds/tree.ts`, `packages/core/src/kinds/tree.ts`, `layout/tree.ts`) on 2026-11-12 found:

| #   | Need                                                                          | Today                                                                                      |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| S1  | A new root or a cut subtree goes to a chosen place among the roots            | `addNode` with `parent: null` and `detach` always append to `roots`; nothing reorders them |
| S2  | A pointer at an empty child slot: `x` is NIL in RB-DELETE-FIXUP               | `pointer` takes a node id or null                                                          |
| S3  | Several fields per node, such as a size, a max endpoint, a degree and a mark  | `annotate` holds one note per node; a second replaces the first                            |
| S4  | Marks and labels on tree edges: Huffman's 0 and 1, a search path              | tree edges have no actions; their role is always `link`                                    |
| S5  | The Fibonacci heap's root list, a circular list joining the roots of a forest | roots stand side by side, half a column apart, with nothing between them                   |

The scene items already have everything the drawings need: boxes, edges with roles, labels and bend points, badges and arrows. So the painters (SVG, which the player shares, and TikZ) need nothing new; the change is in the protocol, the reducer and the layout.

## Decision

All of this is protocol version **0.5** (ADR 0021). Each addition is a protocol feature, so a document that uses none of them keeps its older version, and every 0.4 document parses and draws exactly as before.

### S1: root order in a forest

- `addNode` with `parent: null` takes `slot`: the new root's position among the roots, from 0 to their number. Without it the root goes last, as today.
- `detach` takes `slot`: where the node goes among the roots.
  - A node with a parent is cut off and becomes a root there.
  - A root moves there, the others keeping their order. This is how a recipe reorders roots, as the Fibonacci heap's CONSOLIDATE does when it rebuilds the root list.
  - Without `slot`, `detach` behaves as today: a cut subtree goes last, and a root stays where it is.
- `slot` counts the roots without the node being placed, so a root can move to any position from 0 to the number of the other roots.

### S2: a pointer at an empty child slot (NIL)

- A pointer's `node` may also be an empty slot, `{ "parent": "n4", "slot": "left" }`: the NIL leaf there. Only binary trees have such slots, and the slot must be empty when the pointer is set.
- The pointer goes when the slot fills or its parent is removed, as a pointer at a removed node goes today.
- **Drawing.** The NIL leaf is a small box marked `NIL`, half a column beside its parent on the slot's side and one level down, joined to the parent by a tree edge; its pointer badges sit left of it as at a node.
  - In-order placement gives every node its own column, so a NIL half a column out never meets another node.
  - Layout keeps room for the box: a level under the deepest node, and half a column beyond the outermost ones, when any frame of the trace points there. Nodes therefore never move when a pointer goes to NIL and back.
- Only slots with a pointer are drawn. CLRS draws every NIL leaf in one figure (13.1), but that doubles a tree's width, and its other figures leave them out.

### S3: named notes

- `annotate` takes `field`, a short name such as `size`, `max`, `deg` or `mark`: lower-case letters, digits and hyphens, starting with a letter, at most 16 characters.
- A node holds one note per field. `text: null` removes that field's note.
- Without `field`, `annotate` sets or removes the node's plain note, as today.
- **Drawing.** A node's notes form one label, in the order their fields were first set on that node, joined by `·`, and placed as notes are today (ADR 0031). Layout measures the joined label over the trace, so the room it keeps fits the widest one.

### S4: edge marks and edge labels

A tree edge is named by its lower end: the edge to node `n7` is the edge from `n7`'s parent. Two actions, both persisting:

| Action      | Fields          | Effect                                                                                         |
| ----------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `markEdge`  | `node`, `mark`  | `"selected"` (e.g. a search path, a code bit taken), `"rejected"`, or null to clear the mark   |
| `labelEdge` | `node`, `label` | a short label beside the edge (a string of at most 16 characters or a number); null removes it |

- Both refuse a root, which has no edge above it.
- An edge's mark and label go when its lower end gets another parent, or another slot in a binary tree, or becomes a root, or is removed: the edge they were on is gone. A rotation therefore clears the marks of the three edges it moves.
- **Drawing.** A marked edge takes the graph's edge style of the mark. A label is placed with the graph's edge labels (ADR 0031), sliding along its edge to clear nodes, notes and other labels. In binary trees it starts on the outer side: left of an edge to a left child, right of an edge to a right child, as Huffman trees are drawn.

### S5: root lists

- A tree declaration takes `rootList`: `"list"` or `"circular"`. Without it the roots are not linked, as today.
- **Drawing.**
  - Consecutive roots are joined by a link edge from one root's side to the next one's, at the height of their centres.
  - `"circular"` adds the link from the last root back to the first: out of the last root's right side, up over the roots, pointers and notes, across, and down into the first root's left side.
  - In a linked forest a pointer at a root sits above it, with an arrow down, so it does not sit on the list. Pointers at other nodes stay on the left. Notes at roots keep clear of those pointers and of the links.
- The links follow the roots' order, so S1 is how a recipe changes the list.

### Protocol

- `PROTOCOL_FEATURES` gains `root slots`, `NIL pointers`, `named notes`, `tree edge marks` and `root lists`, each since `0.5`; `PROTOCOL_VERSIONS` gains `0.5`.
- The JSON Schema, the conformance fixtures (valid replays with hand-computed states, invalid documents with their error paths) and the MCP guide (`kinds/tree.md`) follow.
- New error cases: a root `slot` out of range; a NIL pointer in a tree that is not binary, at a slot that holds a node, or under a node that does not exist; an edge action on a root.

### The modules that use it

Each entry is a module or a structure (ADR 0018, 0019) and meets the quality bar of the requirements. They land one structure per pull request, after the protocol.

**The red–black family** shares one model of a red–black tree whose nodes may carry an augmented field, as CLRS builds the order-statistic and interval trees on the red–black tree. A hook says how a node's field follows from its children; insertion, deletion and rotations keep it current and annotate it.

| Structure              | Operations                           | Field and note     | Starting state `from`                                                              |
| ---------------------- | ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------- |
| `red-black-tree`       | `insert`, `delete`                   | none               | keys in insertion order, or `{ "levelOrder": […], "red": […] }`                    |
| `order-statistic-tree` | `select`, `rank`, `insert`, `delete` | `size`, as `s=5`   | as `red-black-tree`                                                                |
| `interval-tree`        | `search`, `insert`, `delete`         | `max`, as `max=30` | intervals `[low, high]` in insertion order, or `{ "levelOrder": […], "red": […] }` |

- Keys, and intervals, are distinct. Inserting one the tree holds changes nothing, as in `avl`; deleting one it does not hold says so.
- Ranks count from 1, as order statistics do: `select 1` finds the least key. `interval-tree.search` takes an interval and finds one that overlaps it, or says none does.
- `after` is the `{ levelOrder, red }` form. Colours are part of a red–black tree's state, and keys in insertion order cannot rebuild every tree (no insertion order gives three black nodes), so only this form rebuilds the same tree. It is checked: a starting tree that breaks a red–black property is refused, and the error names the node.
- RB-DELETE points `x` at NIL when the node that moves up is NIL (S2); the fixup's cases name their steps (`case-1` to `case-4`, and their mirror images), so a note can show "delete 7 / case-2".

**The Fibonacci heap** (`fibonacci-heap`, topic heaps): `insert`, `union`, `extract-min`, `decrease-key` and `delete`.

- The heap is a forest with a circular root list (S5) and the pointer `min` above its root.
- A marked node has the note `marked` (field `mark`). During CONSOLIDATE each root shows its degree (field `deg`, `d=2`), which its steps compare (S3).
- Insertion, a cut and EXTRACT-MIN's children go into the root list to the left of `min` (S1), as CLRS's figures show it.
- CONSOLIDATE draws its array `A` of roots by degree on the side (ADR 0029), and rebuilds the root list in `A`'s order with `detach` and a slot.
- `from` is keys inserted one by one, or a forest in a short notation, `23 7 3(18*(39*) 52 38(41)) 17(30)`: children in brackets, `*` for a marked node. `after` is that notation.
- Keys are distinct, so `decrease-key` and `delete` name a node by its key. `delete` shows the key decreased to −∞ as `-∞`.
- `union` takes the second heap in the same forms, drawn as a second structure, `H2`, whose trees join `H`'s root list.
- The recorder declares every structure before the first step, so `defineStructure` gains an optional hook that declares a run's side structures from its calls: `A` when a call extracts, `H2` holding the first union's heap when a call unites. Operations get their handles. A run with neither draws `H` alone.

**Huffman codes** (`huffman`, topic trees) is an algorithm, not a structure.

- Its input is the characters' frequencies, `a:45 b:13 c:12 d:16 e:9 f:5` or as an object.
- The forest is the queue `Q`, its roots in queue order (S1): a merge inserts the new tree at its place by frequency, ties after the trees already there. Leaves show `a:45`, inner nodes their sum, and edges `0` to the left and `1` to the right (S4).
- When the tree is done, a table of codewords is filled in beside it, one character per column, following each one's path with `selected` edges.

### Tests

- **Spec:** each addition validates and is refused where it should be; each feature sets the minimum version to `0.5`; 0.4 documents still parse; fixtures valid and invalid.
- **Core:** the reducer against hand-computed states for each action and each case where a mark goes; property tests that run random sequences of the new actions against a model of the forest; the scene invariants (unique keys, items inside the scene, a constant size over a trace) over new fixtures, and checks that nodes keep their place when a pointer goes to NIL and back.
- **Painters:** SVG and TikZ output of a fixture with each addition; `npm run test:typst`, `npm run test:latex` and the E2E tests, which compare the player's drawing with the engine's scene.
- **Modules:** each against an independent reference implementation (red–black properties, sizes and max endpoints recomputed from scratch, the heap order and degrees, codeword lengths against an optimal prefix code), property tests on random inputs, every step named and anchored in both languages, and the per-operation checks of ADR 0018.
- **By eye:** each module in the player and the gallery, in a light and a dark theme.

### Rejected

- **Drawing every NIL leaf**, as an option. A red–black tree with every NIL leaf is twice as wide, which no figure in a note or on a slide can spare; the leaves that matter are the ones a pointer names.
- **NIL as a node with an id.** Recipes would add and remove placeholder nodes around every pointer move, and documents would mix data and markers.
- **A `forest` or `fibonacciHeap` kind.** The tree kind already keeps a forest valid through every action; a second kind would copy its reducer and layout to add a list between roots.
- **The root list as a `linkedList` beside the forest.** Links between structures wait for ADR 0002's references, and two structures could disagree.
- **Notes stacked as separate labels.** Painters and note placement would change for every kind that draws nodes, while the entries need at most two short fields per node, which one label holds.
- **Pointers at roots on the left in a linked forest.** The badges would sit on the links between roots, reading as members of the list.
- **Edges named by their two ends.** A tree node has one parent, so its id names the edge, and the name stays valid when the parent's other children change.

## Consequences

- The five entries can be drawn as CLRS draws them, and every 0.4 document is unchanged.
- **Public interfaces:** protocol 0.5: `slot` on `addNode` with `parent: null` and on `detach`; a NIL slot as a pointer's `node`; `field` on `annotate`; the `markEdge` and `labelEdge` actions; `rootList` on the declaration. The recorder's tree handle gains them through the spec, with no code of its own.
- Recipes write 0.5 only when they use one of them, so `bst`, `avl` and the tree walks keep writing their older versions.
- The red–black, order-statistic and interval trees share their model, so a fix to a case of the fixup reaches all three.
- The painters and the player are unchanged; their tests cover the new drawings through the scene.
