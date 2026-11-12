## tree

Rooted trees and forests: BSTs, AVL and red–black trees, heaps as trees, tries, recursion trees, union–find. Nodes are referred to by id. Binary trees have two child slots per node, left and right, either of which may be empty.

Declaration, either:

- `{ "kind": "tree", "levelOrder": [8, 3, 10, 1, 6, null, 14] }`: a binary tree in level order as on LeetCode, `null` for a missing node. Node ids are `e0`, `e1`, … in level order, skipping nulls (here 14 is `e5`).
- `{ "kind": "tree", "binary"?: false, "nodes": [{ "id": "r", "value": 8, "children": ["a", "b"], "color"?: "red" | "black" }, …], "roots"?: ["r"] }`. In a binary tree, `children` is `[left, right]` with `null` for an empty slot, e.g. `[null, "x"]`. Roots default to every node without a parent.
- `{ "kind": "tree", "binary": true }`: an empty binary tree, to grow with `addNode`.
- `"rootList": "list" | "circular"`: join the roots in order, as a Fibonacci heap's root list; `"circular"` also joins the last root to the first. Pointers at roots are then drawn above them.

| Action       | Fields                     | Effect                                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `addNode`    | `node`, `parent`, `slot`?  | Add `node` (a value, or `{ "id", "value", "color"? }`) under `parent`. Binary trees: `slot` is `"left"` or `"right"` and must be empty (default: the first empty one). Other trees: inserts at position `slot`, default last. `parent: null` adds a root, at position `slot` among the roots (default last). |
| `removeNode` | `node`                     | Remove a node and its subtree.                                                                                                                                                                                                                                                                               |
| `setChild`   | `parent`, `child`, `slot`? | Move `child` and its subtree under `parent`. Binary trees need `slot`; a child already there becomes a separate root. `child: null` empties the slot.                                                                                                                                                        |
| `detach`     | `node`, `slot`?            | Cut a subtree off; it becomes a separate root, at position `slot` among the roots (default last). A root with a `slot` moves there.                                                                                                                                                                          |
| `rotate`     | `node`, `direction`        | Binary trees: rotate `"left"` (lifts the right child) or `"right"` around `node`.                                                                                                                                                                                                                            |
| `setValue`   | `node`, `value`            | Change a value.                                                                                                                                                                                                                                                                                              |
| `swapValues` | `a`, `b`                   | Exchange two nodes' values (sift-up and sift-down).                                                                                                                                                                                                                                                          |
| `setColor`   | `node`, `color`            | `"red"`, `"black"` or `null`.                                                                                                                                                                                                                                                                                |
| `highlight`  | `nodes`                    | Highlight nodes (this step).                                                                                                                                                                                                                                                                                 |
| `compare`    | `a`, `b`                   | Mark two nodes as compared (this step).                                                                                                                                                                                                                                                                      |
| `visit`      | `node`                     | Mark as visited. Persists.                                                                                                                                                                                                                                                                                   |
| `settle`     | `node`                     | Mark as final or found. Persists.                                                                                                                                                                                                                                                                            |
| `group`      | `node`, `group`            | Colour group 0–5, e.g. a set in union–find; `null` removes it. Persists.                                                                                                                                                                                                                                     |
| `pointer`    | `name`, `node`             | Named arrow at a node; `null` removes it. In a binary tree `node` may be an empty slot, `{ "parent": "n4", "slot": "left" }`: the NIL leaf there, drawn as a small `NIL` box. Persists until the slot fills.                                                                                                 |
| `annotate`   | `node`, `text`, `field`?   | A short note beside the node (at most 32 characters), e.g. `"h=2"`; `null` removes it. With `field` (e.g. `"size"`, `"max"`) the node keeps one note per field, shown together. Persists.                                                                                                                    |
| `markEdge`   | `node`, `mark`             | Mark the edge from `node`'s parent to `node`: `"selected"` (a search path, a code bit) or `"rejected"`; `null` clears it. Persists while the edge does.                                                                                                                                                      |
| `labelEdge`  | `node`, `label`            | A label beside the edge from `node`'s parent to `node`, e.g. `"0"` in a Huffman tree; `null` removes it. Persists while the edge does.                                                                                                                                                                       |

```json
{
  "version": "1.0",
  "title": "Insert 7 into a BST",
  "structures": { "bst": { "kind": "tree", "levelOrder": [8, 3, 10, 1, 6] } },
  "steps": [
    {
      "actions": [
        { "target": "bst", "type": "pointer", "name": "curr", "node": "e0" }
      ],
      "meta": { "narration": "Start at the root, 8. 7 < 8, so go left." }
    },
    {
      "actions": [
        { "target": "bst", "type": "pointer", "name": "curr", "node": "e1" }
      ],
      "meta": { "narration": "At 3: 7 > 3, so go right." }
    },
    {
      "actions": [
        { "target": "bst", "type": "pointer", "name": "curr", "node": "e4" }
      ],
      "meta": { "narration": "At 6: 7 > 6, and 6 has no right child." }
    },
    {
      "actions": [
        {
          "target": "bst",
          "type": "addNode",
          "node": { "id": "n7", "value": 7 },
          "parent": "e4",
          "slot": "right"
        },
        { "target": "bst", "type": "pointer", "name": "curr", "node": null },
        { "target": "bst", "type": "settle", "node": "n7" }
      ],
      "meta": { "narration": "Insert 7 as the right child of 6." }
    }
  ]
}
```

Root slots, NIL pointers, named notes, edge marks and labels, and root lists, for augmented trees and heaps. Sizes as named notes, a marked edge and a pointer at NIL:

```json
{
  "version": "1.0",
  "title": "Order statistics: select the 2nd smallest",
  "structures": {
    "t": {
      "kind": "tree",
      "binary": true,
      "nodes": [
        { "id": "n5", "value": 5, "children": ["n2", "n8"], "color": "black" },
        { "id": "n2", "value": 2, "color": "black" },
        { "id": "n8", "value": 8, "color": "black" }
      ]
    }
  },
  "steps": [
    {
      "actions": [
        {
          "target": "t",
          "type": "annotate",
          "node": "n5",
          "field": "size",
          "text": "s=3"
        },
        {
          "target": "t",
          "type": "annotate",
          "node": "n2",
          "field": "size",
          "text": "s=1"
        },
        {
          "target": "t",
          "type": "annotate",
          "node": "n8",
          "field": "size",
          "text": "s=1"
        },
        { "target": "t", "type": "pointer", "name": "x", "node": "n5" }
      ],
      "meta": {
        "narration": "At the root: its left subtree holds 1 key, so 5 has rank 2."
      }
    },
    {
      "actions": [
        { "target": "t", "type": "markEdge", "node": "n2", "mark": "rejected" },
        { "target": "t", "type": "settle", "node": "n5" }
      ],
      "meta": {
        "narration": "Rank 2 is what we want: 5 is the 2nd smallest key."
      }
    },
    {
      "actions": [
        {
          "target": "t",
          "type": "pointer",
          "name": "x",
          "node": { "parent": "n2", "slot": "left" }
        }
      ],
      "meta": {
        "narration": "A pointer can also name an empty slot: here the NIL left of 2."
      }
    }
  ]
}
```
