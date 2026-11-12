# 0034. Trees get root order, NIL slots, named notes, edge marks and root lists

## Status

Accepted. Corrected while implementing it (#67): a circular root list's closing link is keyed `<tree>/root-wrap`, not `<tree>/root-link/wrap`, which a root with the id `wrap` would also have. Corrected for the Fibonacci heap: its `from` is the forest itself, so a list of keys is a root list of one-node trees in that order rather than keys inserted one by one, and a starting forest may mark a root, since EXTRACT-MIN can leave a marked child as a root, as in CLRS.

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

All of this is protocol version **0.5** (ADR 0021). Each addition is a protocol feature, so a document that uses none of them keeps its older version, and every 0.4 document parses and draws exactly as before, with one exception under S1.

### S1: root order in a forest

- `addNode` with `parent: null` takes `slot`: the new root's position among the roots, a whole number from 0 to their number; `"left"` and `"right"` are refused there. Without it the root goes last, as today.
  - Until now the schema accepted a `slot` on a new root and ignored it. Such a document now counts as using root slots, so it needs `0.5`, and the slot takes effect. This is the one 0.4 document that changes: the field did nothing, so no writer had a reason to set it, and before 1.0 a minor version may do this (ADR 0021). A fixture pins it.
- `detach` takes `slot`: where the node goes among the roots.
  - A node with a parent is cut off and becomes a root there.
  - A root moves there, the others keeping their order. This is how a recipe reorders roots, as the Fibonacci heap's CONSOLIDATE does when it rebuilds the root list.
  - Without `slot`, `detach` behaves as today: a cut subtree goes last, and a root stays where it is.
- `slot` counts the roots without the node being placed, so a root can move to any position from 0 to the number of the other roots.

### S2: a pointer at an empty child slot (NIL)

- A pointer's `node` may also be an empty slot, `{ "parent": "n4", "slot": "left" }`: the NIL leaf there. Only binary trees have such slots, and the slot must be empty when the pointer is set.
- The pointer names the slot, not a node, so it stays while the slot stays empty, also when its parent moves (a rotation, `setChild`, `detach`). It goes, without an error, when an action fills the slot (`addNode`, `setChild`, or a rotation that moves a child into it) or removes its parent, alone or with a subtree, as a pointer at a removed node goes today.
- An empty tree has no slot, so nothing can point at NIL there: RB-INSERT on an empty tree points nowhere until the root exists.
- **Drawing.** The NIL leaf is a small box marked `NIL`, half a column beside its parent on the slot's side and one level down, joined to the parent by a tree edge; its pointer badges sit left of it as at a node. It is drawn plain, not black, so it reads as a marker rather than a node. Its scene keys are `<tree>/nil/<parent>/<slot>` and `<tree>/nil-edge/<parent>/<slot>`.
  - In-order placement gives every node its own column, so a NIL half a column out never meets another node of its tree.
  - Trees of a forest stand half a column apart, so the NIL leaves at the facing ends of two neighbouring trees may be half a column apart on one level. The box is narrower than half a column (at least 28 units), so they never touch.
  - Layout keeps room for the box: a level under the deepest node, and half a column beyond the outermost ones, when any frame of the trace points there. Nodes therefore never move when a pointer goes to NIL and back.
- Only slots with a pointer are drawn. CLRS draws every NIL leaf in one figure (13.1), but that doubles a tree's width, and its other figures leave them out.

### S3: named notes

- `annotate` takes `field`, a short name such as `size`, `max`, `deg` or `mark`: lower-case letters, digits and hyphens, starting with a letter, at most 16 characters.
- A node holds one note per field, and at most four named notes, so its label stays short; a fifth field is refused (`LIMIT_EXCEEDED`). `text: null` removes that field's note; setting it again puts it last.
- Without `field`, `annotate` sets or removes the node's plain note, as today.
- **Drawing.** A node's notes form one label: its plain note first, then its named notes in the order their fields were first set on that node, joined by a spaced middle dot (`h=2 · s=3`). The label is placed as notes are today (ADR 0031). Layout measures the joined label over the trace, so the room it keeps fits the widest one.

### S4: edge marks and edge labels

A tree edge is named by its lower end: the edge to node `n7` is the edge from `n7`'s parent. Two actions, both persisting:

| Action      | Fields          | Effect                                                                                         |
| ----------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `markEdge`  | `node`, `mark`  | `"selected"` (e.g. a search path, a code bit taken), `"rejected"`, or null to clear the mark   |
| `labelEdge` | `node`, `label` | a short label beside the edge (a string of at most 16 characters or a number); null removes it |

- Both refuse a root, which has no edge above it.
- An edge's mark and label go when its lower end gets another parent, or another slot in a binary tree, or becomes a root, or is removed: the edge they were on is gone. A rotation therefore clears the marks of the edges it moves, up to three. Moving a node to the parent and slot it already has keeps them.
- **Drawing.** A marked edge takes the graph's edge style of the mark. A label is placed with the graph's edge labels (ADR 0031), sliding along its edge to clear nodes, notes and other labels. In binary trees it starts on the outer side, as Huffman trees are drawn: on screen, left of an edge to a left child and right of an edge to a right child. The scene's `labelSide` faces along the edge, from parent to child, so that is `"right"` for a left child and `"left"` for a right child. Layout keeps room for the widest label of the trace beyond the outermost nodes, above the roots and below the deepest level.

### S5: root lists

- A tree declaration takes `rootList`: `"list"` or `"circular"`. Without it the roots are not linked, as today.
- **Drawing.**
  - Consecutive roots are joined by an undirected link edge (`<tree>/root-link/<root>`, keyed by the left one) from one root's side to the next one's, at the height of their centres. A doubly linked list has links both ways, so one line stands for both, as in CLRS's figures.
  - `"circular"` adds the link from the last root back to the first (`<tree>/root-link/wrap`): out of the last root's right side, up to a lane at the top of the tree's block, across, and down into the first root's left side. With one root it loops over that root.
  - In a linked forest a pointer at a root sits above it, with an arrow down, so it does not sit on the list; several pointers at one root stack upward. Pointers at other nodes stay on the left. Layout keeps a band for the most pointers at one root over the trace, under the lane.
  - Notes are placed as today, clear of the links, of the pointers above roots and of NIL leaves, which count as obstacles like the notes placed before them (ADR 0031).
- The links follow the roots' order, which is the order drawn from left to right. S1 is how a recipe changes the list: a circular list has no head, so the document's first root is simply where the drawing starts.

### Protocol

- `PROTOCOL_FEATURES` gains `root slots`, `NIL pointers`, `named notes`, `tree edge marks` and `root lists`, each since `0.5`; `PROTOCOL_VERSIONS` gains `0.5`.
- The JSON Schema, the conformance fixtures (valid replays with hand-computed states, invalid documents with their error paths) and the MCP guide (`kinds/tree.md`) follow.
- New error cases: a root `slot` out of range or given as `"left"` or `"right"`; a NIL pointer in a tree that is not binary, at a slot that holds a node, at a slot other than 0 or 1, or under a node that does not exist; a fifth named note on a node; an edge action on a root.

### The modules that use it

Each entry is a module or a structure (ADR 0018, 0019) and meets the quality bar of the requirements. They land one structure per pull request, after the protocol.

**The red–black family** shares one model of a red–black tree whose nodes may carry an augmented field, as CLRS builds the order-statistic and interval trees on the red–black tree. A hook says how a node's field follows from its children; insertion, deletion and rotations keep it current and annotate it.

| Structure              | Operations                           | Field and note     | Starting state `from`                                                              |
| ---------------------- | ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------- |
| `red-black-tree`       | `insert`, `delete`                   | none               | keys in insertion order, or `{ "levelOrder": […], "red": […] }`                    |
| `order-statistic-tree` | `select`, `rank`, `insert`, `delete` | `size`, as `s=5`   | as `red-black-tree`                                                                |
| `interval-tree`        | `search`, `insert`, `delete`         | `max`, as `max=30` | intervals `[low, high]` in insertion order, or `{ "levelOrder": […], "red": […] }` |

- Keys are finite numbers and distinct. Intervals are pairs `[low, high]` of finite numbers with `low ≤ high`, ordered by `low` and then by `high`, so two intervals may share a low endpoint; they are distinct as pairs. Inserting a key the tree holds changes nothing, as in `avl`; deleting or ranking one it does not hold says so.
- Ranks count from 1, as order statistics do: `select 1` finds the least key; `select` outside 1 to the number of keys is refused. `interval-tree.search` takes an interval and finds one that overlaps it, or says none does.
- `after` is the `{ levelOrder, red }` form: the keys (or intervals) in level order with `null` for a gap, as LeetCode writes a tree, and `red` listing the keys (or intervals) of the red nodes, not their positions. It is the module's own input, not a protocol declaration, so it may hold intervals. Colours are part of a red–black tree's state, and keys in insertion order cannot rebuild every tree (no insertion order gives three black nodes), so only this form rebuilds the same tree. It is checked: a starting tree that is out of order, repeats a key or breaks a red–black property is refused, and the error names the node. A tree of 32 keys is at most 10 levels deep, so its level order has at most 1,023 entries, which the schema allows.
- RB-DELETE points `x` at NIL when the node that moves up is NIL (S2); the fixup's cases name their steps (`case-1` to `case-4`, and their mirror images), so a note can show "delete 7 / case-2".

**The Fibonacci heap** (`fibonacci-heap`, topic heaps): `insert`, `union`, `extract-min`, `decrease-key` and `delete`.

- The heap is a forest with a circular root list (S5) and the pointer `min` above its root.
- A marked node has the note `marked` (field `mark`). During CONSOLIDATE each root shows its degree (field `deg`, `d=2`), which its steps compare (S3).
- Insertion and a cut put a tree into the root list just left of `min`: at `min`'s slot, which moves `min` one place right, as CLRS's figures show it.
- EXTRACT-MIN first cuts each child of `z` (the minimum) to a root at `z`'s own place, in order (`detach` with the slots `z`'s index, then the next ones, so `z` ends up right of them), and only then removes `z`, which has no children left.
- CONSOLIDATE draws its array `A` of roots by degree on the side (ADR 0029), and rebuilds the root list in `A`'s order with `detach` and a slot.
- `from` is keys inserted one by one, or a forest in a short notation, `23 7 3(18*(39*) 52 38(41)) 17(30)`: children in brackets, `*` for a marked node. `after` is that notation. A starting forest that breaks heap order, repeats a key or marks a root is refused.
- Keys are finite numbers and distinct, so `decrease-key` and `delete` name a node by its key. `delete` shows the key decreased to −∞ as the string `-∞`, the one node value that is not a number.
- `union` takes the second heap in the same forms, drawn as a second structure, `H2`, from frame 0. Nodes cannot pass between structures, so the union removes `H2`'s trees and adds the same trees to `H`'s root list, node by node, in one step; they fade out of `H2` and into `H` rather than moving. `H2`'s node ids start with `m` and `H`'s with `n`, so the copies keep their ids without colliding. A second union in one run refills the emptied `H2` with fresh ids. A union whose heaps share a key, or whose result would hold more than 32 keys, is refused.
- The recorder declares every structure before the first step, so `defineStructure` gains an optional hook, `auxiliary(from, calls)`, that declares a run's side structures: `A` when a call extracts or deletes, `H2` holding the first union's heap when a call unites. A run with neither draws `H` alone. `A` has a cell for every degree up to D(n) = ⌊log_φ n⌋ for the largest heap the run reaches, which the hook finds by running the calls silently. Operations then get the side structures' handles as a fifth argument of `apply`, and `clear` gets them too.
- Refused calls, each with a RangeError that says why: extracting from an empty heap; `decrease-key` to a key that is not smaller, or that another node holds; `decrease-key` or `delete` of a key the heap does not hold; inserting a key it holds, or into a full heap.

