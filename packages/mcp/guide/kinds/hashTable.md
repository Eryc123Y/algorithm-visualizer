## hashTable

A hash table with separate chaining: each bucket holds a chain. Elements are addressed by `bucket` and their `index` in the chain. You compute the hash yourself: say it in the narration and pick the bucket. (For open addressing, use an `array` with `null` for empty slots.)

Declaration: `{ "kind": "hashTable", "size": 5, "initial"?: [[10], [], [7, 12]], "label"?: "…" }`. `size` is the number of buckets; `initial` gives chains per bucket (bare values get ids `e0`, `e1`, … in reading order).

| Action       | Fields                        | Effect                                                                                     |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------ |
| `insert`     | `bucket`, `element`, `index`? | Add to a chain, at the end by default.                                                     |
| `remove`     | `bucket`, `index`             | Remove from a chain.                                                                       |
| `set`        | `bucket`, `index`, `value`    | Change an element's value.                                                                 |
| `highlight`  | `bucket`, `indices`?          | Highlight a bucket and optionally elements of its chain (this step), e.g. while searching. |
| `settle`     | `bucket`, `index`             | Mark an element as found. Persists.                                                        |
| `resetMarks` | —                             | Clear every mark.                                                                          |

```json
{
  "version": "1.0",
  "title": "Chaining with h(k) = k mod 5",
  "structures": { "h": { "kind": "hashTable", "size": 5 } },
  "steps": [
    {
      "actions": [
        { "target": "h", "type": "insert", "bucket": 2, "element": 12 }
      ],
      "meta": { "narration": "12 mod 5 = 2: add 12 to bucket 2." }
    },
    {
      "actions": [
        { "target": "h", "type": "insert", "bucket": 2, "element": 7 }
      ],
      "meta": { "narration": "7 mod 5 = 2: a collision, so 7 joins the chain." }
    },
    {
      "actions": [
        { "target": "h", "type": "highlight", "bucket": 2, "indices": [0, 1] }
      ],
      "meta": { "narration": "Search for 7: scan bucket 2." }
    },
    {
      "actions": [{ "target": "h", "type": "settle", "bucket": 2, "index": 1 }],
      "meta": { "narration": "Found 7 at position 1 of the chain." }
    }
  ]
}
```
