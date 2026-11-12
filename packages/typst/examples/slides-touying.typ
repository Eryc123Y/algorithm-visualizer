// Slides that step through a run with touying: one frame per subslide.
#import "@preview/touying:0.8.0": *
#import themes.simple: *
#import "@local/algoviz:0.1.0": algoviz-slides

#show: simple-theme.with(aspect-ratio: "16-9")

// The graph, as an edge list; Dijkstra's algorithm starts at its first
// node, s.
#let input = "s-a 4, s-b 1, b-a 2, a-c 1, b-c 5, c-t 3"

// touying's own `only` shows each frame on its subslide. The figure fills
// the slide's width and three quarters of its height.
== Dijkstra's algorithm, step by step

#align(center, algoviz-slides(only, "dijkstra", input))

// After #pause, `start` names the subslide the series begins on. Under a
// line of text, the figure takes 60% of the height.
== Settling $a$

The queue hands out $a$, at distance 3, and relaxes its edges.

#pause

#align(center, algoviz-slides(
  only,
  "dijkstra",
  input,
  steps: "extract#3..improve#5",
  start: 2,
  height: 60%,
))

// A section of a run, in the print theme.
== Deleting 3 from a binary search tree

#align(center, algoviz-slides(
  only,
  "bst.delete",
  (from: (8, 3, 10, 1, 6, 4, 7), key: 3),
  steps: "delete-3",
  theme: "print",
))
