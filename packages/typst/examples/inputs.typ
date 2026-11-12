// The inputs of the README's table, one figure each: short notations,
// and the structured forms they stand for.
#import "@local/algomotion:0.1.0": algomotion

#set page(width: 16cm, height: auto, margin: 1cm)

// A list, or a sort's values alone.
#for id in ("insertion-sort", "merge-sort", "quicksort") {
  algomotion(id, "5 2 4 6 1 3", width: 50%)
}
#algomotion("insertion-sort", (values: (5, 2, 4, 6, 1, 3)), width: 50%)
#algomotion("binary-search", (values: "1 3 5 7 9", target: 7), width: 50%)
#for id in ("bst.insert", "bst.delete", "bst.search") {
  algomotion(id, (from: "8 3 10 1 6", key: 3), width: 50%)
}
#algomotion("bst", (from: "8 3 10 1 6", ops: "insert 4, delete 3"), width: 50%)
#algomotion("min-heap.push", (from: "5 3 8 1 9 2", value: 0), width: 50%)
#algomotion("inorder-tree-walk", "[4, 2, 6, 1, 3, null, 7]", width: 50%)

// A graph as an edge list, alone or with a start node; and as a dictionary.
#for id in ("bfs", "dijkstra", "bellman-ford", "prim") {
  algomotion(id, "A-B 4, B-C 1, A-C 7", width: 30%)
}
#algomotion("dijkstra", (graph: "A-B 4, B-C 1, A-C 7", source: "C"), width: 30%)
#algomotion(
  "dijkstra",
  (graph: (nodes: ("A", "B"), edges: (("A", "B", 4),)), source: "A"),
  width: 30%,
)
#for id in ("dfs", "kruskal", "floyd-warshall") {
  algomotion(id, "A-B 4, B-C 1, A-C 7", width: 30%)
}
#algomotion("topological-sort", "shirt->tie, tie->jacket, shirt->belt, belt->jacket", width: 50%)
#algomotion("lcs", (first: "ABCBDAB", second: "BDCABA"), width: 60%)
#algomotion("edit-distance", (first: "ABCBDAB", second: "BDCABA"), width: 60%)

// No input: the first example.
#algomotion("kruskal", width: 50%)
