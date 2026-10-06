# algoviz (working name)

An AI-native library for step-by-step visualizations of algorithms and data structures, for developers and teachers.

A visualization is a declarative JSON document: the structures involved and a timeline of steps, each applying actions such as `compare` or `swap`. People write it with code, LLMs write it directly, and the library validates it and renders it as an interactive player, a static image, or a figure in Typst or LaTeX.

> Status: early development. Arrays work end to end: protocol, timeline engine, layout, static SVG and an interactive player. More structures and AI integrations (MCP) are next.

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

## Embedding

Build the standalone bundle with `npm run build -w @algoviz/elements`, then:

```html
<script type="module" src="algoviz-player.js"></script>

<algo-player theme="auto">
  <script type="application/json">
    { "version": "0.1", "structures": { … }, "steps": [ … ] }
  </script>
</algo-player>
```

Attributes: `src`, `frame`, `theme` (`auto` · `light` · `dark` · `print`), `speed` (ms per step), `autoplay`, `loop`, `hide-controls`, `hide-code`. Style the chrome with CSS custom properties such as `--algo-accent`, or pass a full scene theme as the `customTheme` property.

For a purely visual animation without any teaching chrome, use display mode: it shows only the structures, plays and loops by itself, and pauses while off screen.

```html
<algo-player mode="display" speed="700" src="bubble-sort.json"></algo-player>
```

Display mode also accepts `once` (play a single time) and `motion` (`linear` · `arc`).

## Packages

| Package                                  | Status    | Purpose                                                           |
| ---------------------------------------- | --------- | ----------------------------------------------------------------- |
| [`@algoviz/spec`](packages/spec)         | Available | Protocol schemas, types, validation and JSON Schema               |
| [`@algoviz/core`](packages/core)         | Available | Structure kinds, reducers, timeline engine and layout to scenes   |
| [`@algoviz/svg`](packages/svg)           | Available | Renders scenes to standalone SVG (no DOM needed)                  |
| [`@algoviz/elements`](packages/elements) | Available | `<algo-player>`: interactive, animated player (Lit Web Component) |
| `@algoviz/mcp`                           | Planned   | MCP server and MCP App for Claude, ChatGPT and others             |

## Design

The architecture is documented as decision records in [`docs/adr/`](docs/adr). In short: traces are event-sourced (actions are the source of truth and states are derived by pure reducers), layout is a pure function so the same visualization can be rendered anywhere, and every document is validated before rendering with errors an LLM can act on.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
