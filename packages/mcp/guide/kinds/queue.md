## queue

First in, first out, plus deque operations at both ends: BFS, schedulers, sliding-window maximum. Positions count from the front (0).

Declaration: `{ "kind": "queue", "initial": [], "label"?: "…" }`, elements from front to back.

| Action      | Fields    | Effect                                                                |
| ----------- | --------- | --------------------------------------------------------------------- |
| `enqueue`   | `element` | Add at the back.                                                      |
| `dequeue`   | —         | Remove from the front; the queue must not be empty.                   |
| `pushFront` | `element` | Add at the front (deque).                                             |
| `popBack`   | —         | Remove from the back (deque).                                         |
| `peek`      | `end`?    | Highlight the element at `"front"` (default) or `"back"` (this step). |
| `highlight` | `indices` | Highlight positions counted from the front (this step).               |

```json
{
  "version": "1.0",
  "structures": { "q": { "kind": "queue", "initial": ["A"] } },
  "steps": [
    {
      "actions": [{ "target": "q", "type": "peek" }],
      "meta": { "narration": "A is at the front." }
    },
    {
      "actions": [
        { "target": "q", "type": "dequeue" },
        { "target": "q", "type": "enqueue", "element": "B" },
        { "target": "q", "type": "enqueue", "element": "C" }
      ],
      "meta": { "narration": "Take A and enqueue its neighbours B and C." }
    }
  ]
}
```
