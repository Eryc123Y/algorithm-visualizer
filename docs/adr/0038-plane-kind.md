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

- A point has an id, coordinates and an optional label (shown beside it; the id when absent). Coordinates are finite numbers from −10⁶ to 10⁶; the modules take integers, so their cross products are exact.
- A segment has an id, two distinct point ids for its ends, and an optional label. Ids are unique within the structure, points and segments together (ADR 0007).
- `axes` (default false) draws the x and y axes.
- At most 64 points and 128 segments. The declaration is refused (`INVALID_STRUCTURE`, at the field) for two points at the same coordinates, which would draw as one; a segment end that is not a point; a segment from a point to itself; and two segments between the same two points.

### Actions

| Action          | Fields                 | Effect                                                                                                                      |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `addPoint`      | `point`                | Add a point `{ id, x, y, label? }`.                                                                                         |
| `removePoint`   | `id`                   | Remove a point. A point that ends a segment is refused (`INVALID_OPERATION`): remove the segment first.                     |
| `addSegment`    | `segment`              | Add a segment `{ id, from, to, label? }` between two points.                                                                |
| `removeSegment` | `id`                   | Remove a segment.                                                                                                           |
| `label`         | `segment`, `text`      | Change a segment's label, such as a distance; `null` removes it.                                                            |
| `highlight`     | `points`?, `segments`? | Highlight points and segments (this step); at least one of the two.                                                         |
| `compare`       | `points`               | Mark two or three points as being compared, as an orientation test or a distance does (this step).                          |
| `visit`         | `point`                | Mark a point as considered (persists).                                                                                      |
| `settle`        | `point`                | Mark a point as final, such as a hull vertex (persists).                                                                    |
| `select`        | `segment`, `on`        | Mark a segment as chosen (`on: true`), such as a hull edge, a closest pair or an intersecting pair, or clear it (persists). |
| `pointer`       | `name`, `point`        | A named badge at a point; `null` removes it (persists).                                                                     |
| `line`          | `name`, `x`            | A named vertical line at `x`, such as a sweep line or a dividing line; `null` removes it (persists).                        |

- Errors: an unknown point or segment (`NOT_FOUND`), an id in use (`DUPLICATE_ID`), a point at the coordinates of another or a second segment between two points (`INVALID_OPERATION`), coordinates out of range (`OUT_OF_RANGE`), each at the path of the field.
- A segment's marks go with it; a point's marks go with it. Lines and pointers are by name, at most 8 lines.

### Drawing

