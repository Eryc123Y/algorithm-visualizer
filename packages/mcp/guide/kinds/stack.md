## stack

Last in, first out: call stacks, bracket matching, iterative DFS, expression evaluation. Positions count from the bottom (0).

Declaration: `{ "kind": "stack", "initial": [], "label"?: "…" }`, elements from bottom to top.

| Action      | Fields    | Effect                                                   |
| ----------- | --------- | -------------------------------------------------------- |
| `push`      | `element` | Push a value or `{ "id", "value" }` on top.              |
| `pop`       | —         | Remove the top element; the stack must not be empty.     |
| `peek`      | —         | Highlight the top element (this step).                   |
| `highlight` | `indices` | Highlight positions counted from the bottom (this step). |

```json
{
  "version": "0.1",
  "title": "Matching brackets in (())",
  "structures": {
    "s": { "kind": "stack", "label": "open brackets", "initial": [] }
  },
  "steps": [
    {
      "actions": [{ "target": "s", "type": "push", "element": "(" }],
      "meta": { "narration": "Read '(' and push it." }
    },
    {
      "actions": [{ "target": "s", "type": "push", "element": "(" }],
      "meta": { "narration": "Read '(' and push it." }
    },
    {
      "actions": [{ "target": "s", "type": "peek" }],
      "meta": { "narration": "Read ')': the top is '(' and matches." }
    },
    {
      "actions": [{ "target": "s", "type": "pop" }],
      "meta": { "narration": "Pop the matched '('." }
    },
    {
      "actions": [{ "target": "s", "type": "pop" }],
      "meta": {
        "narration": "Read ')' and pop its '('. The stack is empty, so the brackets balance."
      }
    }
  ]
}
```
