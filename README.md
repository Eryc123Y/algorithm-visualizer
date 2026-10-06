# algoviz (working name)

An AI-native library for step-by-step visualizations of algorithms and data structures, for developers and teachers.

A visualization is a declarative JSON document: the structures involved and a timeline of steps, each applying actions such as `compare` or `swap`. People write it with code, LLMs write it directly, and the library validates it and renders it as an interactive player, a static image, or a figure in Typst or LaTeX.

> Status: early development. The protocol package exists; the engine, renderers and integrations are in progress.

```json
{
  "version": "0.1",
  "structures": { "arr": { "kind": "array", "initial": [5, 3, 8, 1] } },
  "steps": [
    {
      "actions": [{ "target": "arr", "type": "compare", "i": 0, "j": 1 }],
      "meta": { "line": 3, "narration": "Compare 5 and 3." }
    },
    {
      "actions": [{ "target": "arr", "type": "swap", "i": 0, "j": 1 }],
      "meta": { "line": 4, "narration": "5 > 3, so swap them." }
    }
  ]
}
```

## Packages

| Package                          | Status    | Purpose                                               |
| -------------------------------- | --------- | ----------------------------------------------------- |
| [`@algoviz/spec`](packages/spec) | Available | Protocol schemas, types, validation and JSON Schema   |
| `@algoviz/core`                  | Next      | Structure kinds, reducers, timeline and layout        |
| `@algoviz/elements`              | Planned   | Interactive player as Web Components (Lit)            |
| `@algoviz/mcp`                   | Planned   | MCP server and MCP App for Claude, ChatGPT and others |

## Design

The architecture is documented as decision records in [`docs/adr/`](docs/adr). In short: traces are event-sourced (actions are the source of truth and states are derived by pure reducers), layout is a pure function so the same visualization can be rendered anywhere, and every document is validated before rendering with errors an LLM can act on.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
