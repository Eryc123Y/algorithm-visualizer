## plane

Points at coordinates and the segments between them, for computational geometry: segment intersection, convex hulls, closest pairs. The drawing keeps one region and one scale through the whole visualization, with y pointing up. Needs `"version": "0.9"`.

Declaration: `{ "kind": "plane", "points": [{ "id": "a", "x": 0, "y": 0 }, { "id": "b", "x": 4, "y": 3, "label"?: "p1" }], "segments"?: [{ "id": "s1", "from": "a", "to": "b", "label"?: "5" }], "axes"?: false }`. Coordinates are numbers from −1,000,000 to 1,000,000. Ids are unique within the plane, points and segments together. Two points may not share coordinates, a segment joins two different points, and two points have at most one segment. At most 64 points and 128 segments.

| Action          | Fields                 | Effect                                                                                            |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `addPoint`      | `point`                | Add a point `{ "id", "x", "y", "label"? }`.                                                       |
| `removePoint`   | `id`                   | Remove a point; a point that ends a segment is refused, so remove the segment first.              |
| `addSegment`    | `segment`              | Add a segment `{ "id", "from", "to", "label"? }` between two points.                              |
| `removeSegment` | `id`                   | Remove a segment.                                                                                 |
| `label`         | `segment`, `text`      | Change a segment's label, such as a distance; `null` removes it.                                  |
| `highlight`     | `points`?, `segments`? | Highlight points and segments (this step).                                                        |
| `compare`       | `points`               | Mark two or three points as being compared, as an orientation test does (this step).              |
| `visit`         | `point`                | Mark a point as considered. Persists.                                                             |
| `settle`        | `point`                | Mark a point as final, such as a hull vertex. Persists.                                           |
| `select`        | `segment`, `on`        | Mark a segment as chosen (`true`), such as a hull edge or a closest pair, or clear it. Persists.  |
| `pointer`       | `name`, `point`        | A named badge under a point; `null` removes it. Persists.                                         |
| `line`          | `name`, `x`            | A named vertical line at `x`, such as `"sweep"` or `"l"`; `null` removes it. At most 8. Persists. |

Marks go with the point or segment they name when it is removed.

```json
{
  "version": "0.9",
  "title": "Is the turn from a to b to c a left turn?",
  "structures": {
    "P": {
      "kind": "plane",
      "points": [
        { "id": "a", "x": 0, "y": 0 },
        { "id": "b", "x": 4, "y": 1 },
        { "id": "c", "x": 3, "y": 4 }
      ],
      "segments": [{ "id": "ab", "from": "a", "to": "b" }],
      "axes": true
    }
  },
  "steps": [
    {
      "actions": [
        { "target": "P", "type": "compare", "points": ["a", "b", "c"] }
      ],
      "meta": {
        "narration": "The cross product of b − a and c − a is 4 · 4 − 1 · 3 = 13 > 0: c is to the left."
      }
    },
    {
      "actions": [
        {
          "target": "P",
          "type": "addSegment",
          "segment": { "id": "bc", "from": "b", "to": "c" }
        },
        { "target": "P", "type": "select", "segment": "bc", "on": true }
      ],
      "meta": { "narration": "So the path turns left at b." }
    }
  ]
}
```
