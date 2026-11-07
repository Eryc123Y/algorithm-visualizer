# @algoviz/typst

The algoviz Typst package and its build ([ADR 0026](../../docs/adr/0026-typst-package.md)). Typst runs plugins in WebAssembly, so the package runs the engine (`@algoviz/spec`, `fonts`, `core`, `svg` and `recipes`) as JavaScript in QuickJS-ng, compiled to WebAssembly. Its figures are the SVG of `algoviz export`, byte for byte.

| Path        | What                                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package/`  | The Typst package as it will be published: `typst.toml`, `lib.typ`, its [README](package/README.md), `OFL.txt`, `plugin.wasm` (committed) and `engine.bc` (built, not committed). |
| `examples/` | The README's examples as documents, which the Typst tests compile.                                                                                                                |
| `plugin/`   | The Rust crate of `plugin.wasm`: QuickJS-ng through rquickjs, behind `wasm-minimal-protocol`. It exports `compile`, `load` and `render`.                                          |
| `src/`      | The engine entry, bundled with the engine and evaluated by the plugin: a JSON request in, a JSON response out, with a cache of the last eight documents.                          |
| `scripts/`  | The two builds, and a Node host for the plugin protocol that the builds and the tests share.                                                                                      |
| `tests/`    | The entry in Node, and the committed plugin in Node's WebAssembly against `exportFigures`. `tests/typst/` runs the package in the `typst` command.                                |

## Building

- `npm run build -w @algoviz/typst` writes `package/engine.bc`: it bundles `src/main.ts` with Vite and compiles the bundle to QuickJS bytecode by running `plugin.wasm` in Node. It needs only Node; run it after changing the engine. The root `npm run build` runs it too.
- `npm run build:plugin -w @algoviz/typst` rebuilds `package/plugin.wasm` from `plugin/`. It needs rustup, which installs the Rust version pinned in `plugin/rust-toolchain.toml`, and clang from LLVM 23 with the wasm32 target (Homebrew's `llvm`, or set `CC_wasm32_unknown_unknown`). Crates come from `plugin/Cargo.lock`, and paths are remapped, so the same toolchain gives the same bytes in any checkout (the committed file was built with clang 23.1.5 from Homebrew). Commit `plugin.wasm` with every change to `plugin/`.
- `npm run build:plugin -w @algoviz/typst -- --check` rebuilds and says whether the committed `plugin.wasm` matches.

## How a figure is made

1. Typst loads `plugin.wasm` and calls `load` with `engine.bc` once, through `plugin.transition`.
2. Each figure is a call of `render` with a JSON request: `{ "algorithm": "dijkstra", "input": …, "step": "relax#3", "theme": "light" }`, or `{ "document": … }` with `step` or `steps`.
3. The plugin passes the text to `renderRequest`, defined by `src/main.ts`. The entry runs the algorithm with `runAlgorithm`, loads the document with `prepareFigures` from `@algoviz/svg`, and keeps it for later requests.
4. The answer is `{ "ok": true, "frames": n, "figures": [{ frame, selector, width, height, narration, svg }] }`, or `{ "ok": false, "diagnostics": […] }`.

QuickJS's stack limit (192 KiB) stops deep recursion at about 600 levels with a `RangeError`, before Typst's wasmi reaches its limit of 1,000 nested WebAssembly calls and traps. The entry reports any exception as an `ENGINE_ERROR` diagnostic. The clock QuickJS asks for always reads 0, so `Date` and the seed of `Math.random` are the same on every run, and the plugin stays pure.

## Tests

- `npm run check` runs `tests/*.spec.ts` with Node only. The plugin's SVG must be byte-identical to `exportFigures` for every registry example in every theme.
- `npm run test:typst` needs Typst 0.15 on PATH and takes about a minute. It installs a copy of `package/`, with a fresh `engine.bc`, as a local package in a temporary directory, then:
  - compiles every example;
  - compares the SVG that Typst gets from the package with `exportFigures`, byte for byte, for every registry example;
  - checks error boxes, strict mode and argument errors;
  - checks that deep recursion stops with a `RangeError` in Typst's wasmi.
- To look at the examples yourself, link `package/` as a local package (see its README) and compile them:

  ```sh
  typst compile --root examples examples/quickstart.typ
  ```
