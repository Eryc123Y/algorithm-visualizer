## btree

Multiway search trees whose nodes hold several keys: B-trees, 2-3-4 trees. A node has its keys in order and no children (a leaf) or one more child than keys; child `i` hangs from the gap left of key `i`. Keys are elements with ids, so a key moves visibly from node to node. A tree always has a root; an empty tree is a root leaf with no keys. Needs `"version": "0.6"`.

Declaration: `{ "kind": "btree", "nodes": [{ "id": "r", "keys": ["G", "M"], "children": ["a", "b", "c"] }, { "id": "a", "keys": ["A", "C"] }, …], "root"?: "r" }`. Keys are values (ids `k0`, `k1`, … are generated through the tree in order) or `{ "id", "value" }`. `root` defaults to the node that is nobody's child. Without `nodes`, the tree is one empty root with the id `root`. A node holds at most 32 keys, and the tree at most 1,000 elements, nodes and keys together. The kind checks the shape, not key order or a minimum degree.

| Action      | Fields                     | Effect                                                                                                                                                                                                           |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insertKey` | `node`, `index`, `key`     | Insert a key (a value, or `{ "id", "value" }`) into a leaf at position `index`; an inner node is refused.                                                                                                        |
| `removeKey` | `key`                      | Remove a key from the leaf that holds it; a key in an inner node is refused (use `merge`, `borrow` or `lift`).                                                                                                   |
| `setKey`    | `key`, `value`             | Change a key's value.                                                                                                                                                                                            |
| `lift`      | `key`, `over`              | The key `key`, in a leaf, takes the place of `over` in an inner node, which is removed: a predecessor or successor rising in a deletion.                                                                         |
| `split`     | `node`, `index`, `newNode` | Split child `index` of `node` (at least 3 keys) around its middle key, which rises into `node`; the right half becomes the new child `newNode`.                                                                  |
| `grow`      | `newRoot`                  | A new root with no keys above the root, before a root split.                                                                                                                                                     |
| `merge`     | `node`, `index`            | Merge child `index`, key `index` and child `index + 1` into child `index`; the right child goes.                                                                                                                 |
| `shrink`    | —                          | The root has no keys and one child: the child becomes the root.                                                                                                                                                  |
| `borrow`    | `node`, `child`, `from`    | Child `child` takes a key from its sibling on the side `from` (`"left"` or `"right"`) through `node`: the separating key falls into the child, the sibling's nearest key rises, and its nearest child moves too. |
| `highlight` | `keys`?, `nodes`?          | Highlight keys and nodes (this step).                                                                                                                                                                            |
| `settle`    | `key`                      | Mark a key as found. Persists.                                                                                                                                                                                   |
| `pointer`   | `name`, `node`             | Named arrow at a node; `null` removes it. Persists.                                                                                                                                                              |
| `annotate`  | `node`, `text`             | A short note beside a node; `null` removes it. Persists.                                                                                                                                                         |

Ids in `newNode`, `newRoot` and inserted keys must be new: no node or key in the document has them. When `merge` removes the right child, or `shrink` the old root, its pointers move to the node that stays, and so does its note unless that node has one.

```json
{
  "version": "0.6",
  "title": "Insert B into a B-tree with t = 2",
  "structures": {
    "T": {
      "kind": "btree",
      "nodes": [
        { "id": "r", "keys": ["G"], "children": ["a", "b"] },
        { "id": "a", "keys": ["A", "C", "E"] },
        { "id": "b", "keys": ["H", "K"] }
      ]
    }
  },
  "steps": [
    {
      "actions": [
        { "target": "T", "type": "pointer", "name": "x", "node": "r" },
        { "target": "T", "type": "highlight", "nodes": ["a"] }
      ],
      "meta": { "narration": "B < G: go left, to a full child, A C E." }
    },
    {
      "actions": [
        {
          "target": "T",
          "type": "split",
          "node": "r",
          "index": 0,
          "newNode": "a2"
        }
      ],
      "meta": {
        "narration": "Split it first: its middle key C rises into the root."
      }
    },
    {
      "actions": [
        { "target": "T", "type": "pointer", "name": "x", "node": "a" },
        {
          "target": "T",
          "type": "insertKey",
          "node": "a",
          "index": 1,
          "key": "B"
        }
      ],
      "meta": { "narration": "B < C: insert B into the leaf A, after A." }
    }
  ]
}
```
