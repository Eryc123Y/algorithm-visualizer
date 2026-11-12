# @algomotion/mcp

An MCP server that lets models write, check and render algomotion visualizations, and the same tools as a command line.

## Tools

| Tool                      | What it does                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `algomotion_guide`        | The authoring guide: the document format, and each structure kind with its actions and an example |
| `algomotion_validate`     | Checks a document, replaying every step; errors have a code, a JSON path, a message and a hint    |
| `algomotion_inspect`      | The state of every structure at chosen frames, to check that a document does what was meant       |
| `algomotion_render`       | One frame as a standalone SVG, in any built-in theme (`theme`)                                    |
| `algomotion_list_recipes` | Ready-made visualizations: id, title, topic, summary and the JSON Schema of each one's input      |
| `algomotion_run_recipe`   | Builds a recipe's document from its `id` and `input`                                              |
| `algomotion_show`         | Shows a valid document to the user as an interactive player, in clients that display MCP Apps     |

Tools that take frames accept a frame number (negative counts from the end) or a selector: a step name such as `relax#2`, a step in a section such as `insert-5/relax`, a section such as `insert-5`, or a range `a..b` ([ADR 0020](../../docs/adr/0020-step-names-and-sections.md)). `algomotion_render` and `algomotion_show` take one frame; `algomotion_inspect` reports each frame's step name, section and selector.

## Recipes

The recipes are the modules of the algorithm registry in `@algomotion/recipes` ([ADR 0019](../../docs/adr/0019-algorithm-registry.md), [ADR 0022](../../docs/adr/0022-registry-details.md)), so a new module appears here without changes to this package. Each has a stable, kebab-case id. An algorithm has one, such as `insertion-sort`. A data structure has one per operation, such as `bst.delete` or `min-heap.decrease-key`, whose input is the starting structure `from` and the operation's arguments. It also has one for its sequence, such as `bst`, whose input is `from` and up to 8 operations, `ops`.

Errors name the place in the input: `INVALID_SHAPE` at a path under `$.input`, `INVALID_ARGUMENT` for an input the recipe cannot show, such as a pop from an empty heap, and `UNKNOWN_RECIPE` at `$.id`.

The server also sends instructions for the workflow (recipe if one fits, otherwise guide → write → validate → inspect), serves the guide and the JSON Schema as resources (`algomotion://guide`, `algomotion://guide/<kind>`, `algomotion://schema`), and offers a `visualize` prompt.

## The player in the conversation

`algomotion_show` is an [MCP App](https://modelcontextprotocol.io/extensions/apps): its result links to `ui://algomotion/player.html`, a page the client draws in the conversation. The page is an `<algo-player>` that takes the document from the tool result, follows the client's light or dark theme, asks for the height it needs, and tells the model which frame the user stopped on, with its step name, section and narration, so the model can answer questions about what the user sees. Clients without MCP Apps get the text result only.

## Share links

A share link opens a visualization in the player in any browser, with nothing installed ([ADR 0040](../../docs/adr/0040-share-links.md)). It carries a recipe and its input, `#v=1&alg=dijkstra&in=A-B%204%2C%20B-C%201`, or a whole document compressed, `#v=1&doc=…`, in the fragment of the share page's address, which browsers never send to a server.

The server makes links only when it knows where the share page is, since no address is assumed: set `ALGOMOTION_SHARE_URL` to the page's address, such as `https://example.org/play/` (`createServer({ shareUrl })` in code). `algomotion_show` and `algomotion_run_recipe` then add a second text item with the link: a recipe's link names the recipe and its input, and a document's carries the document. A link longer than 16,384 characters is not made, and the item says so. An address that is not an absolute `http:` or `https:` URL, or that has a fragment, stops the server at start. The page is built by `apps/site` (`npm run build -w @algomotion/site`, then serve `apps/site/dist`).

The page is built into one self-contained HTML file (`ui/player.html`, by `npm run build`), since clients load it in a sandbox with no network. `apps/playground/tests/e2e/mcp-app.spec.ts` runs it in a browser inside a minimal host.

## Using it

Build the workspace (`npm run build`), then register the server with a client. For Claude Code:

```sh
claude mcp add algomotion -- node /path/to/algorithm-visualizer/packages/mcp/dist/mcp-server.js
```

For Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "algomotion": {
      "command": "node",
      "args": ["/path/to/algorithm-visualizer/packages/mcp/dist/mcp-server.js"],
      "env": { "ALGOMOTION_SHARE_URL": "https://example.org/play/" }
    }
  }
}
```

The `env` entry is optional: it is the address of a share page you serve, for share links (see Share links above).

### Over HTTP

`algomotion-mcp --http` serves the same tools over Streamable HTTP instead of stdio, at `http://127.0.0.1:8787/mcp` ([ADR 0039](../../docs/adr/0039-http-transport.md)). `--port` picks another port (0 for any free one) and `--host` another address. On 127.0.0.1 it serves only pages and hosts on this machine, as the MCP specification asks of local servers; any other `--host` serves every origin.

```sh
node packages/mcp/dist/mcp-server.js --http --port 8787
claude mcp add --transport http algomotion http://127.0.0.1:8787/mcp
```

