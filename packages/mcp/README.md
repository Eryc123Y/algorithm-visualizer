# @algoviz/mcp

An MCP server that lets models write, check and render algoviz visualizations, and the same tools as a command line.

## Tools

| Tool                   | What it does                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `algoviz_guide`        | The authoring guide: the document format, and each structure kind with its actions and an example |
| `algoviz_validate`     | Checks a document, replaying every step; errors have a code, a JSON path, a message and a hint    |
| `algoviz_inspect`      | The state of every structure at chosen frames, to check that a document does what was meant       |
| `algoviz_render`       | One frame as a standalone SVG                                                                     |
| `algoviz_list_recipes` | Ready-made visualizations: id, title, topic, summary and the JSON Schema of each one's input      |
| `algoviz_run_recipe`   | Builds a recipe's document from its `id` and `input`                                              |
| `algoviz_show`         | Shows a valid document to the user as an interactive player, in clients that display MCP Apps     |

Tools that take frames accept a frame number (negative counts from the end) or a selector: a step name such as `relax#2`, a step in a section such as `insert-5/relax`, a section such as `insert-5`, or a range `a..b` ([ADR 0020](../../docs/adr/0020-step-names-and-sections.md)). `algoviz_render` and `algoviz_show` take one frame; `algoviz_inspect` reports each frame's step name, section and selector.

## Recipes

The recipes are the modules of the algorithm registry in `@algoviz/recipes` ([ADR 0019](../../docs/adr/0019-algorithm-registry.md), [ADR 0022](../../docs/adr/0022-registry-details.md)), so a new module appears here without changes to this package. Each has a stable, kebab-case id. A data structure has one per operation, such as `bst.delete` or `min-heap.decrease-key`, whose input is the starting structure `from` and the operation's arguments. It also has one for its sequence, such as `bst`, whose input is `from` and up to 8 operations, `ops`.

Errors name the place in the input: `INVALID_SHAPE` at a path under `$.input`, `INVALID_ARGUMENT` for an input the recipe cannot show, such as a pop from an empty heap, and `UNKNOWN_RECIPE` at `$.id`.

Recipes not yet migrated to the registry keep their camelCase ids, such as `dijkstra`, until roadmap 0.5 (`src/legacy-recipes.ts`).

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

The command line offers the same tools:

```sh
algoviz guide graph table
algoviz validate doc.json
algoviz inspect doc.json 0 relax#2 -1
algoviz render doc.json --frame insert-5/relax --theme dark --out relax.svg
algoviz recipes
algoviz run bst.delete '{"from": [8, 3, 10, 1, 6], "key": 3}' --out delete.json
algoviz run dijkstra '{"graph": {"nodes": ["A", "B"], "edges": [["A", "B", 3]]}, "source": "A"}'
```

From the repository without building, run `node --conditions=@algoviz/source packages/mcp/src/algoviz.ts …`.

## The guide

`guide/` holds the guide as Markdown: `overview.md` and one file per kind. Tests check that every action of every kind is listed and that every example validates without warnings, so the guide cannot drift from the protocol. `evals/` measures how well models write documents from it.
