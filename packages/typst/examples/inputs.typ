// The inputs of the README's table, one figure each.
#import "@local/algoviz:0.1.0": algoviz

#set page(width: 16cm, height: auto, margin: 1cm)

#let graph = (nodes: ("A", "B"), edges: (("A", "B", 4),))

#for id in ("insertion-sort", "merge-sort", "quicksort") {
  algoviz(id, (values: (5, 2, 4, 6, 1, 3)), width: 50%)
}
#algoviz("binary-search", (values: (1, 3, 5, 7, 9), target: 7), width: 50%)
#for id in ("bst.insert", "bst.delete", "bst.search") {
  algoviz(id, (from: (8, 3, 10, 1, 6), key: 3), width: 50%)
}
#algoviz("min-heap.push", (from: (5, 3, 8, 1, 9, 2), value: 0), width: 50%)
#for id in ("bfs", "dijkstra", "bellman-ford") {
  algoviz(id, (graph: graph, source: "A"), width: 30%)
}
#algoviz("prim", (graph: graph, root: "A"), width: 30%)
#for id in ("dfs", "kruskal", "floyd-warshall") {
  algoviz(id, (graph: graph), width: 30%)
}
#algoviz("lcs", (first: "ABCBDAB", second: "BDCABA"), width: 60%)
#algoviz("edit-distance", (first: "ABCBDAB", second: "BDCABA"), width: 60%)
