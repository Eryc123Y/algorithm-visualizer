# Download sizes

What users download, measured by `npm run sizes` (roadmap 4.4). Run `npm run sizes -- --write` to rebuild everything and update the table below; `-- --no-build` measures what is already built.

Raw is the size on disk. gzip and brotli are what a server that compresses sends, each file compressed on its own; fonts (`.woff2`), WebAssembly bytecode and the executable are already dense, so they shrink less. The CDN and the docs site serve brotli or gzip to browsers that ask for it.

<!-- sizes:start -->
<!-- sizes:end -->

## Notes

- The Worker must stay within Cloudflare's 3 MB compressed limit on the free plan (10 MB on paid plans); its row is the number to watch.
- The standalone executable is built for the platform that ran the script.
