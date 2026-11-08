// The inputs of the README's table, one figure each: short notations,
// and the structured forms they stand for.
#import "@local/algoviz:0.1.0": algoviz

#set page(width: 16cm, height: auto, margin: 1cm)

// A list, or a sort's values alone.
#for id in ("insertion-sort", "merge-sort", "quicksort") {
  algoviz(id, "5 2 4 6 1 3", width: 50%)
}
#algoviz("insertion-sort", (values: (5, 2, 4, 6, 1, 3)), width: 50%)
#algoviz("binary-search", (values: "1 3 5 7 9", target: 7), width: 50%)
#for id in ("bst.insert", "bst.delete", "bst.search") {
  algoviz(id, (from: "8 3 10 1 6", key: 3), width: 50%)
}
#algoviz("bst", (from: "8 3 10 1 6", ops: "insert 4, delete 3"), width: 50%)
#algoviz("min-heap.push", (from: "5 3 8 1 9 2", value: 0), width: 50%)
#algoviz("inorder-tree-walk", "[4, 2, 6, 1, 3, null, 7]", width: 50%)

// A graph as an edge list, alone or with a start node; and as a dictionary.
#for id in ("bfs", "dijkstra", "bellman-ford", "prim") {
  algoviz(id, "A-B 4, B-C 1, A-C 7", width: 30%)
}
#algoviz("dijkstra", (graph: "A-B 4, B-C 1, A-C 7", source: "C"), width: 30%)
#algoviz(
  "dijkstra",
  (graph: (nodes: ("A", "B"), edges: (("A", "B", 4),)), source: "A"),
  width: 30%,
)
#for id in ("dfs", "kruskal", "floyd-warshall") {
  algoviz(id, "A-B 4, B-C 1, A-C 7", width: 30%)
}
#algoviz("topological-sort", "shirt->tie, tie->jacket, shirt->belt, belt->jacket", width: 50%)
#algoviz("lcs", (first: "ABCBDAB", second: "BDCABA"), width: 60%)
#algoviz("edit-distance", (first: "ABCBDAB", second: "BDCABA"), width: 60%)

// No input: the first example.
#algoviz("kruskal", width: 50%)
