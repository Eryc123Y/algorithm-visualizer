# @algomotion/site

The algomotion website, built as static files for Cloudflare Pages or any static host:

- **The documentation** (roadmap 3.4), generated from the registry, so a new module needs no change here (requirement R7):
  - the home page, with one run in every output and the catalogue of every module by topic, a data structure's operations listed under it;
  - a page per module, `dijkstra/`, `bst/` and `bst/delete/`: its player on the first example, the names of its steps, and the same run as a snippet for a web page, Typst, LaTeX, the command line, MCP and a share link;
  - `themes/`: one figure in every built-in theme, and how each output picks one;
  - `404.html`.
- **The share page**, `play/`, which plays share links ([ADR 0040](../../docs/adr/0040-share-links.md), [ADR 0041](../../docs/adr/0041-share-link-limits.md)).

## Building

```sh
npm run build -w @algomotion/site     # writes apps/site/dist/
npm run preview -w @algomotion/site   # serves it at http://localhost:4173
```

`vite build` builds the share page and the documentation's script and styles. Then `scripts/build-pages.ts` writes the pages from the registry, with the asset names from Vite's manifest, and draws the themes' figures with `@algomotion/svg`. Each snippet's input is the shortest form that runs to the example's document (`src/docs/short-input.ts`); the unit tests check every snippet of every module against the registry.

Every page sends the same Content Security Policy, in a `<meta>` and in `_headers`: the site's own scripts, styles and fonts only, no connections, and Trusted Types enforced. The pages' links are relative, so the site works at any path. Only `404.html` assumes the root, as Cloudflare Pages serves it for any missing address.

## Deploying to Cloudflare Pages

Nothing is deployed from this repository. The domain, and so the base URL of share links, is the owner's decision. To deploy, create a Pages project connected to the repository with:

| Setting                | Value                               |
| ---------------------- | ----------------------------------- |
| Build command          | `npm run build -w @algomotion/site` |
| Build output directory | `apps/site/dist`                    |
| Node.js version        | 22.12 or later (`NODE_VERSION=22`)  |

The site must have an origin of its own, not a path on a shared one (ADR 0041). Then point the MCP server's `ALGOMOTION_SHARE_URL` at its `play/` page.

## Tests

- `npx vitest run --project site`: the catalogue, the snippets (every module's, run back through the registry), the pages, the headers, the share page's wiring and the browser enhancements.
- `npm run test:e2e -w @algomotion/site`: the built site in Chromium, on a desktop and a phone. The tests open the home page, an algorithm's page, a structure's operations, the themes and crafted share links. They fail on any console error, page error, dialog or Content Security Policy violation, and scan each page with axe in light and dark.