**Huffman codes** (`huffman`, topic trees) is an algorithm, not a structure.

- Its input is the characters' frequencies, `a:45 b:13 c:12 d:16 e:9 f:5` or as an object: at least two characters, each once, with positive finite frequencies.
- The forest is the queue `Q`, its roots in queue order (S1). It starts sorted by frequency, ties in input order, as in CLRS's figure. A merge inserts the new tree at its place by frequency, ties after the trees already there. Leaves show `a:45`, inner nodes their sum, and edges `0` to the left and `1` to the right (S4).
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
- **Public interfaces:**
  - protocol 0.5: `slot` on `addNode` with `parent: null` and on `detach`; a NIL slot as a pointer's `node`; `field` on `annotate`; the `markEdge` and `labelEdge` actions; `rootList` on the declaration. The recorder's tree handle gains them through the spec, with no code of its own;
  - in `@algoviz/recipes`, `StructureDef.auxiliary`, and the side structures' handles as a fifth argument of `Operation.apply` and a second of `StructureDef.clear`;
  - in `@algoviz/core`, the tree state's marks gain `namedNotes`, `edgeMarks` and `edgeLabels`, and a pointer's target may be a NIL slot. The replay fixtures of older tree documents gain the three empty maps.
- Recipes write 0.5 only when they use one of them, so `bst`, `avl` and the tree walks keep writing their older versions.
- The red–black, order-statistic and interval trees share their model, so a fix to a case of the fixup reaches all three.
- The painters and the player are unchanged; their tests cover the new drawings through the scene.
