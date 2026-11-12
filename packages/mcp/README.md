# @algoviz/mcp

An MCP server that lets models write, check and render algoviz visualizations, and the same tools as a command line.

## Tools

| Tool                   | What it does                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `algoviz_guide`        | The authoring guide: the document format, and each structure kind with its actions and an example |
| `algoviz_validate`     | Checks a document, replaying every step; errors have a code, a JSON path, a message and a hint    |
| `algoviz_inspect`      | The state of every structure at chosen frames, to check that a document does what was meant       |
| `algoviz_render`       | One frame as a standalone SVG, in any built-in theme (`theme`)                                    |
| `algoviz_list_recipes` | Ready-made visualizations: id, title, topic, summary and the JSON Schema of each one's input      |
| `algoviz_run_recipe`   | Builds a recipe's document from its `id` and `input`                                              |
| `algoviz_show`         | Shows a valid document to the user as an interactive player, in clients that display MCP Apps     |

Tools that take frames accept a frame number (negative counts from the end) or a selector: a step name such as `relax#2`, a step in a section such as `insert-5/relax`, a section such as `insert-5`, or a range `a..b` ([ADR 0020](../../docs/adr/0020-step-names-and-sections.md)). `algoviz_render` and `algoviz_show` take one frame; `algoviz_inspect` reports each frame's step name, section and selector.

## Recipes

The recipes are the modules of the algorithm registry in `@algoviz/recipes` ([ADR 0019](../../docs/adr/0019-algorithm-registry.md), [ADR 0022](../../docs/adr/0022-registry-details.md)), so a new module appears here without changes to this package. Each has a stable, kebab-case id. An algorithm has one, such as `insertion-sort`. A data structure has one per operation, such as `bst.delete` or `min-heap.decrease-key`, whose input is the starting structure `from` and the operation's arguments. It also has one for its sequence, such as `bst`, whose input is `from` and up to 8 operations, `ops`.

Errors name the place in the input: `INVALID_SHAPE` at a path under `$.input`, `INVALID_ARGUMENT` for an input the recipe cannot show, such as a pop from an empty heap, and `UNKNOWN_RECIPE` at `$.id`.

The server also sends instructions for the workflow (recipe if one fits, otherwise guide → write → validate → inspect), serves the guide and the JSON Schema as resources (`algoviz://guide`, `algoviz://guide/<kind>`, `algoviz://schema`), and offers a `visualize` prompt.

## The player in the conversation

`algoviz_show` is an [MCP App](https://modelcontextprotocol.io/extensions/apps): its result links to `ui://algoviz/player.html`, a page the client draws in the conversation. The page is an `<algo-player>` that takes the document from the tool result, follows the client's light or dark theme, asks for the height it needs, and tells the model which frame the user stopped on, with its step name, section and narration, so the model can answer questions about what the user sees. Clients without MCP Apps get the text result only.

The page is built into one self-contained HTML file (`ui/player.html`, by `npm run build`), since clients load it in a sandbox with no network. `apps/playground/tests/e2e/mcp-app.spec.ts` runs it in a browser inside a minimal host.

## Using it

Build the workspace (`npm run build`), then register the server with a client. For Claude Code:

```sh
claude mcp add algoviz -- node /path/to/algorithm-visualizer/packages/mcp/dist/mcp-server.js
```

For Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "algoviz": {
      "command": "node",
      "args": ["/path/to/algorithm-visualizer/packages/mcp/dist/mcp-server.js"]
    }
  }
}
```

### Over HTTP

`algoviz-mcp --http` serves the same tools over Streamable HTTP instead of stdio, at `http://127.0.0.1:8787/mcp` ([ADR 0039](../../docs/adr/0039-http-transport.md)). `--port` picks another port (0 for any free one) and `--host` another address. On 127.0.0.1 it serves only pages and hosts on this machine, as the MCP specification asks of local servers; any other `--host` serves every origin.

```sh
node packages/mcp/dist/mcp-server.js --http --port 8787
claude mcp add --transport http algoviz http://127.0.0.1:8787/mcp
```

The transport is stateless: every POST gets one JSON answer, and there are no sessions. It refuses bodies over 1 MiB (413), anything but JSON (415), paths other than `/mcp` (404) and methods other than POST (405), gives up after 10 seconds (504), and answers an unexpected failure with a bare "Internal error". `createHttpHandler(options)` from `@algoviz/mcp` is the same server as a web-standard `{ fetch }` handler, for Workers, Deno or Bun; its options set the path, the limits, the allowed origins and the allowed hosts.

The command line offers the same tools:

