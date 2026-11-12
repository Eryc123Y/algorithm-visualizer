# 0035. B-trees get a kind of their own, with keys that move between nodes

## Status

Accepted

## Context

Phase 2 covers CLRS's chapter on B-trees: search, insert and delete (roadmap S6). A B-tree node holds several keys in order and has one more child than keys; insertion splits full nodes on the way down, and deletion merges nodes and moves keys between siblings through their parent.

The `tree` kind cannot draw this.

- A tree node has one value, so a B-tree node would be one string, `"C G M"`. Its keys would not be data: a split could not show a key rising into the parent, and a search could not mark the key it compares.
- Tree edges join node centres. In a B-tree the child between two keys hangs from the gap between them, which is how a reader sees which keys bound a subtree.
- Splits, merges and moves through the parent would each be several `tree` actions that leave the drawing wrong in between, as ADR 0034 found for red–black deletion.

## Decision

A new kind, `btree`, in protocol version **0.6** (ADR 0021): a feature `B-trees`, used by any document with such a structure.

### The structure

- A **node** has an `id`, its **keys** in order, and its **children**: none for a leaf, or one more than its keys.
- A **key** is an element (ADR 0007): an `id` and a `value`. Key ids and node ids share the structure's ids, and a key keeps its id when it moves to another node, so a drawing can follow it.
- One node is the **root**; every other node is a child of exactly one node. A tree with no nodes is empty.
- The kind does not enforce a minimum degree: it draws any multiway search tree, such as a 2-3-4 tree or a B-tree for any `t`, and it does not check that keys are in order. The modules keep those rules. A node holds at most 32 keys.
- A node with no keys is allowed for two moments CLRS has: a new root before it receives its first key (B-TREE-SPLIT-ROOT), and the root of an empty tree.

**Declaration:** `{ "kind": "btree", "nodes": [{ "id", "keys": [ { "id", "value" } | value, … ], "children"?: [ids] }], "root"?: id, "label"?, "place"? }`. A bare value gets a generated id (`e0`, `e1`, …), as elsewhere. `root` defaults to the one node that is nobody's child.

### Actions

Each action keeps the tree valid: every node has no children or one more than its keys.

| Action      | Fields                       | Effect                                                                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insertKey` | `node`, `index`, `key`       | Insert a key into a leaf at position `index`, from 0 to its number of keys.                                                                                                                                                                                                                              |
| `removeKey` | `key`                        | Remove a key from the leaf that holds it.                                                                                                                                                                                                                                                                |
| `setKey`    | `key`, `value`               | Change a key's value, as deletion does when it puts a predecessor's key in place of the one deleted.                                                                                                                                                                                                     |
| `split`     | `node`, `index`, `newNode`   | Split the child at `index` of `node` around its middle key: the middle key rises into `node` at `index`, the keys and children right of it go to `newNode`, which becomes child `index + 1`. The child needs at least 3 keys.                                                                            |
| `grow`      | `newRoot`                    | Put a new root with no keys above the root; its one child is the old root. A `split` of that child follows.                                                                                                                                                                                              |
| `merge`     | `node`, `index`              | Merge child `index` of `node`, the key at `index` and child `index + 1` into child `index`; child `index + 1` goes.                                                                                                                                                                                      |
| `shrink`    | —                            | The root has no keys and one child: the child becomes the root.                                                                                                                                                                                                                                          |
| `rotate`    | `node`, `index`, `direction` | Move a key through `node` between the children on either side of its key `index`. `"left"`: the first key of child `index + 1` rises to `index` and the key there falls to the end of child `index`, with the first child of child `index + 1` moving to the end of child `index`. `"right"` mirrors it. |
| `highlight` | `keys`?, `nodes`?            | Highlight keys and nodes (this step).                                                                                                                                                                                                                                                                    |
| `settle`    | `key`                        | Mark a key as found (persists).                                                                                                                                                                                                                                                                          |
| `pointer`   | `name`, `node`               | A named pointer at a node; null removes it.                                                                                                                                                                                                                                                              |
| `annotate`  | `node`, `text`               | A short note above a node; null removes it.                                                                                                                                                                                                                                                              |

- The middle key of a child with `k` keys is the one at index `⌊k/2⌋` when `k` is odd, as CLRS's full nodes are (`2t − 1` keys), and at `k/2 − 1` when even, so the left half is never smaller.
- Errors name the field: a key or node that does not exist, an index out of range, `insertKey` or `removeKey` on a node with children, `split` of a child with fewer than 3 keys, `merge` whose result would hold more than 32 keys, `rotate` from a child with no key to give, `shrink` of a root that has keys or not one child, a `newNode` or `newRoot` id already used.

### Drawing

```
              ┌───┬───┐
              │ G │ M │
              └───┴───┘
             ╱    │    ╲
   ┌───┬───┐ ┌───┬───┐ ┌───┬───┐
   │ A │ C │ │ H │ K │ │ N │ R │
   └───┴───┘ └───┴───┘ └───┴───┘
