// Slides that step through a run with polylux: one frame per subslide.
#import "@preview/polylux:0.4.0": *
#import "@local/algoviz:0.1.0": algoviz-slides

#set page(paper: "presentation-16-9", margin: 1.5cm)
#set text(size: 20pt)

// The graph, as an edge list; Dijkstra's algorithm starts at its first
// node, s.
#let input = "s-a 4, s-b 1, b-a 2, a-c 1, b-c 5, c-t 3"

// polylux's own `only` shows each frame on its subslide.
#slide[
  == Dijkstra's algorithm, step by step
  #align(center, algoviz-slides(only, "dijkstra", input, height: 75%))
]

// A range of steps, starting on the second subslide.
#slide[
  == Settling $a$
  The queue hands out $a$, at distance 3, and relaxes its edges.

  #align(center, algoviz-slides(
    only,
    "dijkstra",
    input,
    steps: "extract#3..improve#5",
    start: 2,
    height: 60%,
  ))
]

// A section of a run, in the print theme.
#slide[
  == Deleting 3 from a binary search tree
  #align(center, algoviz-slides(
    only,
    "bst.delete",
    (from: (8, 3, 10, 1, 6, 4, 7), key: 3),
    steps: "delete-3",
    theme: "print",
    height: 75%,
  ))
]
