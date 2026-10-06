## table

A grid of cells: dynamic programming (LCS, edit distance, knapsack, coin change), Floyd–Warshall distances, adjacency matrices. Cells are `[row, column]`, from 0. A `null` cell is drawn empty.

Declaration: `{ "kind": "table", "rows"?: 3, "columns"?: 4, "initial"?: [[0, 0], [0]], "rowLabels"?: […], "columnLabels"?: […], "label"?: "…" }`. Give `rows` and `columns` for an empty table, `initial` for one with values (short rows are padded with empty cells), or both. Labels must match the number of rows and columns; without them rows and columns are numbered.

| Action       | Fields          | Effect                                                                         |
| ------------ | --------------- | ------------------------------------------------------------------------------ |
| `set`        | `cell`, `value` | Write a cell; `null` empties it.                                               |
| `highlight`  | `cells`         | Highlight cells (this step).                                                   |
| `depend`     | `cell`, `on`    | Arrows from each cell in `on` to `cell`: it is computed from them (this step). |
| `settle`     | `cells`         | Mark cells as part of the answer, e.g. a traceback. Persists.                  |
| `resetMarks` | —               | Clear every mark.                                                              |

```json
{
  "version": "0.1",
  "title": "Fibonacci with a table",
  "structures": {
    "fib": {
      "kind": "table",
      "initial": [[0, 1, null, null, null]],
      "rowLabels": ["F"]
    }
  },
  "steps": [
    {
      "actions": [
        { "target": "fib", "type": "set", "cell": [0, 2], "value": 1 },
        {
          "target": "fib",
          "type": "depend",
          "cell": [0, 2],
          "on": [
            [0, 0],
            [0, 1]
          ]
        }
      ],
      "meta": { "narration": "F(2) = F(0) + F(1) = 1." }
    },
    {
      "actions": [
        { "target": "fib", "type": "set", "cell": [0, 3], "value": 2 },
        {
          "target": "fib",
          "type": "depend",
          "cell": [0, 3],
          "on": [
            [0, 1],
            [0, 2]
          ]
        }
      ],
      "meta": { "narration": "F(3) = F(1) + F(2) = 2." }
    },
    {
      "actions": [
        { "target": "fib", "type": "set", "cell": [0, 4], "value": 3 },
        {
          "target": "fib",
          "type": "depend",
          "cell": [0, 4],
          "on": [
            [0, 2],
            [0, 3]
          ]
        },
        { "target": "fib", "type": "settle", "cells": [[0, 4]] }
      ],
      "meta": { "narration": "F(4) = F(2) + F(3) = 3." }
    }
  ]
}
```
