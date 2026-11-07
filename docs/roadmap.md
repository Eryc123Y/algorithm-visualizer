# Roadmap to 1.0

How the [requirements](requirements.md) get built, in order. Each item is one pull request unless it says otherwise. Mark an item `[x]` with its PR in the same pull request that finishes it, and `[~]` while it is in progress.

- **ADR first.** Items marked _ADR_ start with a decision record, which Claude reviews, accepts and merges on its own before any code (the owner waived approval on 2026-11-07). This applies to every protocol change, new kind, public API and package interface.
- **Owner decides.** Items marked _owner_ wait for something only the owner does: names, publishing, accounts.

## Phase 0: foundations

Everything later builds on these, so they come first. The ADRs are accepted (#13). The protocol changes come before the registry, so each recipe is rewritten only once, straight into its final form: a registry module with anchors, step names and code in both languages.

- [x] **0.1 Protocol versioning** [ADR 0021](adr/0021-protocol-versioning.md) (#14).
  - `version` becomes `"major.minor"`; the parser reads every `0.x` up to the current one and rejects newer ones with a hint.
  - The JSON Schema and fixtures follow.
  - Writers record the oldest version that holds what the document uses.
- [x] **0.2 Step names and sections** [ADR 0020](adr/0020-step-names-and-sections.md) (protocol `0.2`). Split in two PRs: the spec, core selectors, recipes and MCP (#15), then the player (#16).
  - `meta.id` and `sections` in the spec, with validation.
  - Their entries in the protocol feature table (`PROTOCOL_FEATURES`), and a parser check that a document's `version` is not older than the features it uses (from the review of #14).
  - Selectors in core, used by the player's `frame` attribute and by `algoviz_inspect` and `algoviz_render`.
  - Section marks on the player's timeline, and the guide and fixtures.
- [x] **0.3 Sources in two languages** [ADR 0017](adr/0017-multi-language-source.md) (protocol `0.3`). Split in two PRs: the spec, the highlighter, recording, `ops.bst` and `ops.heap` in pseudocode, MCP and the guide (#17), then the player's language switcher (#18).
  - `sources` with anchors, and `meta.at`, with validation.
  - The pseudocode highlighter (CLRS conventions, 0-based indices).
  - The language switch in the player.
  - The guide and fixtures.
- [ ] **0.4 Algorithm registry** [ADR 0019](adr/0019-algorithm-registry.md).
  - `Algorithm<I>`, `Trace` (merging `Recorder` and `Tape`), `defineStructure`, `runAlgorithm` and the generic test suite.
  - MCP, the CLI and the playground read the registry.
  - The first modules are the sorting algorithms, in both languages.
- [ ] **0.5 Migrate the remaining recipes** into the registry, in both languages: `ops.bst`, `ops.heap` and the rest of the 29 recipes. Then the old recipe functions and the MCP catalogue are removed. This may take several PRs, one per topic.

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
  - Before-and-after screenshots go in the PR and the report.
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
