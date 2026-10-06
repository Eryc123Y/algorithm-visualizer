# @algoviz/mcp

An MCP server that lets models write, check and render algoviz visualizations, and the same tools as a command line.

## Tools

| Tool                   | What it does                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `algoviz_guide`        | The authoring guide: the document format, and each structure kind with its actions and an example |
| `algoviz_validate`     | Checks a document, replaying every step; errors have a code, a JSON path, a message and a hint    |
| `algoviz_inspect`      | The state of every structure at chosen frames, to check that a document does what was meant       |
| `algoviz_render`       | One frame as a standalone SVG                                                                     |
| `algoviz_list_recipes` | Ready-made visualizations of classic algorithms and their arguments                               |
| `algoviz_run_recipe`   | Builds a recipe's document for a given input                                                      |

The server also sends instructions for the workflow (recipe if one fits, otherwise guide → write → validate → inspect), serves the guide and the JSON Schema as resources (`algoviz://guide`, `algoviz://guide/<kind>`, `algoviz://schema`), and offers a `visualize` prompt.

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
algoviz inspect doc.json 0 -1
algoviz render doc.json --frame -1 --theme dark --out last.svg
algoviz recipe dijkstra '{"graph": {"nodes": ["A", "B"], "edges": [["A", "B", 3]]}, "source": "A"}'
```

From the repository without building, run `node --conditions=@algoviz/source packages/mcp/src/algoviz.ts …`.

## The guide

`guide/` holds the guide as Markdown: `overview.md` and one file per kind. Tests check that every action of every kind is listed and that every example validates without warnings, so the guide cannot drift from the protocol. `evals/` measures how well models write documents from it.
