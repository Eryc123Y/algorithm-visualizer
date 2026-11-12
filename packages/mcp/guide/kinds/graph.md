## graph

Directed or undirected graphs with optional weights: BFS, DFS, shortest paths, spanning trees, topological order, flows, colouring. Nodes and edges are referred to by id.

Declaration: `{ "kind": "graph", "directed"?: false, "nodes": ["A", "B", "C"], "edges": [["A", "B", 4], ["B", "C"]], "layout"?: "auto", "label"?: "…" }`.

- A node is a name (its id and its text) or `{ "id", "value"?, "x"?, "y"? }`.
- An edge is `[from, to]`, `[from, to, weight]` or `{ "id"?, "from", "to", "weight"? }`. Its id defaults to `"from-to"` exactly as written, so `["B", "A"]` is `"B-A"` even in an undirected graph. Two edges between the same nodes need explicit ids.
- `layout`: `"auto"` (by hand when every node has `x` and `y`, else layered for directed acyclic graphs, else a circle), `"layered"` (top to bottom along edges, good for trees and DAGs), `"circle"`, `"grid"`, or `"manual"` (every node has `x` and `y` in pixels). Nodes keep their place for the whole trace.

| Action       | Fields             | Effect                                                                                                |
| ------------ | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `addNode`    | `node`             | Add a node (a name, or an object as above).                                                           |
| `removeNode` | `node`             | Remove a node and its edges.                                                                          |
| `setValue`   | `node`, `value`    | Change the text in a node.                                                                            |
| `addEdge`    | `edge`             | Add an edge between existing nodes.                                                                   |
| `removeEdge` | `edge`             | Remove an edge (by id).                                                                               |
| `setWeight`  | `edge`, `weight`   | Change an edge's weight or label, e.g. `"3/5"` for a flow; `null` removes it.                         |
| `highlight`  | `nodes`?, `edges`? | Highlight nodes and edges (this step), e.g. the edge being relaxed.                                   |
| `visit`      | `node`             | Mark as visited or discovered. Persists.                                                              |
| `settle`     | `node`             | Mark as finished, e.g. its distance is final. Persists.                                               |
| `group`      | `node`, `group`    | Colour group 0–5, e.g. a component or colour class; `null` removes it. Persists.                      |
| `pointer`    | `name`, `node`     | Named arrow at a node, e.g. `"u"`; `null` removes it. Persists.                                       |
| `annotate`   | `node`, `text`     | A short note by the node (at most 32 characters), e.g. `"d=4"` or `"∞"`; `null` removes it. Persists. |
| `markEdge`   | `edge`, `mark`     | `"selected"` (in the tree or path), `"rejected"` (e.g. it would close a cycle), or `null`. Persists.  |
| `resetMarks` | —                  | Clear every persistent mark.                                                                          |

```json
{
  "version": "1.0",
  "title": "Dijkstra from A",
  "structures": {
    "g": {
      "kind": "graph",
      "directed": true,
      "nodes": ["A", "B", "C"],
      "edges": [
        ["A", "B", 4],
        ["A", "C", 1],
        ["C", "B", 2]
      ]
    }
  },
  "steps": [
    {
      "actions": [
        { "target": "g", "type": "annotate", "node": "A", "text": "0" },
        { "target": "g", "type": "annotate", "node": "B", "text": "∞" },
        { "target": "g", "type": "annotate", "node": "C", "text": "∞" }
      ],
      "meta": { "narration": "dist(A) = 0; every other distance starts at ∞." }
    },
    {
      "actions": [
        { "target": "g", "type": "settle", "node": "A" },
        { "target": "g", "type": "highlight", "edges": ["A-B", "A-C"] },
        { "target": "g", "type": "annotate", "node": "B", "text": "4" },
        { "target": "g", "type": "annotate", "node": "C", "text": "1" },
        {
          "target": "g",
          "type": "markEdge",
          "edge": "A-B",
          "mark": "selected"
        },
        { "target": "g", "type": "markEdge", "edge": "A-C", "mark": "selected" }
      ],
      "meta": {
        "narration": "Settle A and relax its edges: B gets 4, C gets 1."
      }
    },
    {
      "actions": [
        { "target": "g", "type": "settle", "node": "C" },
        { "target": "g", "type": "highlight", "edges": ["C-B"] },
        { "target": "g", "type": "annotate", "node": "B", "text": "3" },
        { "target": "g", "type": "markEdge", "edge": "A-B", "mark": null },
        { "target": "g", "type": "markEdge", "edge": "C-B", "mark": "selected" }
      ],
      "meta": {
        "narration": "C is closest. Through C, B costs 1 + 2 = 3 < 4, so update it."
      }
    },
    {
      "actions": [{ "target": "g", "type": "settle", "node": "B" }],
      "meta": {
        "narration": "Settle B. The selected edges form the shortest-path tree."
      }
    }
  ]
}
```
