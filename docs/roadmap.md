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
  - Selectors in core, used by the player's `frame` attribute and by `algomotion_inspect` and `algomotion_render`.
  - Section marks on the player's timeline, and the guide and fixtures.
- [x] **0.3 Sources in two languages** [ADR 0017](adr/0017-multi-language-source.md) (protocol `0.3`). Split in two PRs: the spec, the highlighter, recording, `ops.bst` and `ops.heap` in pseudocode, MCP and the guide (#17), then the player's language switcher (#18).
  - `sources` with anchors, and `meta.at`, with validation.
  - The pseudocode highlighter (CLRS conventions, 0-based indices).
  - The language switch in the player.
  - The guide and fixtures.
- [x] **0.4 Algorithm registry** [ADR 0019](adr/0019-algorithm-registry.md), refined by [ADR 0022](adr/0022-registry-details.md) (#19). Split in three PRs:
  - `Algorithm<I>`, `Trace` (merging `Recorder` and `Tape`), `defineStructure`, `runModule`, `runAlgorithm` and the generic test suite, proven by moving `ops.bst` and `ops.heap` onto `defineStructure` as `bst`, `min-heap` and `max-heap` (#20).
  - MCP, the CLI (`algomotion run <id> <input>`) and the playground read the registry; recipes not migrated yet stay reachable through a marked legacy path (#21).
  - The seven sorting algorithms as modules in both languages, following the CLRS procedures; their old recipe functions go (#22).
- [x] **0.5 Migrate the remaining recipes** into the registry, in both languages, with ids, inputs and procedures from [ADR 0023](adr/0023-remaining-modules.md): the other 22 recipes, with `bstInsert` and `binaryHeap` as examples of the `bst` and `min-heap` sequences. Then the legacy path is removed: the old recipe functions, `packages/mcp/src/legacy-recipes.ts`, `apps/playground/src/samples/legacy.ts` and the CLI's `recipe` command. ADR 0023 (#23), one PR per topic, then one for the removal:
  - searching, lists and hashing: `binary-search`, `reverse-linked-list`, `balanced-brackets`, `hash-chaining` and `linear-probing` (#24).
  - trees: `avl`, `inorder-tree-walk`, `preorder-tree-walk`, `postorder-tree-walk`, `trie` and `disjoint-set`, and the whole-life examples of `bst` and `min-heap` (#25).
  - graphs: `bfs`, `dfs`, `topological-sort`, `dijkstra`, `bellman-ford`, `prim`, `kruskal` and `floyd-warshall` (#26).
  - dynamic programming: `lcs`, `edit-distance` and `knapsack` (#27).
  - the legacy path removed: the old functions went with each topic; then `legacy-recipes.ts`, the playground's `legacy.ts` and the CLI's `recipe` command (#28).

## Phase 1: static output and packages

- [x] **1.1 Text measurement and fonts** _ADR_ [ADR 0024](adr/0024-text-measurement-and-fonts.md). Layout measures text with real glyph widths from a bundled font instead of an average character width (`charWidthRatio`). SVG output embeds or outlines that font, so figures look the same in any document. ADR 0024 (#29), then three PRs:
  - `@algomotion/fonts`: the generator, metrics and outlines of JetBrains Mono SemiBold and Inter SemiBold, and `textWidth` (#30).
  - layout measures with the theme's font metrics; painters place labels with them; fixtures with wide values (#31).
  - standalone SVG draws text as outlines; the MCP render tool keeps text (#32).
- [x] **1.2 `algomotion export`** _ADR_ [ADR 0025](adr/0025-exporting-figures.md) (#34), then `selectSeries`, `exportFigures` and the command (#35).
  - Select steps by "section / step id", by a range, or all of them.
  - Write SVG files.
  - A series shares one set of layout metrics (`layoutState` already takes metrics), so all its figures have one scale.
  - Also run a registry algorithm on an input directly, without writing a document first.
- [x] **1.3 Typst package** _ADR_ [ADR 0026](adr/0026-typst-package.md). A prototype measured QuickJS-ng and Boa in a Typst WebAssembly plugin; ADR 0026 records the numbers and picks QuickJS-ng (#36). Then two PRs:
  - the plugin: QuickJS-ng in a Rust crate, the engine entry with its cache, `prepareFigures` in `@algomotion/svg`, the builds of `plugin.wasm` and `engine.bc`, and the Node tests (#37).
  - the package: `#algomotion("dijkstra", (graph: …, source: "A"), step: "relax#3")` or `#algomotion(json("doc.json"), step: …)` returning the SVG as an image, `algomotion-series`, themes, errors in the document, `typst.toml`, the README with examples, and the Typst tests (#38).
- [x] **1.4 LaTeX package** _ADR_ [ADR 0027](adr/0027-latex-package.md). The package calls the `algomotion` command through shell escape (as `minted` does) and caches what it writes. The command writes TikZ from a new painter, so text uses the document's fonts and Beamer overlays fit inside one picture. A standalone `algomotion`, the CLI in QuickJS-ng, spares users from installing Node.js; ADR 0027 measures it against Node SEA and bun. ADR 0027 (#39), then three PRs:
  - the TikZ painter: `@algomotion/tikz` on the SVG painter's shapes, and `prepareScenes` in `@algomotion/svg` (#40).
  - the command: `algomotion export --format tikz`, `--input-hex` and `--error-file`, and the standalone executable with its build script and tests (#41).
  - the package: `\algomotion[step=relax#3]{dijkstra}{<input>}`, `\algomotionfile` for a document or an input file, `\algomotioninput`, the cache, errors in the document, the README with examples, and compile tests with pdfLaTeX, LuaLaTeX and XeLaTeX (#42).
- [x] **1.5 Slides** _ADR_ [ADR 0028](adr/0028-slides.md) (#43). One overlay per step: `\only<n>` in Beamer, and the equivalent in Typst slide frameworks (polylux, touying). The overlays come from the same step selection as 1.2. ADR 0028, then one PR (#44):
  - `algomotion export --one-file`, which writes a series into one TikZ file; the LaTeX keys `steps` and `start`, which draw a series as Beamer overlays in one picture; `algomotion-slides` in Typst, through polylux's or touying's `only`; examples whose prose matches their steps; compile tests with pdfLaTeX, LuaLaTeX, polylux 0.4.0 and touying 0.8.0.
- [x] **1.8 Auxiliary structures** _ADR_ [ADR 0029](adr/0029-auxiliary-structures.md) (#46) (added 2026-11-08 at the owner's request; it comes before 1.6, so the themes cover its kinds and placements). Figures show the structures an algorithm keeps besides its main one, in a sensible place next to it, not the main structure alone. ADR 0029 (protocol `0.4`), then three PRs:
  - placement: `place: "side"` on any structure, and the `wide` and `narrow` layouts in core, the CLI, the player and the Typst and LaTeX packages (#47);
  - the `priorityQueue` kind and the `heap` view of `array` (#48);
  - the recipes (#49):
    - Dijkstra's and Prim's queue `Q`, and Kruskal's edges in a table sorted by weight, with the disjoint sets on the side;
    - heaps and heapsort in the heap view;
    - call stacks for merge sort, quicksort, the tree walks and topological sort;
    - side panels for the existing auxiliaries (BFS's queue, DFS's stack, insertion sort's key, the bracket stack, Floyd–Warshall's table).
  - The quality bar in the requirements now asks for this, so every Phase 2 entry meets it too.
- [x] **1.6 Built-in themes** _ADR_ [ADR 0030](adr/0030-built-in-themes.md) (#51). ADR 0030, then three PRs:
  - the themes and their fonts in the painters, Typst and LaTeX: `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` and `turbo-c` next to `light`, `dark` and `print`; the default refined with a design pass; captions as the code names structures (#53);
  - the player's chrome per theme, its web fonts, day-and-night pairs, the language menu as a `<select>`, and the playground's Theme menu with every theme (#54);
  - the documentation of themes in every output, and the lab's removal, kept outside the repository (#55).
  - The documentation site shows themes once it exists (3.4): its `themes/` page (#127).
- [x] **1.7 Painter fixes** found during theme work. _ADR_ [ADR 0031](adr/0031-painter-fixes.md) (#56) for the three that change a recorded decision, then three PRs: text clear of lines and settled under every mark (#57); pointer bands and the heap's sorted part (#58); radii in the chrome (#59).
  - check marks on graph and tree nodes stick out of the circle;
  - radii in the code panel and buttons are hard-coded instead of theme tokens;
  - edge weight labels sit on edges that cross them (the weight 15 in the Dijkstra and Kruskal examples);
  - the heap view keeps elements past the heap size linked into the tree, where CLRS draws them apart;
  - a highlighted vertex that is already settled no longer shows that it is settled (Dijkstra relaxing an edge back to a finished vertex);
  - node notes overlap edges: the ranks of the disjoint sets, and Dijkstra's distances, which also sit at uneven angles (found in the design pass of 1.6);
  - in the heap view, the index under a node sits on its child edges;
  - pointer rows reserved for a whole trace leave a blank band in frames without pointers, such as the last frame of insertion sort.
- [x] **1.9 Algorithm and input everywhere** _ADR_ [ADR 0032](adr/0032-algorithm-and-input.md) (#60) (added 2026-11-08 after the owner set the goal of the lowest cost of use, now in the requirements' purpose). People and models give an algorithm and its input, not a document, in every output. ADR 0032, then three PRs:
  - notations in the input schemas (lists, graphs as edge lists `A-B 4, B-C 2`, operation lists `insert 4, delete 3`), an input given as its main field alone, the first example when there is no input, one rule for input written as text, errors that quote the token, and recipes by name in `algomotion_show`, `algomotion_render` and `algomotion_inspect` (#61);
  - the player's `algorithm` and `input`, with the registry as a second file of the standalone bundle, `algomotion-recipes.js`, loaded on demand (#62);
  - the Typst and LaTeX packages: no input runs the first example, LaTeX hands its text to the command, and the READMEs and examples use the notations (#63).
  - Measured on six typical tasks, characters typed before → after: Dijkstra in Typst 161 → 69; BFS in LaTeX 146 → 38; insertion sort on a web page 128 (a command and a tag) → 74; a model showing Dijkstra writes 5,274 → 58; BST operations in LaTeX 104 → 68; a LeetCode tree walk with the command line 72 → 56. The concepts each needs are in the ADR.
- [x] **1.10 Figures that fill a slide** _ADR_ [ADR 0033](adr/0033-slide-figures-fill-the-frame.md) (#64, #66) (found in 1.6). In Beamer and in Typst slides a figure is drawn at its natural size, at most the line's width, so wide figures (Kruskal's, the wide layout) come out small on a slide. By default a slide figure should fill the frame's width and a share of its height, keeping its shape; the ADR amends ADR 0027 and 0028. Done: the slide box is the line by three quarters of the frame's height, and `width`/`height` replace one side of it. Width-bound figures such as Kruskal's wide canvas do not grow, since the trace-wide canvas (ADR 0025) is already as wide as the line.

## Phase 2: CLRS coverage

Each entry is one registry module, or one per operation for data structures. Each one meets the quality bar in the requirements. Unmarked entries need only a recipe. Entries marked with a structure addition (S1–S9, table below) wait for it.

**I Foundations**

- [x] insertion sort
- [x] merge sort
- [x] Strassen matrix multiplication (#87)
- [x] recursion trees for divide and conquer (#89)
- [x] random permutation (randomize in place) (#106)

**II Sorting and order statistics**

- [x] heapsort
- [x] max-heap operations (`max-heap`, and `min-heap`)
- [x] quicksort
- [x] counting sort
- [x] randomized quicksort (#108)
- [x] radix sort (#109)
- [x] bucket sort (#110)
- [x] randomized select (#111)
- [x] select (median of medians) (#112)

**III Data structures**

- [x] stack, queue and linked-list operations (search, insert, delete) (#114)
- [x] separate chaining
- [x] linear probing
- [x] quadratic probing (#113)
- [x] double hashing (#113)
- [x] BST operations (`bst`)
- [x] tree walks
- [x] red–black tree: insert (S2), delete (S2) (#68)

**IV Design and analysis**

- [x] LCS
- [x] rod cutting (#115)
- [x] matrix-chain multiplication (#116)
- [x] optimal BST (#117)
- [x] activity selection (#118)
- [x] Huffman codes (S1, S4) (#74)
- [x] offline caching (#119)
- [x] dynamic tables and binary counter (amortized analysis) (#120)

**V Advanced data structures**

- [x] order-statistic tree (S3) (#69)
- [x] interval tree (S3) (#70)
- [x] B-tree: search, insert, delete (S6, [ADR 0035](adr/0035-btree-kind.md), #75, #79)
- [x] disjoint sets (union by rank, path compression)
- [x] Fibonacci heap: insert, union, extract-min, decrease-key, delete (S1, S3, S5) (#71)

**VI Graph algorithms**

- [x] BFS
- [x] DFS
- [x] topological sort
- [x] Dijkstra
- [x] Bellman–Ford
- [x] Floyd–Warshall
- [x] Prim
- [x] Kruskal
- [x] strongly connected components (#86)
- [x] DAG shortest paths (#88)
- [x] transitive closure (#91)
- [x] Johnson (#92)
- [x] Edmonds–Karp maximum flow (#93)
- [x] bipartite matching (#94)
- [x] Hopcroft–Karp (#95)
- [x] stable matching (Gale–Shapley) (#96)
- [x] Hungarian algorithm (#97)

**VII Selected topics**

- [x] move-to-front (S7, [ADR 0036](adr/0036-linked-list-move.md), #80, #81)
- [x] LUP decomposition (#98)
- [x] FFT (#99)
- [x] Euclid and extended Euclid (#100)
- [x] modular exponentiation (#101)
- [x] string matching: naive, Rabin–Karp, finite automaton, KMP (S9, [ADR 0037](adr/0037-array-pattern.md), #82, #83)
- [x] suffix array (#102)
- [x] approximation: vertex cover (#103), TSP tour (#104), set cover (#107) (three PRs, each hard to review with the others)
- [x] computational geometry, 3rd edition: segment intersection, Graham scan, Jarvis march, closest pair (S8, [ADR 0038](adr/0038-plane-kind.md), #84, #85)

Recipes that exist beyond CLRS stay: bubble and selection sort, binary search, list reversal, bracket matching, AVL, trie, binary heap run, edit distance and 0/1 knapsack.

**Structure additions** (each _ADR_; S1–S5 share [ADR 0034](adr/0034-tree-additions.md) for `tree`, protocol `0.5`, done in #67; S6 in [ADR 0035](adr/0035-btree-kind.md), protocol `0.6`, done in #75; S7 in [ADR 0036](adr/0036-linked-list-move.md), protocol `0.7`, done in #80; S9 in [ADR 0037](adr/0037-array-pattern.md), protocol `0.8`, done in #82; S8 in [ADR 0038](adr/0038-plane-kind.md), protocol `0.9`, done in #84):

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

**Fixes found in the Phase 2 review** (2026-11-12):

- [x] Table arrows join only cells that touch, so none strikes through another cell's text, and a point's label in a plane keeps clear of pointer badges ([ADR 0042](adr/0042-arrows-and-badges-clear-of-text.md), #128, #129). Edmonds–Karp lays its network out left to right, as CLRS does, without pointers that repeat the names of the source and sink (#129).

## Phase 3: remote MCP and sharing

Independent of Phase 2, so the two can interleave.

- [x] **3.1 Streamable HTTP transport** for the MCP server, next to stdio. The server and the MCP App page must run on Workers. [ADR 0039](adr/0039-http-transport.md) (#121, #123).
- [x] **3.2 Cloudflare Worker** with a "Deploy to Cloudflare" button. It is stateless and rate-limited, and its README shows how to connect Claude and other clients. `apps/worker` (#124); it is named `algomotion-mcp`; deployed by hand at `algomotion-mcp.turing2234.com` (#138).
- [x] **3.3 Share links.** _ADR_ [ADR 0040](adr/0040-share-links.md) (#122), amended by [ADR 0041](adr/0041-share-link-limits.md) (#125), then the codec, the MCP links and the share page `apps/site` (#126). A player page that reads a compressed document, or an algorithm and its input, from the URL fragment. MCP tools return the link alongside the document.
- [x] **3.4 Documentation site** on Cloudflare Pages, generated from the registry. It is grouped structure → operation, with the player and the export snippets for every algorithm. `apps/site`: a page per module with its player, step names and snippets (web, Typst, LaTeX, CLI, MCP, share link), the catalogue by topic, and the themes; deploying waited for the owner's domain (#127); deployed as Workers static assets at `algomotion.turing2234.com`, with the Worker's share links pointing at it (#138).

## Phase 4: release 1.0

- [x] **4.1 Name** _owner_. Check availability on npm, Typst Universe and CTAN. The owner chose algomotion: _ADR_ [ADR 0044](adr/0044-the-name-algomotion.md) (#135), then the rename (#136): packages, commands, MCP tools, the Typst and LaTeX packages, the CDN files, the environment variables, the schema id, the Worker and the docs.
- [x] **4.2 Freeze the protocol at 1.0** under 0.4's rules. Regenerate the JSON Schema and fixtures. _ADR_ [ADR 0043](adr/0043-protocol-1-0.md) (#130), then the code (#133): 1.0 is 0.9 as it stands, and 0.x documents are read as 1.0 with an `UPGRADED_VERSION` warning.
- [ ] **4.3 Publish** _owner_: npm packages, the CDN bundle, the Typst package, the LaTeX package and the standalone executable.
- [x] **4.4 Release check.**
  - Deep fuzz (`FUZZ_RUNS=5000`) and the full E2E suite pass.
  - Evals cover the new kinds.
  - Bundle sizes are measured.
  - The README and the guide are up to date.
  - Split in two, since the last run must follow 4.2:
    - part 1 (#132): evals for root lists, `btree`, list `move`, array patterns, `plane` and the priority queue in the side panel; `npm run sizes` and [the sizes](sizes.md);
      - the CDN bundle minified, with source maps (#134);
    - part 2 (#137), after 4.2 and the rename: the README and the guide, deep fuzz, the full E2E suite and the Typst, LaTeX, standalone and Worker tests.
      - The READMEs, CONTRIBUTING and the MCP server's texts caught up with the code: eleven kinds, 132 registry modules, 34 eval tasks. A test now fails when either MCP text leaves out a kind.
      - Every property test passed at `FUZZ_RUNS=5000`, with no counterexample. Their timeouts now grow with `FUZZ_RUNS`; at 5,000 runs `properties.spec.ts` alone takes about 85 minutes.
      - `npm run check`, the build, the E2E suites (217 and 34), `test:typst` (39), `test:latex` (62), `test:standalone` (141) and `test:worker` (5) pass; the sizes were remeasured.

## Phase 5: a site worth visiting

The owner's brief (2026-11-14): the site still looks bare and says too little. Make it show the product, give reasons to use it, look maintained, and read in Chinese too. The project is not commercial; the aim is that people use it, star it and contribute. The design canvas and the palette (neutral greys, ink buttons, the amber accent) stay as #141 left them. Every item keeps the site's rules: figures drawn by the engine at build time, the strict Content Security Policy, no new runtime dependencies without an ADR, and unit and E2E tests.

- [x] **5.0 The redesign**: the home page, the guide of ten pages, `/algorithms/`, the neutral dark theme and a placeholder logo (#140, #141).
- [x] **5.1 A home page you can play with.** (#143) The hero becomes a small playground: pick an algorithm, edit its input, and the player and the snippets for every output follow. An input that does not fit shows its error in place. It works without a server, and the page still reads without script.
- [x] **5.2 A gallery for the catalogue.** (#145) `/algorithms/` shows a thumbnail of each module, drawn by the engine in the light and the dark theme, with the filter and topics it has. Thumbnails load lazily and the page stays fast with all 132.
- [x] **5.3 Real scenes.** The home page and the guides show the outputs as they really look: a page of Typst notes and a Beamer slide compiled from the examples, a terminal run, and the player in an AI conversation. Each is made by a script from the real tools, so it can be remade (#148).
- [x] **5.4 Why algomotion.** A page that says what it is for and how it differs from drawing by hand, from Manim and from visualization websites, with honest limits, and three walk-throughs: a student's notes, a teacher's slides, and an assistant explaining an algorithm (#146).
- [x] **5.5 Signs of life.** A changelog page and a roadmap page built from the repository's own files, the version in the footer, a contributing page, and issue templates. No tracking and no third-party requests (#144).
- [ ] **5.6 Polish.** Syntax colour in code blocks at build time, the home page's figures playing as a loop, transitions on the tabs, and a pass over spacing and type on every page, in both colour schemes and at phone width.
- [ ] **5.7 The site in Chinese.** `/zh/` holds the home page, the guide and the other pages in Simplified Chinese, with a language switch and `hreflang`. Module pages stay in English until 5.8.
- [ ] **5.8 Chinese in the product** _ADR_: the player's chrome and the recipes' narration in Chinese. It needs a decision on where a document keeps several languages.
- [ ] **5.9 A logo** _owner_: the owner picks one of the candidates on the design canvas, or asks for more.

## After 1.0

- More languages: C++, Java and JavaScript (ADR 0017).
- More structures: B+ tree, skip list, binomial and pairing heaps, treap, splay tree, segment and Fenwick trees, LRU cache.
- An A2UI adapter.
- Third-party structure kinds.
- Links between structures, such as an array entry pointing at a tree node.
