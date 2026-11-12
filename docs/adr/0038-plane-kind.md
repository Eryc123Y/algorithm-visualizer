# 0038. Points and segments get a kind of their own: `plane`

## Status

Accepted

## Context

Version 1.0 covers the computational geometry chapter of CLRS's 3rd edition (requirement R1; roadmap S8): whether any two segments intersect (a sweep line), the convex hull by Graham's scan and by Jarvis's march, and the closest pair of points. Each of them is about where things are: points at coordinates, the segments between them, a vertical line that sweeps or divides, and a strip around it.

No kind places anything by coordinates. `graph` places nodes by its own layered layout and moves them when the graph changes; the other kinds are rows, columns and trees. The picture these algorithms need is a piece of the plane with its points where their coordinates say.

## Decision

A new kind, `plane`, in protocol version **0.9** (ADR 0021), after 0.6 to 0.8 (ADRs 0035 to 0037), which land first: a feature `planes` in `PROTOCOL_FEATURES`, used by any document with a `plane` structure.

### Declaration

```json
{
  "kind": "plane",
  "points": [
    { "id": "a", "x": 0, "y": 0 },
    { "id": "b", "x": 4, "y": 3, "label": "p1" }
  ],
  "segments": [{ "id": "s1", "from": "a", "to": "b" }],
  "axes": true
}
```

- A point has an id, coordinates and an optional label (shown beside it; the id when absent). Coordinates are finite numbers from −10⁶ to 10⁶.
- A segment has an id and two distinct point ids for its ends, and an optional label. Points and segments share the document's id space.
- `axes` (default false) draws the x and y axes.
- At most 64 points and 128 segments. Two points may not share coordinates (`INVALID_STRUCTURE`): they would draw as one.

### Actions

| Action          | Fields                 | Effect                                                                                                                      |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `addPoint`      | `point`                | Add a point `{ id, x, y, label? }`.                                                                                         |
| `removePoint`   | `id`                   | Remove a point; a point that ends a segment is refused (remove the segment first).                                          |
| `addSegment`    | `segment`              | Add a segment `{ id, from, to, label? }` between two points.                                                                |
| `removeSegment` | `id`                   | Remove a segment.                                                                                                           |
| `highlight`     | `points`?, `segments`? | Highlight points and segments (this step).                                                                                  |
| `compare`       | `points`               | Mark two or three points as being compared, as an orientation test does (this step).                                        |
| `visit`         | `point`                | Mark a point as considered (persists).                                                                                      |
| `settle`        | `point`                | Mark a point as final, such as a hull vertex (persists).                                                                    |
| `select`        | `segment`, `on`        | Mark a segment as chosen (`on: true`), such as a hull edge, a closest pair or an intersecting pair, or clear it (persists). |
| `pointer`       | `name`, `point`        | A named badge at a point; `null` removes it (persists).                                                                     |
| `line`          | `name`, `x`            | A named vertical line at `x`, such as a sweep line or a dividing line; `null` removes it (persists).                        |

- Errors: an unknown point or segment (`NOT_FOUND`), an id in use (`DUPLICATE_ID`), a point at the coordinates of another (`INVALID_OPERATION`), coordinates out of range (`OUT_OF_RANGE`), each at the path of the field.
- A segment's marks go with it; a point's marks go with it. Lines and pointers are by name, at most 8 lines.
- `compare` takes two or three points, as many as an orientation or a distance needs.

### Drawing

- **One region, one scale.** The region is the bounding box of every point and line `x` over the whole trace, padded by a tenth of its size (at least 1 unit), so it is the same in every frame (ADR 0008). It is scaled uniformly to fit a square of side 320 units, keeping the aspect ratio, with y pointing up as in the textbook.
- **Points** are small nodes (`node`, radius 5, no text) at their coordinates, with the label beside (`label`, turned away from the segments at the point). Roles: `highlight`, `compare`, `visited`, `settled`, as for nodes in any kind.
- **Segments** are undirected edges (`edge`) between their points: `link` by default, `highlight` while highlighted, `selected` while selected. Their labels are edge labels.
- **Lines** are vertical edges across the region, `highlight`, with their name as the label at the top.
- **Axes** are directed edges, `default`, labelled `x` and `y`, under everything else: at x = 0 and y = 0 when those are inside the region, else along its left and lower edges.
- **Pointers** are badges beside their point, stacked when several share one.
- Keys: `<name>/point/<id>`, `<name>/segment/<id>`, `<name>/line/<name>`, `<name>/axis/x` and `/y`, so a line that moves slides and a point keeps its place.
- No new scene item and no new role, so no painter changes.

