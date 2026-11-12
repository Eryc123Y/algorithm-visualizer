# 0044. The project is named algomotion

## Status

Accepted

## Context

Roadmap 4.1 names the project before anything is published. Until now it has been called algoviz, a working name. Several live sites in the same field already use that name: algoviz.org, algoviz.io, algoviz.app and algoviz.pages.dev. The unscoped npm package `algoviz` is taken, and so are the main domains. On 2026-11-12 the owner chose a new name, **algomotion**: algorithms in motion, shown step by step.

The name appears on every surface a user touches. That covers the npm scope, the command, the MCP tools, the Typst package and its functions, the LaTeX package and its commands, the CDN files, an environment variable, the schema id and the Worker. ADR 0043 §5 already decided that changing the schema id's name segment before publishing is a rename, not a protocol change.

The name must work the same way everywhere. A TeX command name has letters only, so the name is lowercase letters only. The same string is then valid as an npm scope, a Typst Universe package (kebab-case, without "typst"), a CTAN package, a command and a domain.

Availability, checked on 2026-11-12:

| Where                      | `algomotion`                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| npm scope `@algomotion`    | Free                                                                                                                                 |
| npm package `algomotion`   | Taken: a canvas drawing utility for algorithm visualization, version 0.7.2, last published in April 2022, about 30 downloads a month |
| Typst Universe, CTAN, PyPI | Free                                                                                                                                 |
| TeX Live                   | No package or command of that name                                                                                                   |
| Domains                    | `.dev`, `.org`, `.io`, `.net` and `.page` free; `.com` and `.app` taken                                                              |
| GitHub                     | About 30 repositories named AlgoMotion, none with more than 3 stars                                                                  |

## Decision

### 1. Every name that says algoviz says algomotion

| Surface                                                   | Was                                                                                                                                        | Becomes                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| npm packages                                              | `@algoviz/spec`, `core`, `svg`, `tikz`, `fonts`, `elements`, `recipes`, `mcp`, `typst`, `latex`, and the apps                              | `@algomotion/…`, the same names under the new scope                                                                    |
| Commands (the `@…/mcp` package's bins)                    | `algoviz`, `algoviz-mcp`                                                                                                                   | `algomotion`, `algomotion-mcp`                                                                                         |
| Standalone executable                                     | `algoviz`, `algoviz.exe`; the crate `algoviz-standalone`                                                                                   | `algomotion`, `algomotion.exe`; `algomotion-standalone`                                                                |
| MCP server and tools                                      | server `algoviz`; `algoviz_show`, `_render`, `_inspect`, `_validate`, `_guide`, `_list_recipes`, `_run_recipe`; `ui://algoviz/player.html` | server `algomotion`; `algomotion_show` and the rest; `ui://algomotion/player.html`                                     |
| Typst package                                             | `@preview/algoviz`; `algoviz`, `algoviz-series`, `algoviz-figures`, `algoviz-slides`                                                       | `@preview/algomotion`; `algomotion`, `algomotion-series`, `algomotion-figures`, `algomotion-slides`                    |
| LaTeX package                                             | `algoviz.sty`; `\algoviz`, `\algovizfile`, `\algovizinput`, `\algovizset`; the expl3 module `algoviz`; the cache `_algoviz/`               | `algomotion.sty`; `\algomotion`, `\algomotionfile`, `\algomotioninput`, `\algomotionset`; `algomotion`; `_algomotion/` |
| CDN files                                                 | `algoviz-player.js`, `algoviz-recipes.js`                                                                                                  | `algomotion-player.js`, `algomotion-recipes.js`                                                                        |
| Environment variables                                     | `ALGOVIZ_SHARE_URL`; for development, `ALGOVIZ_COMMAND` and `ALGOVIZ_BUNDLE`                                                               | `ALGOMOTION_SHARE_URL`, `ALGOMOTION_COMMAND`, `ALGOMOTION_BUNDLE`                                                      |
| JSON Schema id                                            | `urn:algoviz:schema:visualization:1.0`                                                                                                     | `urn:algomotion:schema:visualization:1.0`                                                                              |
| Source condition for development                          | `@algoviz/source`                                                                                                                          | `@algomotion/source`                                                                                                   |
| Worker                                                    | `algoviz-mcp`                                                                                                                              | `algomotion-mcp`                                                                                                       |
| Player's saved language                                   | `localStorage` key `algoviz:language`                                                                                                      | `algomotion:language`                                                                                                  |
| Site, README, guides, CONTRIBUTING, roadmap, requirements | algoviz                                                                                                                                    | algomotion                                                                                                             |

The protocol version stays `1.0`: documents do not carry the schema id (ADR 0043 §5), so no document changes.

### 2. No aliases for the old names

Nothing has been published, so no user depends on an old name. Keeping `algoviz` as a second command, a second set of tool names or a second LaTeX command would double what people and models have to learn, and the old name would linger in answers and examples. The old names go entirely, in one change.

### 3. What keeps its name

- **The element `<algo-player>`.** It does not carry the project's name, and it reads correctly under the new name.
- **The repository, `algorithm-visualizer`.** Renaming a repository changes its URL and belongs to the owner's account. GitHub redirects the old URLs, so it can be renamed at release (roadmap 4.3) without breaking links.
- **The records.** Accepted ADRs, merged pull requests and the evals' recorded runs in `evals/results/` keep the name they were written with. A note in the README and in the ADR index says the project was called algoviz until this ADR.

### 4. The unscoped npm name

The unscoped package `algomotion` belongs to someone else, so there will be no `npx algomotion`. Nothing in the project needs it: every package is scoped, and the command comes with `@algomotion/mcp`, as it came with `@algoviz/mcp`. Once the packages are published (roadmap 4.3), the README shows `npm install -g @algomotion/mcp`, and `npx -p @algomotion/mcp algomotion …` for a run without installing. Asking npm to transfer the name would need the owner's account and a dispute that the name's owner could refuse. The scoped form costs a user only the `-p` flag.

## Consequences

- Every package, command, tool, package function, LaTeX command, file, variable and test that said algoviz says algomotion. The rename is one pull request, and `npm run check`, the E2E suites and the Typst, LaTeX, standalone and Worker tests all run on it.
- The committed Typst plugin does not contain the name, so it is not rebuilt. The engine's bytecode and the CDN bundle are rebuilt as usual.
- The JSON Schema and the conformance fixtures are regenerated for the new id. Figures do not change, since the name is never drawn.
- Old ADRs say algoviz. Read their names through the table in §1.
- Models trained on nothing of ours lose nothing. Models that saw the repository's earlier examples may still write `algoviz_*`, but no client offers those tools, so the error says so at once.
- algomotion.dev is free, and it suits the docs site and the share links. Buying it and pointing the Worker and Pages at it wait for the owner (roadmap 4.3).
- The lines that name the project in code and docs get three characters longer. Formatting runs over the changed files.