- **One region, one scale.** The region is the bounding box of every point and line `x` over the whole trace, padded by a tenth of its size (at least 1 unit), so it is the same in every frame (ADR 0008). It is scaled uniformly to fit a square of side 320 units, keeping the aspect ratio, with y pointing up as in the textbook. The block adds a margin around the square for point labels, pointer badges and line names, so they stay in the scene.
- **Points** are small nodes (`node`, radius 5, no text) at their coordinates, with the label beside (`label`, turned away from the point's segments: the label placement of the graph layout, moved to a shared helper). Roles: `highlight`, `compare`, `visited`, `settled`, as for nodes in any kind, with the same precedence.
- **Segments** are undirected edges (`edge`) between their points, trimmed to the points' circles (a segment shorter than the two radii is drawn untrimmed): `default`, `highlight` while highlighted, `selected` while selected; a highlight wins over a selection for its step. Their labels are edge labels.
- **Lines** are vertical edges across the region, drawn from bottom to top, `highlight`, with their name as the edge label at the top end (`labelAt` 1). A line and a highlighted segment share the role; the line spans the region, so they do not read alike.
- **Axes** are directed edges, `default`, labelled `x` and `y`, under everything else: at x = 0 and y = 0 when those are inside the region, else along its left and lower edges.
- **Pointers** are badges beside their point, stacked when several share one.
- Keys: `<name>/point/<id>`, `<name>/segment/<id>`, `<name>/line/<name>`, `<name>/axis/x` and `/y`, so a line that moves slides and a point keeps its place.
- No new scene item and no new role, so no painter changes.

### Input notation

Each module takes its points (or segments) in a notation or in the structured form, as ADR 0032 has it.

- Points: `(0, 0) (4, 3) (2, 5)`, optionally named, `a(0, 0) b(4, 3)`, with spaces or commas between points (LaTeX passes commas). Structured: `[[0, 0], [4, 3]]` or `[{ "id": "a", "x": 0, "y": 0 }]`. Unnamed points get the names `p0`, `p1`, …, skipping names already given.
- Segments: `(0, 0)-(4, 3), (1, 4)-(5, 0)`, optionally named, `s1: (0, 0)-(4, 3)`. Structured: `[[[0, 0], [4, 3]]]` or `[{ "id": "s1", "from": [0, 0], "to": [4, 3] }]`. Unnamed segments get `s1`, `s2`, …, skipping names given. Equal coordinates in different segments are one point, so segments that share an endpoint share its point.
- Errors are `INVALID_NOTATION` at a character position; a module's other refusals (too many points, all points on one line, a vertical segment) name the problem.

### The modules

A new topic `geometry` holds four algorithms, in CLRS's conventions with indices from 0, in our own words, each with the 3rd edition's cross-product tests for orientation rather than angles.

- `any-segments-intersect`: 1 to 12 segments, none vertical, as CLRS assumes; three segments through one point are allowed, and the answer is still right.
  - Events are the endpoints sorted by x, a left endpoint before a right one at the same x, then by y. A line `sweep` moves to each event.
  - The sweep-line status is a side array (ADR 0029) of segment names from bottom to top, ordered by their y at the sweep line, ties broken by slope and then by name.
  - At a left endpoint the segment is inserted, and tested with SEGMENTS-INTERSECT against the segment just above it and the one just below, if any. At a right endpoint, the segments above and below it are tested against each other, if both exist, and then it is deleted. The pair tested is `highlight`ed.
  - The first intersecting pair is `select`ed and returned; with none, the run ends after the last event and returns that none intersect.
- `graham-scan`: 3 to 24 distinct points, not all on one line.
  - p0 is the lowest point, the leftmost on a tie. The others are sorted by polar angle about p0 with cross products, and of points at the same angle only the farthest is kept. The sorted order is a side array of names; the dropped points are `visit`ed.
  - The stack is a side `stack` of point names, and the hull so far its segments. A point pops the top while the turn from next-to-top through top to the point is not a left turn: collinear pops too, so no hull vertex is collinear. A pop removes its segment.
  - The closing edge from the last point back to p0 is added at the end. Then the hull's vertices are settled and its edges selected, and the vertices are returned counterclockwise from p0.
- `jarvis-march`: the same points.
  - From p0, the candidate for the next vertex starts as the first other point. Each other point replaces it when it lies to the right of the line from the current vertex to the candidate, or on that line and farther away (`compare` on the three points). So no hull vertex is collinear, as in Graham's scan.
  - This walks CLRS's right chain and then its left chain in one loop, and stops when the next vertex is p0. Each hull edge is added and selected, and each vertex settled.
- `closest-pair`: 2 to 16 distinct points, CLRS's divide and conquer.
  - Points are presorted by x (ties by y) and by y, in two side arrays. The recursion splits by position in the x order, not by x value, since several points can share an x.
  - Each call puts the line `l` at its dividing x and moves it back to its caller's when it returns; three or fewer points are compared by brute force.
  - The strip is drawn with lines `l − δ` and `l + δ`. Each point in it is compared with the next points in y order, at most seven.
  - The closest pair so far is a selected segment labelled with its distance, rounded to two decimals; when a closer pair is found, that segment is removed and the new one added and selected. The pair and the distance are returned.

### Tests

- Spec: the declaration, the actions, the refusals, the feature and version 0.9; fixtures.
- Core: each action against hand-computed states, marks going with their points and segments, and `plane` in the property tests (a generator, a model and invariants); the scene: points at their scaled coordinates, one region over the trace, y up, the keys above.
- Painters: `npm run test:typst` and `npm run test:latex` on a plane figure, though no painter changes.
- Modules: results against independent implementations (all pairs of segments, a hull by brute force, the closest pair by brute force) on random integer inputs, collinear points, equal x, shared endpoints and other degenerate cases, notation errors at their positions, and a look at each in the gallery.

### Rejected

- **Points as graph nodes with fixed positions.** The graph kind's layout, keys and marks are about vertices and edges; coordinates, lines and a fixed region would be a second kind inside it.
- **Arbitrary lines and polygons.** The four algorithms need vertical lines and segments; a polygon is its segments.
- **Rays for polar angles.** Graham's scan compares angles with cross products, which `compare` on three points shows; rays from p0 to every point would crowd the picture.

## Consequences

- The geometry chapter draws as the textbook draws it: points where they are, the sweep or dividing line, the hull or pair found.
- **Public interfaces:** protocol 0.9: the `plane` kind and its actions, with the graph layout's label placement moved to a shared helper; the MCP guide's `kinds/plane.md`; the topic `geometry`; the point and segment notations.
