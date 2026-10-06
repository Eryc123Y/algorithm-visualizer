# 0013. Node-link layout: stable positions, routed edges, free-space labels

- Status: Accepted
- Date: 2026-10-06

## Context

Trees and graphs are drawn as nodes joined by edges. Teaching needs layouts that are deterministic (the same document always looks the same), stable (a node does not jump while the algorithm runs) and legible (edges do not run through nodes, labels do not sit on lines). General graph drawing is a research field; we need good results for the small graphs of a lecture, with no dependencies (ADR 0003).

## Decision

**Shapes.** Nodes are circles sized to their text. Text that does not fit a circle of radius 26 first shrinks to at least 13 px, then stretches the node into a stadium; edges are trimmed to either outline.

**Trees** (and the array heap view) are recomputed every frame, because their shape is what the algorithm changes: binary trees in in-order (one column per node, so nothing overlaps and left subtrees are always left), other trees with leaves side by side and parents centred over their children, forests left to right. Frame size comes from metrics merged over the trace.

**Graphs** are placed once per trace. The metrics collect every node and edge that ever exists, and the arrangement is computed from that union and cached by metrics identity, so nodes never move and a node added later already has its place:

- `circle`: clockwise from the top, in order of first appearance;
- `layered`: directed graphs rank nodes by longest path after dropping depth-first back edges; undirected graphs rank by breadth-first distance from the first node of each component. Rows are ordered by barycentre sweeps;
- `grid` and `manual` (each node's `x`, `y`);
- `auto` (default): manual if every node has coordinates, layered for acyclic directed graphs, otherwise circle.

**Edges.** In layered layouts, an edge spanning several rows passes through a dummy node in each row between (Sugiyama), and is drawn through those bend points (`SceneEdge.via`); an edge within a row that would cross nodes bows into the gap above. Parallel and antiparallel edges are spread perpendicular to their shared line, with labels on the outer side (`labelSide`). Edge labels sit beside the midpoint at a distance that clears the line for any slope.

**Free directions.** Self-loops and node notes (e.g. distances) point in the first direction, in order of preference, that is at least 40° from every edge of that node in any frame; notes prefer up, the left is kept for pointer badges. These are `loopAngle` and `labelAngle` in the scene.

## Consequences

- Positions are deterministic and stable, so animation shows only what the algorithm changes.
- Bent edges are painted as paths and switch instantly between frames instead of tweening; within a trace an edge keeps its routing, so this only matters across documents.
- Known limits: crossings are reduced, not minimised; straight edges in circle layouts can pass near other nodes in dense graphs; a long-name graph in a narrow player is scaled down. Force-directed layout is deliberately absent because it is not deterministic without care; `manual` covers hand-drawn figures.
