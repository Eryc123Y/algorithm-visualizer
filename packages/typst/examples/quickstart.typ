// A figure of one step: an algorithm, its input and a step name.
#import "@local/algoviz:0.1.0": algoviz

#set page(width: 16cm, height: auto, margin: 1cm)

#let graph = (
  nodes: ("A", "B", "C", "D"),
  edges: (("A", "B", 4), ("B", "C", 1), ("A", "C", 7), ("C", "D", 2)),
)

#figure(
  algoviz("dijkstra", (graph: graph, source: "A"), step: "improve#3"),
  caption: [Dijkstra's algorithm from A: the edge from B improves C from 7 to 5.],
)

// The last frame is the default.
#figure(
  algoviz("insertion-sort", (values: (5, 2, 4, 6, 1, 3)), width: 70%),
  caption: [Insertion sort, finished.],
)
