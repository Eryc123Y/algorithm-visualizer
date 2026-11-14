# @algomotion/site

The algomotion website, built as static files for Cloudflare Pages or any static host:

- **The documentation** (roadmap 3.4), generated from the registry, so a new module needs no change here (requirement R7):
  - the home page: a playground, where a choice of any module and an input drive the player and every output's snippet (`src/docs/playground*.ts`), the run as a plate of figures, and the catalogue by topic. The address keeps the run (`?algorithm=bfs&input=…`); without script the page shows the default run;
  - `algorithms/`, the catalogue: a card per algorithm and structure, with a thumbnail drawn at build time from its first example at the middle frame (`thumbnailFrame`), in the light and the dark theme, loaded lazily; a filter and the operations under their structure;
  - a page per module, `dijkstra/`, `bst/` and `bst/delete/`: its player on the first example, the names of its steps, and the same run as a snippet for a web page, Typst, LaTeX, the command line, MCP and a share link;
  - `themes/`: one figure in every built-in theme, and how each output picks one;
  - `why/` (roadmap 5.4): what algomotion is for, its differences shown with figures drawn from real runs, a comparison with drawing by hand, Manim and visualization websites, its limits, and three walk-throughs whose runs the unit tests check (`src/docs/why.ts`); the home page links to it from a short section below the outputs (`src/docs/home-why.ts`);
  - `changelog/`, `roadmap/` and `contributing/` (roadmap 5.5), built from the repository's `CHANGELOG.md`, `docs/roadmap.md` and `CONTRIBUTING.md` by a small Markdown renderer (`src/docs/markdown.ts`) that escapes everything and links only http(s) and relative targets;
  - `404.html`.

Every page's footer names the repository's version, from the root `package.json`, and the commit it was built from, with that commit's date, as `git log -1` reports it. Built outside a Git checkout, the footer shows the version alone.

- **The share page**, `play/`, which plays share links ([ADR 0040](../../docs/adr/0040-share-links.md), [ADR 0041](../../docs/adr/0041-share-link-limits.md)).

## Building

```sh
npm run build -w @algomotion/site     # writes apps/site/dist/
npm run preview -w @algomotion/site   # serves it at http://localhost:4173
```

`vite build` builds the share page and the documentation's script and styles. Then `scripts/build-pages.ts` writes the pages from the registry, with the asset names from Vite's manifest, and draws the themes' figures with `@algomotion/svg`. Each snippet's input is the shortest form that runs to the example's document (`src/docs/short-input.ts`); the unit tests check every snippet of every module against the registry.

Every page sends the same Content Security Policy, in a `<meta>` and in `_headers`: the site's own scripts, styles and fonts only, no connections, and Trusted Types enforced. The pages' links are relative, so the site works at any path. Only `404.html` assumes the root, as Cloudflare Pages serves it for any missing address.

## Real scenes

The home page, the guides and `/why/` show the outputs as they really look (roadmap 5.3): a page of Typst notes, the overlays of a Beamer frame, a terminal session and the player in a conversation. They are files in `public/scenes/`, committed, with `scenes.json` naming each file, its size and its alternative text. `scripts/scenes.ts` makes them all again from the real tools:

```sh
npm run scenes -w @algomotion/site
```

- `notes.svg`: `scenes/notes.typ` compiled by `typst compile --format svg` with the repository's Typst package (it builds the package's engine first if needed).
- `beamer-1.svg` to `beamer-3.svg`: `scenes/slides.tex`, the very file the Beamer walk-through on `/why/` shows, compiled by `latexmk -pdf -shell-escape` with the LaTeX package and the `algomotion` command from source, then one SVG per page with `pdftocairo -svg`.
- `terminal-light.svg` and `terminal-dark.svg`: the commands in `SESSION` run in a fresh folder with the command from source; their output, as printed, is drawn by `src/docs/terminal.ts`, which wraps long lines as a terminal does.
- `chat-light.webp` and `chat-dark.webp`: the MCP server's player page after a real `algomotion_show` call, in the minimal MCP Apps host of the playground's E2E tests (`apps/playground/tests/e2e/mcp-host.ts`), photographed by Playwright at twice the size and compressed with `cwebp`. The conversation around it is plain and carries no product's look.

It needs Typst 0.15, TeX Live with `latexmk`, Poppler's `pdftocairo` and `pdfinfo`, `cwebp` and Playwright's Chromium. Run it after changing the engine's drawing, the packages or the player, and commit what changes. The unit tests check that the files match the manifest and stay under 800 KB together, and that `scenes/slides.tex` is the walk-through's file.

## Deploying to Cloudflare

The site is deployed as static assets on Cloudflare Workers, at <https://algomotion.turing2234.com>; `wrangler.jsonc` in this folder names the Worker and its folder of assets. To deploy:

```sh
npm run build -w @algomotion/site
cd apps/site && npx wrangler deploy
```

Cloudflare reads `_headers` from the assets, so the security headers are sent as on Cloudflare Pages. A copy on another account or host changes the name in `wrangler.jsonc`, or serves `dist/` from any static host.

The site must have an origin of its own, not a path on a shared one (ADR 0041). Then point the MCP server's `ALGOMOTION_SHARE_URL` at its `play/` page.

## Tests

- `npx vitest run --project site`: the catalogue, the snippets (every module's, run back through the registry), the pages, the project pages against the files they are built from, the Markdown renderer (with a property test that no input becomes markup), the headers, the share page's wiring and the browser enhancements.
- `npm run test:e2e -w @algomotion/site`: the built site in Chromium, on a desktop and a phone. The tests open the home page, an algorithm's page, a structure's operations, the themes, the project pages and crafted share links. They fail on any console error, page error, dialog or Content Security Policy violation, and scan each page with axe in light and dark.
