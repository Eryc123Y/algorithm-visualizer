# Download sizes

What users download, measured by `npm run sizes` (roadmap 4.4). Run `npm run sizes -- --write` to rebuild everything and update the table below; `-- --no-build` measures what is already built.

Raw is the size on disk. gzip and brotli are what a server that compresses sends, each file compressed on its own; fonts (`.woff2`), WebAssembly bytecode and the executable are already dense, so they shrink less. The CDN and the docs site serve brotli or gzip to browsers that ask for it.

<!-- sizes:start -->

Measured on 2026-11-12 at commit `8bea810`, with Node 24.22.2; gzip at level 9 and brotli at quality 11, each file on its own.

| Download                      | Files |      Raw |     gzip |   brotli | What it is                                                                                  |
| ----------------------------- | ----: | -------: | -------: | -------: | ------------------------------------------------------------------------------------------- |
| CDN `algoviz-player.js`       |     1 | 461.2 kB | 117.4 kB |  98.8 kB | the `<algo-player>` element with Lit and the engine, as a `<script type="module">` loads it |
| CDN `algoviz-recipes.js`      |     1 | 477.5 kB | 131.4 kB | 106.8 kB | the registry, loaded on first use of `algorithm` (ADR 0032)                                 |
| CDN `fonts/`                  |    30 | 817.8 kB | 818.6 kB | 817.8 kB | every theme’s web fonts; a player loads only its theme’s                                    |
| `@algoviz/elements` in an app |     1 | 347.5 kB | 105.7 kB |  91.5 kB | the `define` entry minified by Vite, without the registry chunk                             |
| … its registry chunk          |     1 | 395.8 kB | 119.4 kB |  99.4 kB | the same, the registry loaded on first use                                                  |
| Typst `plugin.wasm`           |     1 |  1.21 MB | 417.8 kB | 330.0 kB | QuickJS in WebAssembly, as committed (ADR 0026)                                             |
| Typst `engine.bc`             |     1 |  1.35 MB | 529.5 kB | 439.0 kB | the engine as QuickJS bytecode                                                              |
| Typst package                 |     6 |  2.62 MB | 960.6 kB | 780.0 kB | everything in `packages/typst/package/`                                                     |
| LaTeX package                 |     2 |  50.1 kB |  14.7 kB |  12.8 kB | everything in `packages/latex/package/`                                                     |
| Worker `worker.js`            |     1 |  2.07 MB | 574.6 kB | 454.9 kB | the MCP server with the guide and player page (ADR 0039)                                    |
| Standalone `algoviz`          |     1 |  2.95 MB |  1.25 MB |  1.01 MB | the CLI for darwin-arm64 (ADR 0027)                                                         |
| Site scripts and styles       |     7 | 774.7 kB | 234.4 kB | 198.6 kB | `.js` and `.css` under `apps/site/dist/`                                                    |
| Site pages                    |   136 | 821.0 kB | 272.1 kB | 218.1 kB | `.html` under `apps/site/dist/`                                                             |
| Site, everything              |   184 |  2.60 MB |  1.36 MB |  1.26 MB | all of `apps/site/dist/`, fonts and images included                                         |

<!-- sizes:end -->

## Notes

- The Worker must stay within Cloudflare's 3 MB compressed limit on the free plan (10 MB on paid plans); its row is the number to watch.
- The standalone executable is built for the platform that ran the script.
- The CDN bundle keeps its whitespace: Vite does not minify ES output in library mode. Minified, as an app's bundler ships it, the same code is about a quarter smaller raw and a tenth smaller compressed (the `@algoviz/elements` rows).
