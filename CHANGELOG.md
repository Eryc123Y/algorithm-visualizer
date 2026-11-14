# Changelog

All notable changes to algomotion, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the packages will follow [Semantic Versioning](https://semver.org/) once they are published. Numbers such as (#14) are the pull requests on GitHub; the [roadmap](docs/roadmap.md) says what each phase set out to do.

## Unreleased

Nothing has been published yet: the npm packages, the CDN bundle, the Typst package, the LaTeX package and the standalone executable all wait for roadmap item 4.3, which is the owner's. Everything below is on `main` and can be built from the repository. The hosted MCP server at `algomotion-mcp.turing2234.com` and the site at `algomotion.turing2234.com` run from it.

### Phase 5: a site worth visiting (2026-11-14)

#### Added

- The site in Simplified Chinese under `/zh/`: the home page, `/why/`, the guide, the catalogue, the themes, the project pages and the 404 page, with a language switch, `hreflang`, the reader's own CJK fonts, and a build that fails on any English page without a Chinese counterpart (#152).
- Real scenes of the outputs: a page of Typst notes, the overlays of a Beamer frame, a terminal session and the player in a conversation, each remade from the real tools by `npm run scenes`, on the home page's output tabs, the guides and `/why/` (#148).
- A gallery for `/algorithms/`: a thumbnail of each module in the light and the dark theme, loaded lazily (#145).
- A playground in the home page's hero: pick an algorithm, edit its input, and the player and the snippets for every output follow (#143).
- `/why/`: what algomotion is for, what makes it different, a comparison with drawing by hand, Manim and visualization websites, its limits, and three walk-throughs; linked from the bar and from a short section on the home page (#146).
- A changelog, a roadmap page and a contributing page on the site, built from this file, `docs/roadmap.md` and `CONTRIBUTING.md`; the version and the commit in every page's footer; issue forms and a pull request template (#144).
- The site's redesign: a home page with a live player, a plate of figures and every output in tabs; a guide of ten pages; `/algorithms/` by topic; a neutral dark theme and a placeholder logo (#140, #141).
- Phase 5 in the roadmap.

#### Changed

- Tests for `content.ts` in the player, and notes on CI for a public repository (#139).

### Phase 4: release 1.0, before publishing (2026-11-12 to 2026-11-13)

#### Changed

- The project is named algomotion ([ADR 0044](docs/adr/0044-the-name-algomotion.md), #135). Packages, commands, MCP tools, the Typst and LaTeX packages, the CDN files, the environment variables, the schema id and the Worker were renamed from algoviz (#136).
- The protocol is frozen at 1.0 ([ADR 0043](docs/adr/0043-protocol-1-0.md), #130): 1.0 is 0.9 as it stood, and 0.x documents are read as 1.0 with an `UPGRADED_VERSION` warning (#133).
- The CDN bundle is minified, with source maps (#134).

#### Added

- Evals for root lists, `btree`, list `move`, array patterns, `plane` and the priority queue in the side panel; `npm run sizes` and the measured sizes in `docs/sizes.md` (#132).
- The release check: every property test at `FUZZ_RUNS=5000`, the full E2E suites, and the Typst, LaTeX, standalone and Worker tests; the READMEs, CONTRIBUTING and the MCP server's texts caught up with the code (#137).
- The site and the Worker deployed, with share links pointing at the site (#138).

### Phase 3: remote MCP and sharing (2026-11-12)

#### Added

- Streamable HTTP for the MCP server, next to stdio ([ADR 0039](docs/adr/0039-http-transport.md), #121, #123).
- `apps/worker`: the MCP server as a stateless, rate-limited Cloudflare Worker, with a "Deploy to Cloudflare" button (#124, #131).
- Share links: a player page that reads a compressed document, or an algorithm and its input, from the URL fragment, and MCP tools that return the link ([ADR 0040](docs/adr/0040-share-links.md), [ADR 0041](docs/adr/0041-share-link-limits.md), #122, #125, #126).
- The documentation site, generated from the registry: a page per module with its player, step names and snippets, the catalogue by topic, and the themes (#127).

### Phase 2: CLRS coverage (2026-11-12)

#### Added

- Structure additions to draw them: root order, `NIL` pointers, several notes per node, edge marks and root-list links in `tree` ([ADR 0034](docs/adr/0034-tree-additions.md), #65, #67); the `btree` kind (#72, #75); `move` in `linkedList` (#76, #80); pattern alignment in `array` (#77, #82); the `plane` kind for geometry (#78, #84).
- Registry modules for most of CLRS, each tested against an independent reference implementation:
  - foundations: Strassen (#87), recursion trees (#89), random permutation (#106);
  - sorting and order statistics: randomized quicksort (#108), radix sort (#109), bucket sort (#110), randomized select (#111), select (#112);
  - data structures: stack, queue and linked-list operations (#114), quadratic probing and double hashing (#113), red–black insert and delete (#68);
  - design and analysis: rod cutting (#115), matrix-chain multiplication (#116), optimal BST (#117), activity selection (#118), Huffman codes (#74), offline caching (#119), dynamic tables and the binary counter (#120);
  - advanced data structures: order-statistic tree (#69), interval tree (#70), B-tree (#79), Fibonacci heap (#71);
  - graphs: strongly connected components (#86), DAG shortest paths (#88), transitive closure (#91), Johnson (#92), Edmonds–Karp (#93), bipartite matching (#94), Hopcroft–Karp (#95), Gale–Shapley (#96), the Hungarian algorithm (#97);
  - selected topics: move-to-front (#81), LUP decomposition (#98), FFT (#99), Euclid (#100), modular exponentiation (#101), string matching (#83), suffix array (#102), approximate vertex cover (#103), TSP tour (#104) and set cover (#107), and computational geometry (#85).

#### Fixed

- Table arrows join only cells that touch, a point's label keeps clear of pointer badges, and Edmonds–Karp lays its network out left to right ([ADR 0042](docs/adr/0042-arrows-and-badges-clear-of-text.md), #128, #129).
- Tree notes kept clear of the edges at their node (#90); graph layouts whose every node is placed by hand may overlap without failing the property tests (#105).

### Phase 1: static output and packages (2026-11-08 to 2026-11-12)

#### Added

- `@algomotion/fonts`: layout measures text with real glyph widths, and standalone SVG draws text as outlines ([ADR 0024](docs/adr/0024-text-measurement-and-fonts.md), #29 to #32).
- `algomotion export`: SVG files of any steps, by name, range or all ([ADR 0025](docs/adr/0025-exporting-figures.md), #34, #35).
- The Typst package, with the engine in QuickJS-ng inside a WebAssembly plugin ([ADR 0026](docs/adr/0026-typst-package.md), #36 to #38).
- The LaTeX package, a TikZ painter and a standalone `algomotion` executable ([ADR 0027](docs/adr/0027-latex-package.md), #39 to #42).
- Slides: one overlay per step in Beamer, polylux and Touying ([ADR 0028](docs/adr/0028-slides.md), #43, #44).
- Auxiliary structures beside the main one: side placement, the `priorityQueue` kind and the heap view of `array`, used by the recipes ([ADR 0029](docs/adr/0029-auxiliary-structures.md), #45 to #49).
- Nine built-in themes across every output, and the player's chrome per theme ([ADR 0030](docs/adr/0030-built-in-themes.md), #51, #53 to #55).
- An algorithm and its input everywhere: notations for lists, graphs and operations in every output, the player's `algorithm` and `input` attributes, after the requirements set the lowest cost of use as a goal ([ADR 0032](docs/adr/0032-algorithm-and-input.md), #50, #60 to #63).

#### Changed

- Slide figures fill the frame's width and a share of its height ([ADR 0033](docs/adr/0033-slide-figures-fill-the-frame.md), #64, #66).

#### Fixed

- Text clear of lines, pointer bands, the heap's sorted part and radii in the chrome ([ADR 0031](docs/adr/0031-painter-fixes.md), #56 to #59); the queue badge's width (#33).

### Phase 0: foundations (2026-11-07 to 2026-11-08)

#### Added

- The requirements and the roadmap (#12), and the ADRs of Phase 0 (#13).
- Protocol versions as `"major.minor"` ([ADR 0021](docs/adr/0021-protocol-versioning.md), #14).
- Step names and sections, with selectors in every output and marks on the player's timeline ([ADR 0020](docs/adr/0020-step-names-and-sections.md), #15, #16).
- Sources in two languages, pseudocode in CLRS conventions and Python, with a language switch in the player ([ADR 0017](docs/adr/0017-multi-language-source.md), #17, #18).
- The algorithm registry, read by MCP, the command line and the playground ([ADR 0019](docs/adr/0019-algorithm-registry.md), [ADR 0022](docs/adr/0022-registry-details.md), #19 to #22), and every earlier recipe moved into it ([ADR 0023](docs/adr/0023-remaining-modules.md), #23 to #28).

### Before the roadmap (2026-10-06 to 2026-10-26)

#### Added

- The first architecture decision records, the protocol package, the timeline engine, layout to scenes, the SVG painter and the `<algo-player>` element, committed before pull requests were used.
- Undergraduate data structures, node-link layouts and the first algorithm recipes (#8).
- The MCP server and MCP App for documents written by models, the evals, and generative and E2E tests (#9).
- Python highlighting in the player, and BST and binary heap operations from a given state (#11).

#### Security

- zod upgraded to 4.6.7 for a memory exhaustion advisory (#10).