### Input notation

Points are written as textbooks write them, `(0, 0) (4, 3) (2, 5)`, optionally named, `a(0, 0) b(4, 3)`; unnamed points are named `p0`, `p1`, … in order. Segments are pairs, `(0, 0)-(4, 3), (1, 4)-(5, 0)`, optionally named, `s1: (0, 0)-(4, 3)`; unnamed ones are `s1`, `s2`, …. These follow ADR 0032: a string in the notation or the structured form, with `INVALID_NOTATION` errors at a character position.

### The modules

A new topic `geometry` holds four algorithms, in CLRS's conventions with indices from 0, in our own words, each with the 3rd edition's cross-product tests for orientation rather than angles.

- `any-segments-intersect`: 1 to 12 segments. The endpoints are sorted as events (by x, left endpoints first, then by y); a line `sweep` moves to each event; the sweep-line status is a side array (ADR 0029) of segment names from bottom to top; each insertion and deletion tests the neighbours with SEGMENTS-INTERSECT, the pair tested `highlight`ed, and the first intersecting pair is `select`ed and returned. Vertical segments are refused, as CLRS assumes none.
- `graham-scan`: 3 to 24 points, not all on one line. p0, the lowest (leftmost on a tie), is found; the others are sorted by polar angle with cross products, keeping the farthest of collinear points; the stack is a side `stack` of point names and the hull so far its segments, which a pop removes. At the end the hull's vertices are settled and its edges selected, and the vertices are returned in counterclockwise order.
- `jarvis-march`: the same points; from p0, each next vertex is the point that leaves every other point on its left, found by keeping a candidate and replacing it with any point to its right by a cross product (`compare` on the three points); this walks CLRS's right chain and then its left chain in one loop. Each hull edge is added and selected, and each vertex settled.
- `closest-pair`: 2 to 16 distinct points. The divide-and-conquer of CLRS: points presorted by x and by y (side arrays), a line `l` at each division, brute force for three or fewer points, and lines `l − δ` and `l + δ` for the strip, where each point is compared with the next points in y order, at most seven; the current closest pair is a `select`ed segment labelled with its distance, rounded to two decimals, and the pair and distance are returned.

### Tests

- Spec: the declaration, the actions, the refusals, the feature and version 0.9; fixtures.
- Core: each action against hand-computed states, marks going with their points and segments, and `plane` in the property tests (a generator, a model and invariants); the scene: points at their scaled coordinates, one region over the trace, y up, the keys above.
- Painters: `npm run test:typst` and `npm run test:latex` on a plane figure, though no painter changes.
- Modules: results against independent implementations (all pairs of segments, a hull by brute force, the closest pair by brute force) on random inputs, collinear and degenerate cases, and a look at each in the gallery.

### Rejected

- **Points as graph nodes with fixed positions.** The graph kind's layout, keys and marks are about vertices and edges; coordinates, lines and a fixed region would be a second kind inside it.
- **Arbitrary lines and polygons.** The four algorithms need vertical lines and segments; a polygon is its segments.
- **Rays for polar angles.** Graham's scan compares angles with cross products, which `compare` on three points shows; rays from p0 to every point would crowd the picture.

## Consequences

- The geometry chapter draws as the textbook draws it: points where they are, the sweep or dividing line, the hull or pair found.
- **Public interfaces:** protocol 0.9: the `plane` kind and its actions; the MCP guide's `kinds/plane.md`; the topic `geometry`; the point and segment notations.
