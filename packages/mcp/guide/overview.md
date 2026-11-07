# Writing algoviz visualizations

An algoviz document is JSON that describes a step-by-step visualization of an algorithm: the data structures involved, and a timeline of steps that change them. A player shows one frame per step, with the narration and the current source line.

## Document

```json
{
  "version": "0.1",
  "title": "Bubble sort, first pass",
  "source": {
    "language": "python",
    "code": "for j in range(n - 1):\n    if a[j] > a[j + 1]:\n        a[j], a[j + 1] = a[j + 1], a[j]"
  },
  "structures": {
    "a": { "kind": "array", "initial": [5, 3, 8] }
  },
  "steps": [
    {
      "actions": [{ "target": "a", "type": "compare", "i": 0, "j": 1 }],
      "meta": { "line": 2, "narration": "Compare 5 and 3.", "vars": { "j": 0 } }
    },
    {
      "actions": [{ "target": "a", "type": "swap", "i": 0, "j": 1 }],
      "meta": { "line": 3, "narration": "5 > 3, so swap them." }
    },
    {
      "actions": [{ "target": "a", "type": "compare", "i": 1, "j": 2 }],
      "meta": {
        "line": 2,
        "narration": "Compare 5 and 8: already in order.",
        "vars": { "j": 1 }
      }
    }
  ]
}
```

- `version` is the protocol version, `"major.minor"`. Write the oldest version that has every feature you use: `"0.2"` if any step has a name or the document has sections (below), and `"0.1"` otherwise.
- `title` and `source` are optional. `source.code` is the code being taught; `meta.line` (1-based) highlights a line of it. Without `source`, leave out `line`.
- `structures` maps names to declarations (at most 16). Names are identifiers: letters, digits and `_`, not starting with a digit, e.g. `arr`, `dist`, `call_stack`.
- `steps` is the timeline. Each step has `actions` (applied in order, possibly none) and optional `meta`:
  - `narration`: one or two sentences for a learner, saying what happens and why.
  - `line`: the source line, if there is `source`.
  - `vars`: variable values to display, e.g. `{ "i": 2, "min": 3 }`.
  - `id`: the step's name, such as `compare` or `relax` (see below).
- Each action names its structure in `target` and its operation in `type`; the other fields depend on the structure's kind.

## Frames

Frame 0 shows the declared initial state; frame `n` shows the state after step `n`. Plan one step per thing a learner should see: a comparison, a swap, a node visited. A step may hold several actions that belong together (e.g. `compare` and `pointer`), and a step with no actions can just narrate.

## Step names and sections

Names let people and tools refer to a step by what it does rather than by its number, which changes whenever steps are added. Both need `"version": "0.2"`.

- `meta.id` names the kind of step: `"compare"`, `"swap"`, `"relax"`, `"fixup-case-3"`. Use lower-case kebab-case that starts with a letter, at most 40 characters. Names repeat: every relaxation is `"relax"`. Name every step.
- `sections` groups consecutive steps under a title, such as each operation of a sequence. `start` is the index of the section's first step (0-based), and the section lasts until the next one starts. Sections are listed in order, each has at least one step, and their ids are unique. Steps before the first section belong to none. Don't give a section the id of a step name: the bare name would then select the section.

```json
{
  "version": "0.2",
  "title": "Push twice, then pop",
  "structures": {
    "s": { "kind": "stack", "initial": [1] }
  },
  "steps": [
    {
      "actions": [{ "target": "s", "type": "push", "element": 2 }],
      "meta": { "id": "push", "narration": "Push 2 on top." }
    },
    {
      "actions": [{ "target": "s", "type": "push", "element": 3 }],
      "meta": { "id": "push", "narration": "Push 3 on top." }
    },
    {
      "actions": [{ "target": "s", "type": "pop" }],
      "meta": {
        "id": "pop",
        "narration": "Pop takes 3, the last value pushed."
      }
    }
  ],
  "sections": [
    { "id": "push-2-and-3", "title": "Push 2 and 3", "start": 0 },
    { "id": "pop-3", "title": "Pop 3", "start": 2 }
  ]
}
```

A selector names frames, in `algoviz_inspect`, `algoviz_render` and `algoviz_show`, and in the player's `frame` attribute:

| Selector              | Frames                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `3`, `-1`             | Frame 3; negative numbers count from the end.                                                                           |
| `push`                | The frame after the first step named `push`.                                                                            |
| `push#2`              | The frame after the second step named `push`.                                                                           |
| `push-2-and-3/push#2` | The same, counting only inside that section.                                                                            |
| `pop-3`               | A section: from the frame before its first step to the one after its last. A bare name is a section if one has that id. |
| `push..-1`            | The range between two selectors, both included.                                                                         |

## Marks

Besides data, structures carry marks that colour elements.

- **Transient** marks (`compare`, `highlight`, `peek`, `depend`, and the mark `swap` leaves) last for their step only. Repeat them in the next step to keep them.
- **Persistent** marks (`pointer`, `settle`, `visit`, `group`, `annotate`, `markEdge`) stay until changed. Remove a pointer with `"index": null` or `"node": null`; clear graph, table and hash table marks with `resetMarks`.

## Ids and positions

- Elements have ids that stay with them as they move, so a swap animates as a move. Bare values get ids `e0`, `e1`, … in order; elements added later by actions with a bare value get the next free `eN`. Give `{ "id": "x", "value": 5 }` to choose an id.
- Ids are unique within a structure for the whole trace, even after the element is removed. Ids use letters, digits and `_ . : -`.
- Positions (`index`, `i`, `j`) are 0-based and refer to the state at that moment, after the earlier actions of the same step.

## Checking your work

Validate every document before you return it. Errors look like this:

```
OUT_OF_RANGE at $.steps[3].actions[0].j: j=4 is out of range for an array of length 4 (hint: Valid values are 0 to 3.)
```

The path says where the problem is: `$.steps[3].actions[0]` is the first action of the fourth step. Fix each error and validate again. Errors found while replaying stop at the first failing action, so more may follow once it is fixed.

## Common mistakes

- Indices that no longer exist after a `remove`, `pop` or `dequeue` earlier in the trace.
- Graph edges are referred to by id, which defaults to `"from-to"` in the order they were declared: the edge `["B", "A"]` is `"B-A"`, also in an undirected graph.
- Tree nodes from `levelOrder` get ids `e0`, `e1`, … in level order, skipping nulls.
- Marks that should persist use a persistent action: `settle` an element once it is final rather than highlighting it in every later step.
- Keep inputs small enough to read: about 4–12 elements, 3–10 graph nodes.