```sh
algoviz guide graph table
algoviz validate doc.json
algoviz inspect doc.json 0 relax#2 -1
algoviz render doc.json --frame insert-5/relax --theme dark --out relax.svg
algoviz export doc.json --step insert-5 --theme print --out figures
algoviz export dijkstra --input 'A-B 4, B-C 1, A-C 7' --step relax#3,-1 --out figures
algoviz recipes
algoviz run bst.delete '"from": "8 3 10 1 6", "key": 3' --out delete.json
algoviz run dijkstra 'A-B 3, B-C 1'
algoviz run dijkstra '{"graph": {"nodes": ["A", "B"], "edges": [["A", "B", 3]]}, "source": "B"}'
algoviz run insertion-sort
```

An input is JSON, a JSON object with its outer braces left out, or a notation: a list `5 2 4 6 1 3`, a graph `A-B 4, B-C 2` (`->` for directed edges) or operations `insert 4, delete 3`. An input whose algorithm needs one thing may be that thing alone, such as a graph for Dijkstra's algorithm, and `run` without an input runs the algorithm's first example ([ADR 0032](../../docs/adr/0032-algorithm-and-input.md)).

In MCP, `algoviz_show`, `algoviz_render` and `algoviz_inspect` take a `recipe` and its `input` in place of a `document`, so a model shows a ready-made algorithm without copying its document.

From the repository without building, run `node --conditions=@algoviz/source packages/mcp/src/algoviz.ts …`.

`render` prints one frame with its text kept as text, which suits models and quick looks. `export` writes figures for documents ([ADR 0025](../../docs/adr/0025-exporting-figures.md)):

- **Source.** A document file (`-` reads standard input), or a registry id with `--input`, which takes an input or a file of one (a name ending in `.json` is always a file), and runs that algorithm first.
- **Steps.** `--step` takes any selector, may repeat, and may list several with commas. The figures are the frames they name, in timeline order; without `--step`, every frame.
- **Output.** Standalone SVG with text as glyph outlines, the step's narration as `<desc>`, and one size for every frame of the document. `--theme` picks a built-in theme: `light` (the default), `dark`, `print`, `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` or `turbo-c` ([ADR 0030](../../docs/adr/0030-built-in-themes.md)). `--format tikz` writes `.tex` figures for the LaTeX package instead: the same shapes in TikZ, with text left to the document's fonts ([ADR 0027](../../docs/adr/0027-latex-package.md)).
- **Files.** `--out` is a directory (created if missing; default the current one), and `--name` a pattern (default `{name}-{frame}`) with `{name}` (file name or algorithm id), `{frame}` (padded with zeros) and `{step}` (the selector with `/` and `#` written `_`). Existing files are replaced, and each written file is listed with its frame's selector. With `--format tikz`, `--one-file` writes every figure into one file, named `{name}` by default, for Beamer overlays ([ADR 0028](../../docs/adr/0028-slides.md)); the LaTeX package's `\algovizinput` draws it as a series.
- **Errors.** Exit code 1 for an invalid document or input (JSON that does not parse included), an unknown algorithm or a selector that matches nothing; 2 for usage errors, such as an unknown placeholder, `--out` given a `.svg` file, or `--one-file` with SVG or a `{frame}` in the name. Nothing is written unless every figure renders.
- **For programs.**
  - `--input-hex` takes the input as hexadecimal UTF-8 in place of `--input`, so a program that cannot quote JSON for every shell, such as the LaTeX package, can pass any input.
  - `--error-file <file>` also writes the message of a failure to that file, and removes the file after a success.

### Without Node.js

`npm run build:standalone -w @algoviz/mcp` builds `dist/standalone/algoviz`, a 2 MB executable that runs every command but the MCP server with no Node.js installed ([ADR 0027](../../docs/adr/0027-latex-package.md)). It is the CLI's JavaScript compiled to bytecode for QuickJS-ng, the engine the Typst plugin uses, inside a small Rust program. The build needs rustup, which installs the pinned Rust, and a C compiler. It builds for the machine it runs on; `-- --target <triple>` builds for another target the toolchain has.

A command takes about 20 ms to start, and one Dijkstra figure 45 ms on an Apple M4. Very long documents are slower than in Node, since QuickJS interprets: 0.3 s for the 1,024 steps of the longest bubble sort. `npm run test:standalone` builds the executable and checks that its figures are the Node CLI's, byte for byte. Releases for each platform wait for roadmap 4.3.

## The guide

`guide/` holds the guide as Markdown: `overview.md` and one file per kind. Tests check that every action of every kind is listed and that every example validates without warnings, so the guide cannot drift from the protocol. `evals/` measures how well models write documents from it.
