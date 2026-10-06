## linkedList

Nodes in a row with explicit `next` (and `prev`) pointers: insertion, deletion, reversal, cycle detection, two-pointer techniques. Row positions count from the left (0). Links are independent of the row, so a reversal can rewire one pointer at a time while nodes stay in place.

Declaration: `{ "kind": "linkedList", "initial": [1, 2, 3], "doubly"?: false, "circular"?: false, "label"?: "…" }`. Each initial node links to the next (and back, if doubly linked); the last one links to null, or to the first if circular.

| Action      | Fields                 | Effect                                                                                     |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `insert`    | `index`, `element`     | Place a new, unlinked node at row position `index`. Wire it in with `link`.                |
| `remove`    | `index`                | Remove a node; links to it become null.                                                    |
| `set`       | `index`, `value`       | Change a node's value.                                                                     |
| `link`      | `from`, `to`, `field`? | Set node `from`'s `field` (`"next"` by default, or `"prev"`) to node `to`, or `null`.      |
| `pointer`   | `name`, `index`        | Point a named arrow (`"head"`, `"prev"`, `"curr"`) at a node; `null` removes it. Persists. |
| `highlight` | `indices`              | Highlight nodes (this step).                                                               |
| `visit`     | `index`                | Mark a node as visited. Persists.                                                          |

Row positions shift when nodes are inserted or removed, like an array.

```json
{
  "version": "0.1",
  "title": "Insert 15 after 10",
  "structures": { "list": { "kind": "linkedList", "initial": [10, 20, 30] } },
  "steps": [
    {
      "actions": [
        { "target": "list", "type": "insert", "index": 1, "element": 15 },
        { "target": "list", "type": "pointer", "name": "prev", "index": 0 }
      ],
      "meta": {
        "narration": "Create node 15 between 10 and 20 in the row; it is not linked yet."
      }
    },
    {
      "actions": [{ "target": "list", "type": "link", "from": 1, "to": 2 }],
      "meta": { "narration": "Point 15's next at 20." }
    },
    {
      "actions": [{ "target": "list", "type": "link", "from": 0, "to": 1 }],
      "meta": {
        "narration": "Point 10's next at 15: the new node is in the list."
      }
    }
  ]
}
```
