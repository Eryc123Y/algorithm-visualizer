# 0023. The remaining recipes as registry modules: ids, inputs and procedures

## Status

Accepted

## Context

Roadmap 0.5 moves the last 22 recipes into the registry (ADR 0019, ADR 0022) and then removes the legacy path. Each recipe is rewritten once, into its final form, so the questions ADR 0022 settled for sorting come back for every other topic:

- **Ids and inputs** become public names, so they are fixed here once.
- **Structures or algorithms.** Requirement R2 says every data structure offers each operation on its own, from a state the user describes (ADR 0018). Five recipes build a structure from scratch: AVL insert, trie insert, union–find and the two hash tables.
- **`bstInsert` and `binaryHeap`** show a whole life of a structure the registry already has (`bst`, `min-heap`).
- **Procedures.** Several recipes are not the procedures of CLRS: depth-first search starts from one vertex, topological sort uses Kahn's algorithm, Dijkstra's algorithm and Bellman–Ford stop early, and the hash table appends to its chains.
- **States.** A structure's `after` must rebuild the same state through `from`. That is easy for a BST (its keys in preorder), but not for every structure: an AVL tree built from its preorder rotates, a linear-probing table depends on the order of insertion, and path compression leaves a forest that no list of unions describes.

## Decision

**Modules and ids.** Where CLRS names a procedure with an abbreviation (BFS, DFS, LCS), the id uses it.

| Topic               | Id                                                                 | Input                                            |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| searching           | `binary-search`                                                    | `{ values, target }`; values sorted              |
| lists               | `reverse-linked-list`                                              | `{ values }`                                     |
| lists               | `balanced-brackets`                                                | `{ text }`                                       |
| trees               | `avl`, `avl.insert`                                                | `from`: keys in insertion order                  |
| trees               | `inorder-tree-walk`, `preorder-tree-walk`, `postorder-tree-walk`   | `{ levelOrder }`, with `null` for gaps           |
| trees               | `trie`, `trie.insert`, `trie.search`                               | `from`: words                                    |
| trees               | `disjoint-set`, `disjoint-set.union`, `disjoint-set.find-set`      | `from`: `{ size, unions }` or `{ parent, rank }` |
| hashing             | `hash-chaining`, `hash-chaining.insert`, `hash-chaining.search`    | `from`: `{ size, keys }`                         |
| hashing             | `linear-probing`, `linear-probing.insert`, `linear-probing.search` | `from`: `{ size, keys }`                         |
| graphs              | `bfs`, `dijkstra`, `bellman-ford`                                  | `{ graph, source }`                              |
| graphs              | `prim`                                                             | `{ graph, root }`                                |
| graphs              | `dfs`, `topological-sort`, `kruskal`, `floyd-warshall`             | `{ graph }`                                      |
| dynamic programming | `lcs`, `edit-distance`                                             | `{ first, second }`                              |
| dynamic programming | `knapsack`                                                         | `{ items, capacity }`                            |

- A graph is `{ nodes, edges, directed? }` as today: up to 40 node names, and up to 200 edges `[from, to]` or `[from, to, weight]`, weight 1 by default. Neighbours are taken in the order the edges are listed.
- The three tree walks are three modules rather than one with an `order` option, so each has fixed code: `INORDER-TREE-WALK`, `PREORDER-TREE-WALK` and `POSTORDER-TREE-WALK`.
- The limits of today's recipes stay: 32 sorted values, a list of 12, 32 characters of text, 16 characters per string, 8 knapsack items and a capacity of 40, 16 disjoint-set elements, 16 hash slots or buckets.

**Whole runs.** `bstInsert` and `binaryHeap` become examples of the sequences, as ADR 0019 planned for whole-life demos: `bst` from `[]` with seven inserts and a search, and `min-heap` from `[]` with four pushes and four pops. A sequence runs at most 8 operations; a longer demo starts from a larger `from`.

**Structures.** Each is made with `defineStructure`. Its `after` rebuilds the same state.

