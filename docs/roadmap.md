# Roadmap to 1.0

How the [requirements](requirements.md) get built, in order. Each item is one pull request unless it says otherwise. Mark an item `[x]` with its PR in the same pull request that finishes it, and `[~]` while it is in progress.

- **ADR first.** Items marked _ADR_ start with a decision record in `Proposed` status, and the owner approves it before any code. This applies to every protocol change, new kind, public API and package interface.
- **Owner decides.** Items marked _owner_ wait for a choice only the owner makes (visual style, names, publishing).

## Phase 0: foundations

Everything later builds on these, so they come first.

- [ ] **0.1 Algorithm registry** _ADR_. One module type for every algorithm and every data-structure operation. A module has:
  - a stable id;
  - a Zod input schema, the only definition of its input;
  - example inputs;
  - code per language, with shared `# @anchor` markers;
  - `run(input, tape)`.

  The MCP catalogue, the CLI, the playground menu, the documentation and the tests derive from the registry. The Zod input schemas move from `packages/mcp` to the modules.

- [ ] **0.2 Migrate existing recipes** to the registry: the 29 recipes and `ops.bst` and `ops.heap`. Documents stay the same apart from what 0.3 adds; the existing reference tests prove it.
- [ ] **0.3 Named steps and sections** _ADR_ (protocol).
  - Each step has an optional stable `id`, for example `fixup-case-3`, and each operation forms a section.
  - The player, the CLI and MCP select frames by "section / step id".
  - Recipes emit ids for the steps a learner would point at.
- [ ] **0.4 Protocol versioning** _ADR_. Rules for minor (additive) and major (breaking) versions, an `upgrade(document)` function, and when the format freezes as 1.0. It freezes after Phase 2's structure additions, so 1.0 does not need a break soon after.
- [ ] **0.5 Pseudocode as a language.** CLRS conventions:
  - `for … to`, `downto`;
  - `=` for assignment;
  - `//` comments;
  - `NIL`, `TRUE`, `FALSE`;
  - 1-based arrays where the book uses them.

  The work has four parts:
  - a highlighter;
  - a language switch in the player;
  - anchors shared with Python;
  - a test that every anchor a recipe uses exists in every language, and that every step's line is valid in each.

## Phase 1: static output and packages

- [ ] **1.1 Text measurement and fonts** _ADR_. Layout measures text with real glyph widths from a bundled font instead of an average character width (`charWidthRatio`). SVG output embeds or outlines that font, so figures look the same in any document.
- [ ] **1.2 `algoviz export`.**
  - Select steps by "section / step id", by a range, or all of them.
  - Write SVG files.
  - A series shares one set of layout metrics (`layoutState` already takes metrics), so all its figures have one scale.
  - Also run a registry algorithm on an input directly, without writing a document first.
- [ ] **1.3 Typst package** _ADR_.
  - First, a prototype that runs the engine (spec, core, svg and the registry) inside a Typst WebAssembly plugin, for example through a JavaScript engine compiled to WebAssembly. Measure its size and speed.
  - Then the package, for example `#algoviz("dijkstra", (graph: …, source: "A"), step: "relax-3")` or `#algoviz(json("doc.json"), step: …)`, returning the SVG as an image.
- [ ] **1.4 LaTeX package** _ADR_.
  - `\algoviz[step=relax-3]{dijkstra}{<input>}` and a document form. The package calls the `algoviz` command through shell escape (as `minted` does) and caches the output.
  - Output is TikZ from a new painter, so text uses the document's fonts and Beamer overlays fit inside one picture.
  - A standalone `algoviz` executable spares users from installing Node.js.
- [ ] **1.5 Slides.** One overlay per step: `\only<n>` in Beamer, and the equivalent in Typst slide frameworks (polylux, touying). The overlays come from the same step selection as 1.2.
- [ ] **1.6 Built-in themes.**
  - Turn every theme-lab direction into a named built-in theme next to light, dark and print.
  - Keep the current light theme as the default, and refine it where it looks unnatural: a design pass with the frontend-design skill and a design subagent.
  - Every theme is tested on every kind and output (contrast, print, the Typst and LaTeX packages).
  - The README and the docs site show how to switch themes.
  - Delete the lab.
  - The owner sees before-and-after screenshots before it merges.
- [ ] **1.7 Painter fixes** found during theme work:
  - check marks on graph and tree nodes stick out of the circle;
  - radii in the code panel and buttons are hard-coded instead of theme tokens.

## Phase 2: CLRS coverage

Each entry is one registry module, or one per operation for data structures. Each one meets the quality bar in the requirements. Unmarked entries need only a recipe. Entries marked with a structure addition (S1–S9, table below) wait for it.

**I Foundations**

- [x] insertion sort
- [x] merge sort
- [ ] Strassen matrix multiplication
- [ ] recursion trees for divide and conquer
- [ ] random permutation (randomize in place)

**II Sorting and order statistics**

