## priorityQueue

Items with keys, kept in key order: Dijkstra's and Prim's min-priority queue, event queues, best-first search. The front is the item of least key (`"order": "min"`, the default) or greatest key (`"max"`). Items are named by id, because their positions change with every key change. To show how a binary heap does it, use an `array` with `"view": "heap"` instead.

Declaration: `{ "kind": "priorityQueue", "initial": [{ "value": "A", "key": 0 }, { "value": "B", "key": null }], "order"?: "min" | "max", "label"?: "…" }`. Items without an `id` get `e0`, `e1`, … by position; give `{ "id": "A", "value": "A", "key": 0 }` to name it after a graph vertex. A key is a number, or `null` for no key yet, drawn as ∞ (−∞ in a max-queue) and ordered after every number. Items of equal key keep insertion order, also after a key change.

| Action      | Fields           | Effect                                                                                                         |
| ----------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `insert`    | `element`, `key` | Add an item; it takes its place by key, after items of equal key. `element` is a value or `{ "id", "value" }`. |
| `extract`   | —                | EXTRACT-MIN (or -MAX): remove the front item. The queue must not be empty.                                     |
| `setKey`    | `id`, `key`      | DECREASE-KEY (or INCREASE-KEY): give the item a new key; it moves to its place and is highlighted (this step). |
| `peek`      | —                | Highlight the front item (this step).                                                                          |
| `highlight` | `ids`            | Highlight items by id (this step); each must be in the queue.                                                  |

Beside a graph, give the queue `"place": "side"`. In the side panel of a wide figure it is drawn as a column, the front at the top; elsewhere as a row, the front on the left.

```json
{
  "version": "1.0",
  "structures": {
    "Q": {
      "kind": "priorityQueue",
      "initial": [
        { "id": "A", "value": "A", "key": 0 },
        { "id": "B", "value": "B", "key": null },
        { "id": "C", "value": "C", "key": null }
      ],
      "place": "side"
    }
  },
  "steps": [
    {
      "actions": [{ "target": "Q", "type": "extract" }],
      "meta": {
        "narration": "A has the least distance, 0: take it from the queue."
      }
    },
    {
      "actions": [{ "target": "Q", "type": "setKey", "id": "C", "key": 4 }],
      "meta": {
        "narration": "The edge A–C gives C the distance 4, so C moves to the front."
      }
    }
  ]
}
```