- **AVL tree.** `insert` is recursive: it descends as in a BST, then on the way back updates each height and rebalances with one or two rotations. Keys are distinct: inserting a key the tree holds changes nothing, which one step says. A run with equal keys would rotate an equal key to the left of its twin and break the order a later search relies on. `after` lists the keys in level order, which rebuild the same tree with no rotation, since every prefix of a level order is balanced. At most 32 keys.
- **Trie.** `insert` adds a word, creating missing children in alphabetical order, and marks the node that ends it. `search` follows the word and reports whether its last node is marked. `after` lists the words in alphabetical order; the shape does not depend on the order of insertion. At most 8 words of 1 to 16 characters.
- **Disjoint sets.** A disjoint-set forest with union by rank and path compression, as in CLRS: `find-set` follows parents to the root and then hangs every node on the path under it; `union` links the root of lower rank under the other, raising the rank on a tie. `from` is `{ size, unions }`, unions replayed silently, or `{ parent, rank }`, checked: every parent is an element, the parents lead to a root without a cycle, and ranks rise strictly from child to parent. `after` is `{ parent, rank }`.
- **Hash tables** with `h(k) = k mod m`, the integer keys taken with a non-negative remainder.
  - **Chaining** inserts a key at the head of its chain, as CLRS does, and searches the chain from the head. At most 24 keys.
  - **Linear probing** probes `h(k, i) = (h(k) + i) mod m` for `i = 0, 1, …`. Insert stops at the first empty slot; inserting into a full table is refused. Search stops at the key, at an empty slot, or after `m` probes.
  - Neither deletes, as today. `from` is `{ size, keys }`, inserted silently; `after` gives the keys in the order they were inserted, which rebuilds the same chains and slots.

**Procedures.** The modules follow CLRS where it has the procedure, written in our own words with indices from 0.

- **Binary search** keeps `lo` and `hi` and halves them. Values that are not sorted are refused, naming the first pair out of order.
- **Breadth-first search** colours vertices white, grey and black (shown as unvisited, visited and settled), annotates each with its distance `d`, marks the edge to its parent `π`, and shows the queue.
- **Depth-first search** is `DFS` and a recursive `DFS-VISIT` over every vertex in the order listed, so a graph with several components gives a forest. Each vertex is annotated with its discovery and finishing times, tree edges are marked, and the call stack is shown. Today's recipe starts from one vertex.
- **Topological sort** is CLRS's: a depth-first search that puts each vertex at the front of the list as it finishes. Edges are taken as directed. A graph with a cycle has no topological order and is refused, naming a cycle. Kahn's algorithm goes; it may return later as a module of its own.
- **Dijkstra's algorithm** initializes every `d` to ∞ and `d[s]` to 0, then extracts the vertex of least `d` from a min-priority queue until the queue is empty and relaxes every edge leaving it. A vertex extracted with `d = ∞` is unreachable, and the run goes on to the end rather than stopping. Negative weights are refused.
- **Bellman–Ford** relaxes every edge in each of `|V| − 1` rounds without stopping early, then checks every edge once more and reports a negative cycle if one can still be relaxed. Edges are taken as directed. To keep documents readable, a step shows each round and each improvement, not each test that improves nothing; a round that improves nothing says so.
- **Prim's algorithm** is `MST-PRIM` from a root, with keys and parents and a min-priority queue. A vertex extracted with key ∞ starts a new tree, so a disconnected graph gives a minimum spanning forest.
- **Kruskal's algorithm** is `MST-KRUSKAL`: edges by weight (ties in the order listed), and a disjoint-set forest with union by rank and path compression drawn beside the graph.
- **Floyd–Warshall** updates one distance matrix in place. As today, it skips the entries that cannot change (through-paths of ∞, and row and column `k` unless `d[k][k] < 0`), and a negative diagonal entry reports a negative cycle.
- **Longest common subsequence** is `LCS-LENGTH` with dependency arrows in place of CLRS's table of arrows, then a traceback that settles the matched cells.
- **Edit distance** is Levenshtein's: copy at cost 0, and replace, insert and delete at cost 1, then a traceback.
- **0/1 knapsack** fills `K[i][c]`, the best value of the first `i` items within capacity `c`, then traces back the items taken.
- **Reversing a linked list** turns each link around with `prev`, `curr` and `next`. **Balanced brackets** pushes openers onto a stack and pops one for each closer.

**Shared code.** The graph helpers (edge ids, adjacency, the declaration and input checks) move to `src/algorithms/graphs/graph.ts`, and the graph input schema is defined once there.

## Consequences

- Every recipe is a registry module, so the legacy path can go: the old functions, `packages/mcp/src/legacy-recipes.ts`, `apps/playground/src/samples/legacy.ts` and the CLI's `recipe` command.
- Documents change where procedures change: depth-first search covers every vertex, topological sort shows finishing times instead of in-degrees, Dijkstra's algorithm and Bellman–Ford show the steps CLRS takes after the answer is known, and chains grow at the head. Their reference and property tests change with them.
- AVL trees no longer take equal keys, and binary search no longer takes unsorted values.
- `bst` and `min-heap` hold the whole-life demos, limited to 8 operations.
- Ids such as `bfs`, `lcs` and `prim` are public from now on; renaming one later needs an alias.
