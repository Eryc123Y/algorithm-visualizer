## array

A row of cells: sorting, searching, two pointers, sliding windows. With `"view": "tree"` it is drawn as a complete binary tree (index `i` has children `2i+1` and `2i+2`). With `"view": "heap"` (version `"0.4"`) it is drawn as that tree with the row under it, both from the one array, as textbooks draw heaps: prefer it for heaps and heapsort, where the sorted part grows at the end of the row.

Declaration: `{ "kind": "array", "initial": [5, 3, 8], "label"?: "…", "view"?: "row" | "tree" | "heap" }`. `initial` holds bare values (ids `e0`, `e1`, …) or `{ "id", "value" }` elements. Values are numbers, strings, booleans or null.

| Action      | Fields             | Effect                                                                                                   |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `set`       | `index`, `value`   | Replace the value at `index`; the element keeps its id.                                                  |
| `swap`      | `i`, `j`           | Swap two elements (marked as swapped for this step).                                                     |
| `insert`    | `index`, `element` | Insert before `index`; `index` equal to the length appends. `element` is a value or `{ "id", "value" }`. |
| `remove`    | `index`            | Remove an element.                                                                                       |
| `compare`   | `i`, `j`           | Mark two positions as compared (this step).                                                              |
| `highlight` | `indices`          | Highlight positions (this step), e.g. `[2, 3]`.                                                          |
| `pointer`   | `name`, `index`    | Point a named arrow (`"i"`, `"lo"`, `"mid"`) at `index`; `null` removes it. Persists.                    |
| `settle`    | `index`            | Mark an element as final, e.g. sorted or found. Persists.                                                |

**Patterns** (version `"0.8"`), for string matching: `"pattern": ["a", "b"]` draws a second row under the text, its first element under text position `"shift"` (default 0, up to the text's length, so it may hang past the end). Pattern values get the ids `p0`, `p1`, … (skipping ids the array already uses; ids are unique within one array), or are `{ "id", "value" }` elements. A pattern needs the row view, and while it is there the text is fixed: `set`, `swap`, `insert` and `remove` are refused.

| Action  | Fields              | Effect                                                                                                                                       |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `align` | `shift`, `matched`? | Move the pattern under text position `shift`; its first `matched` elements (default 0) are marked as matched, and must equal the text above. |
| `check` | `j`                 | Compare pattern element `j` with the text above it (this step); if they are equal, `j` stays matched until the next `align`.                 |

The engine decides whether characters match, so a document cannot show a false match. A step shows one compared pair, that of its last `check`. Matched pairs are drawn highlighted, the compared pair as compared. Pointers are drawn under the pattern, at their text column, which is the column of the pattern element under it: a pointer `i` at the compared text position also points at the compared pattern element. Mark an occurrence with `settle` on its text positions.

```json
{
  "version": "0.1",
  "title": "Binary search for 7",
  "structures": { "a": { "kind": "array", "initial": [1, 3, 5, 7, 9, 11] } },
  "steps": [
    {
      "actions": [
        { "target": "a", "type": "pointer", "name": "lo", "index": 0 },
        { "target": "a", "type": "pointer", "name": "hi", "index": 5 },
        { "target": "a", "type": "pointer", "name": "mid", "index": 2 },
        { "target": "a", "type": "highlight", "indices": [2] }
      ],
      "meta": {
        "narration": "mid = (0 + 5) // 2 = 2, and a[2] = 5 < 7, so search the right half."
      }
    },
    {
      "actions": [
        { "target": "a", "type": "pointer", "name": "lo", "index": 3 },
        { "target": "a", "type": "pointer", "name": "mid", "index": 4 },
        { "target": "a", "type": "highlight", "indices": [4] }
      ],
      "meta": {
        "narration": "mid = (3 + 5) // 2 = 4, and a[4] = 9 > 7, so search the left half."
      }
    },
    {
      "actions": [
        { "target": "a", "type": "pointer", "name": "hi", "index": 3 },
        { "target": "a", "type": "pointer", "name": "mid", "index": 3 },
        { "target": "a", "type": "settle", "index": 3 }
      ],
      "meta": { "narration": "mid = 3 and a[3] = 7: found." }
    }
  ]
}
```