- [x] heapsort
- [x] max-heap operations (`ops.heap`)
- [x] quicksort
- [x] counting sort
- [ ] randomized quicksort
- [ ] radix sort
- [ ] bucket sort
- [ ] randomized select
- [ ] select (median of medians)

**III Data structures**

- [ ] stack, queue and linked-list operations (search, insert, delete)
- [x] separate chaining
- [x] linear probing
- [ ] quadratic probing
- [ ] double hashing
- [x] BST operations (`ops.bst`)
- [x] tree walks
- [ ] red–black tree: insert (S2), delete (S2)

**IV Design and analysis**

- [x] LCS
- [ ] rod cutting
- [ ] matrix-chain multiplication
- [ ] optimal BST
- [ ] activity selection
- [ ] Huffman codes (S1, S4)
- [ ] offline caching
- [ ] dynamic tables and binary counter (amortized analysis)

**V Advanced data structures**

- [ ] order-statistic tree (S3)
- [ ] interval tree (S3)
- [ ] B-tree: search, insert, delete (S6)
- [x] disjoint sets (union by rank, path compression)
- [ ] Fibonacci heap: insert, union, extract-min, decrease-key, delete (S1, S3, S5)

**VI Graph algorithms**

- [x] BFS
- [x] DFS
- [x] topological sort
- [x] Dijkstra
- [x] Bellman–Ford
- [x] Floyd–Warshall
- [x] Prim
- [x] Kruskal
- [ ] strongly connected components
- [ ] DAG shortest paths
- [ ] transitive closure
- [ ] Johnson
- [ ] Edmonds–Karp maximum flow
- [ ] bipartite matching
- [ ] Hopcroft–Karp
- [ ] stable matching (Gale–Shapley)
- [ ] Hungarian algorithm

**VII Selected topics**

- [ ] move-to-front (S7)
- [ ] LUP decomposition
- [ ] FFT
- [ ] Euclid and extended Euclid
- [ ] modular exponentiation
- [ ] string matching: naive, Rabin–Karp, finite automaton, KMP (S9)
- [ ] suffix array
- [ ] approximation: vertex cover, TSP tour, set cover
- [ ] computational geometry, 3rd edition: segment intersection, Graham scan, Jarvis march, closest pair (S8)

Recipes that exist beyond CLRS stay: bubble and selection sort, binary search, list reversal, bracket matching, AVL, trie, binary heap run, edit distance and 0/1 knapsack.

**Structure additions** (each _ADR_; S1–S5 can share one ADR for `tree`):

| #   | Addition                                                                    | Needed by                                          |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| S1  | Root order in a forest: a `slot` on root insert and detach                  | Fibonacci heap, Huffman                            |
| S2  | Pointer at an empty child slot (`NIL`)                                      | red–black delete, insertion points                 |
| S3  | Several notes per node, such as `deg`, `mark` and `size`                    | Fibonacci heap, order-statistic and interval trees |
| S4  | Edge marks and edge labels in `tree`                                        | Huffman 0/1, search paths                          |
| S5  | Root-list links (`list` or `circular`)                                      | Fibonacci heap                                     |
| S6  | `btree` kind: several keys per node, key ids, and child edges from key gaps | B-trees                                            |
| S7  | `move` in `linkedList`                                                      | move-to-front                                      |
| S8  | `plane` kind: points, segments, a sweep line and axes                       | computational geometry                             |
| S9  | Pattern alignment in `array`: a second row at a shifting offset             | string matching                                    |

## Phase 3: remote MCP and sharing

Independent of Phase 2, so the two can interleave.

- [ ] **3.1 Streamable HTTP transport** for the MCP server, next to stdio. The server and the MCP App page must run on Workers.
- [ ] **3.2 Cloudflare Worker** with a "Deploy to Cloudflare" button. It is stateless and rate-limited, and its README shows how to connect Claude and other clients.
- [ ] **3.3 Share links.** A player page that reads a compressed document from the URL fragment. MCP tools return the link alongside the document.
- [ ] **3.4 Documentation site** on Cloudflare Pages, generated from the registry. It is grouped structure → operation, with the player and the export snippets for every algorithm.

## Phase 4: release 1.0

- [ ] **4.1 Name** _owner_. Check availability on npm, Typst Universe and CTAN.
- [ ] **4.2 Freeze the protocol at 1.0** under 0.4's rules. Regenerate the JSON Schema and fixtures.
- [ ] **4.3 Publish** _owner_: npm packages, the CDN bundle, the Typst package, the LaTeX package and the standalone executable.
- [ ] **4.4 Release check.**
  - Deep fuzz (`FUZZ_RUNS=5000`) and the full E2E suite pass.
  - Evals cover the new kinds.
  - Bundle sizes are measured.
  - The README and the guide are up to date.

## After 1.0

- More languages: C++, Java and JavaScript (ADR 0017).
- More structures: B+ tree, skip list, binomial and pairing heaps, treap, splay tree, segment and Fenwick trees, LRU cache.
- An A2UI adapter.
- Third-party structure kinds.
- Links between structures, such as an array entry pointing at a tree node.
