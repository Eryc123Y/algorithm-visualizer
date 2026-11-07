// A wrong step or input shows the engine's error in place of the figure.
#import "@local/algoviz:0.1.0": algoviz

#set page(width: 16cm, height: auto, margin: 1cm)

#let graph = (nodes: ("A", "B"), edges: (("A", "B", 1),))

// No such step: the hint lists the step names there are.
#algoviz("dijkstra", (graph: graph, source: "A"), step: "relax#9")

// An input the algorithm's schema rejects.
#algoviz("bst.delete", (from: (8, 3), key: "three"))