```

- A node is a row of key cells side by side, one box per key, keyed by the key's id (`<tree>/key/<key>`), so a key slides to its new place in a split, a merge or a rotation. A node with no keys is one empty cell (`<tree>/empty/<node>`).
- Child `i` hangs from the gap left of key `i`: its edge starts at the bottom of that gap (the node's left or right end for the first and last child) and ends at the top of the child's middle (`<tree>/edge/<child>`).
- Leaves stand side by side, a gap apart, and each parent is centred over its children, as the `tree` kind places a forest. Levels are a fixed distance apart.
- Pointers sit left of their node, as in `tree`; notes go above it. Marks colour the key cells as in `array`.
- Layout measures the widest frame of the trace, so the canvas stays one size (ADR 0008, 0025); nodes move as keys do.
- Everything is drawn with existing scene items (boxes, edges, text, badges), so the painters and the player need nothing new.

### The modules

`b-tree` (topic trees), with `search`, `insert` and `delete`, and the sequence (ADR 0018).

- The minimum degree `t` is part of the input, from 2 to 5, default 3 (CLRS's figures for insertion and deletion use 3). A node holds `t − 1` to `2t − 1` keys, the root at least 1 unless the tree is empty.
- Keys are distinct finite numbers or short words, compared as numbers when every key is a number, else as strings.
- **Search** walks down, comparing keys in a node left to right and highlighting each; it settles the key it finds, or ends at a leaf.
- **Insert** is CLRS's one-pass B-TREE-INSERT: a full root grows and splits, every full child on the way down is split before the walk enters it (`split` steps), and the key goes into a leaf (`insertKey`).
- **Delete** is CLRS's one-pass B-TREE-DELETE, with its cases as step names: `case-1` (the key is in a leaf), `case-2a`, `case-2b` and `case-2c` (in an inner node: the predecessor or successor takes its place, or the two children merge around it), `case-3a` (a key moves through the parent from a sibling with `t` keys) and `case-3b` (merge with a sibling), and `shrink` when the root runs out of keys.
- `from` is keys inserted one by one, or a tree in a short notation that `after` gives: a node is its keys in brackets, followed by its children in parentheses, `[G M] ([A C] [H K] [N R])`. A starting tree must be a B-tree for its `t`: key counts within bounds, every leaf at the same depth, and keys in order; the error names the node.

### Tests

- **Spec:** the declaration, ids generated and checked, every action's fields, the feature and version 0.6; fixtures valid and invalid.
- **Core:** the reducer against hand-computed states for each action and each error; property tests against a model of the tree; the scene invariants over fixtures; a key keeps its scene key through a split, a merge and a rotation.
- **Modules:** against an independent B-tree (search results, in-order keys, and the exact tree after each operation), and every case reached on random inputs; property tests; the per-operation checks of ADR 0018.
- **By eye:** search, insert with a root split and delete through every case, in the gallery and the player, light and dark.

### Rejected

- **B-trees in the `tree` kind**, as nodes valued `"C G M"`. Keys would not be data, could not be marked or followed, and child edges could not start at key gaps.
- **Keys without ids**, named by position. A split or a rotation renumbers positions in two nodes at once, so marks and animation would lose their key.
- **Generic actions only** (add a node, move a key to a position). Each step of a split would pass through a state that is not a tree, which the reducer would have to allow; named operations keep every state valid and match the procedures readers follow.
- **The minimum degree in the kind.** Validation of a drawing would then refuse 2-3 trees and trees in the middle of an operation; the modules check B-tree rules, where the procedure guarantees them.

## Consequences

- B-tree figures show keys rising, falling and moving between siblings, with child edges where a reader expects them.
- **Public interfaces:** protocol 0.6: the `btree` kind with its declaration and twelve actions; in `@algoviz/core`, its state, reducer and layout; the MCP guide's `kinds/btree.md`.
- B+ trees, after 1.0, can build on the same drawing, with leaves linked by S5's links.
