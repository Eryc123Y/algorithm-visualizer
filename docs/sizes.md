# Download sizes

What users download, measured by `npm run sizes` (roadmap 4.4). Run `npm run sizes -- --write` to rebuild everything and update the table below; `-- --no-build` measures what is already built.

Raw is the size on disk. gzip and brotli are what a server that compresses sends, each file compressed on its own; fonts (`.woff2`), WebAssembly bytecode and the executable are already dense, so they shrink less. The CDN and the docs site serve brotli or gzip to browsers that ask for it.

<!-- sizes:start -->

Measured on 2026-11-22 at commit `d319c2e`, from outputs built earlier, with Node 24.22.2; gzip at level 9 and brotli at quality 11, each file on its own.

| Download                         | Files |      Raw |     gzip |   brotli | What it is                                                                                  |
| -------------------------------- | ----: | -------: | -------: | -------: | ------------------------------------------------------------------------------------------- |
| CDN `algomotion-player.js`       |     1 | 350.6 kB | 106.9 kB |  92.3 kB | the `<algo-player>` element with Lit and the engine, as a `<script type="module">` loads it |
| CDN `algomotion-recipes.js`      |     1 | 479.0 kB | 151.9 kB | 122.6 kB | the registry, loaded on first use of `algorithm` (ADR 0032)                                 |
| CDN `fonts/`                     |    30 | 817.8 kB | 818.6 kB | 817.8 kB | every theme’s web fonts; a player loads only its theme’s                                    |
| `@algomotion/elements` in an app |     1 | 348.6 kB | 106.6 kB |  92.2 kB | the `define` entry minified by Vite, without the registry chunk                             |
| … its registry chunk             |     1 | 478.9 kB | 151.9 kB | 122.6 kB | the same, the registry loaded on first use                                                  |
| Typst `plugin.wasm`              |     1 |  1.21 MB | 417.8 kB | 330.0 kB | QuickJS in WebAssembly, as committed (ADR 0026)                                             |
| Typst `engine.bc`                |     1 |  1.44 MB | 571.0 kB | 472.0 kB | the engine as QuickJS bytecode                                                              |
| Typst package                    |     7 |  2.75 MB |  1.02 MB | 823.4 kB | everything in `packages/typst/package/`                                                     |
| LaTeX package                    |     3 |  87.5 kB |  27.1 kB |  22.7 kB | everything in `packages/latex/package/`                                                     |
| Worker `worker.js`               |     1 |  2.17 MB | 610.5 kB | 479.8 kB | the MCP server with the guide and player page (ADR 0039)                                    |
| Standalone `algomotion`          |     1 |  3.05 MB |  1.29 MB |  1.04 MB | the CLI for darwin-arm64 (ADR 0027)                                                         |
| Site scripts and styles          |     9 | 926.4 kB | 286.1 kB | 238.7 kB | `.js` and `.css` under `apps/site/dist/`                                                    |
| Site pages                       |   301 |  4.05 MB |  1.12 MB | 912.1 kB | `.html` under `apps/site/dist/`                                                             |
| Site, everything                 |  2358 | 43.13 MB |  9.19 MB |  7.88 MB | all of `apps/site/dist/`, fonts and images included                                         |

<!-- sizes:end -->

## Notes

- The Worker must stay within Cloudflare's 3 MB compressed limit on the free plan (10 MB on paid plans); its row is the number to watch.
- The standalone executable is built for the platform that ran the script.
- The CDN files are minified (#134), as an app's bundler would ship them, and each has a source map next to it (`.js.map`, not counted above), which browsers fetch only with the developer tools open. Before, Vite's library mode kept their whitespace, and they were a quarter larger raw: 461 kB and 478 kB.