The transport is stateless: every POST gets one JSON answer, and there are no sessions. It refuses bodies over 1 MiB (413), anything but JSON (415), paths other than `/mcp` (404) and methods other than POST (405), gives up after 10 seconds, the body's arrival included (504), and answers an unexpected failure with a bare "Internal error". The Node server also allows 10 seconds for headers and 30 for a whole request, and 256 connections at once. `createHttpHandler(options)` from `@algomotion/mcp` is the same server as a web-standard `{ fetch }` handler, for Workers, Deno or Bun; its options set the path, the limits, the allowed origins, the allowed hosts and the share page's address (`shareUrl`). `ALGOMOTION_SHARE_URL` works over HTTP as over stdio.

The command line offers the same tools:

```sh
algomotion guide graph table
algomotion validate doc.json
algomotion inspect doc.json 0 relax#2 -1
algomotion render doc.json --frame insert-5/relax --theme dark --out relax.svg
algomotion export doc.json --step insert-5 --theme print --out figures
algomotion export dijkstra --input 'A-B 4, B-C 1, A-C 7' --step relax#3,-1 --out figures
algomotion recipes
algomotion run bst.delete '"from": "8 3 10 1 6", "key": 3' --out delete.json
algomotion run dijkstra 'A-B 3, B-C 1'
algomotion run dijkstra '{"graph": {"nodes": ["A", "B"], "edges": [["A", "B", 3]]}, "source": "B"}'
algomotion run insertion-sort
```

An input is JSON, a JSON object with its outer braces left out, or a notation: a list `5 2 4 6 1 3`, a graph `A-B 4, B-C 2` (`->` for directed edges) or operations `insert 4, delete 3`. An input whose algorithm needs one thing may be that thing alone, such as a graph for Dijkstra's algorithm, and `run` without an input runs the algorithm's first example ([ADR 0032](../../docs/adr/0032-algorithm-and-input.md)).

In MCP, `algomotion_show`, `algomotion_render` and `algomotion_inspect` take a `recipe` and its `input` in place of a `document`, so a model shows a ready-made algorithm without copying its document.

From the repository without building, run `node --conditions=@algomotion/source packages/mcp/src/algomotion.ts …`.

`render` prints one frame with its text kept as text, which suits models and quick looks. `export` writes figures for documents ([ADR 0025](../../docs/adr/0025-exporting-figures.md)):

- **Source.** A document file (`-` reads standard input), or a registry id with `--input`, which takes an input or a file of one (a name ending in `.json` is always a file), and runs that algorithm first.
- **Steps.** `--step` takes any selector, may repeat, and may list several with commas. The figures are the frames they name, in timeline order; without `--step`, every frame.
- **Output.** Standalone SVG with text as glyph outlines, the step's narration as `<desc>`, and one size for every frame of the document. `--theme` picks a built-in theme: `light` (the default), `dark`, `print`, `textbook`, `textbook-dark`, `blocks`, `blocks-dark`, `answer-sheet` or `turbo-c` ([ADR 0030](../../docs/adr/0030-built-in-themes.md)). `--format tikz` writes `.tex` figures for the LaTeX package instead: the same shapes in TikZ, with text left to the document's fonts ([ADR 0027](../../docs/adr/0027-latex-package.md)).
- **Files.** `--out` is a directory (created if missing; default the current one), and `--name` a pattern (default `{name}-{frame}`) with `{name}` (file name or algorithm id), `{frame}` (padded with zeros) and `{step}` (the selector with `/` and `#` written `_`). Existing files are replaced, and each written file is listed with its frame's selector. With `--format tikz`, `--one-file` writes every figure into one file, named `{name}` by default, for Beamer overlays ([ADR 0028](../../docs/adr/0028-slides.md)); the LaTeX package's `\algomotioninput` draws it as a series.
- **Errors.** Exit code 1 for an invalid document or input (JSON that does not parse included), an unknown algorithm or a selector that matches nothing; 2 for usage errors, such as an unknown placeholder, `--out` given a `.svg` file, or `--one-file` with SVG or a `{frame}` in the name. Nothing is written unless every figure renders.
- **For programs.**
  - `--input-hex` takes the input as hexadecimal UTF-8 in place of `--input`, so a program that cannot quote JSON for every shell, such as the LaTeX package, can pass any input.
  - `--error-file <file>` also writes the message of a failure to that file, and removes the file after a success.

### Without Node.js

`npm run build:standalone -w @algomotion/mcp` builds `dist/standalone/algomotion`, a 3 MB executable that runs every command but the MCP server with no Node.js installed ([ADR 0027](../../docs/adr/0027-latex-package.md)). It is the CLI's JavaScript compiled to bytecode for QuickJS-ng, the engine the Typst plugin uses, inside a small Rust program. The build needs rustup, which installs the pinned Rust, and a C compiler. It builds for the machine it runs on; `-- --target <triple>` builds for another target the toolchain has.

A command takes about 20 ms to start, and one Dijkstra figure 45 ms on an Apple M4. Very long documents are slower than in Node, since QuickJS interprets: 0.3 s for the 1,024 steps of the longest bubble sort. `npm run test:standalone` builds the executable and checks that its figures are the Node CLI's, byte for byte. Releases for each platform wait for roadmap 4.3.

## The guide

`guide/` holds the guide as Markdown: `overview.md` and one file per kind. Tests check that every action of every kind is listed and that every example validates without warnings, so the guide cannot drift from the protocol. `evals/` measures how well models write documents from it.
