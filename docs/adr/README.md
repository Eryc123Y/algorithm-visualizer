# Architecture Decision Records

Each file records one architectural decision: the context, what we decided, and what follows from it. Records are immutable once accepted; to change a decision, add a new record that supersedes the old one and update the old record's status.

| ADR                                                 | Title                                                                | Status                              |
| --------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| [0001](0001-event-sourced-trace.md)                 | Traces are event-sourced: actions are the source of truth            | Accepted                            |
| [0002](0002-structure-composition.md)               | Visualizations compose structures as a product of state machines     | Accepted                            |
| [0003](0003-pure-layout-scene-ir.md)                | Layout is a pure, DOM-free function producing a Scene IR             | Accepted                            |
| [0004](0004-zod-schema-source.md)                   | Zod 4 is the single source for types, validation and JSON Schema     | Accepted                            |
| [0005](0005-typescript-core.md)                     | The core is written in TypeScript; a Rust port is deferred           | Accepted                            |
| [0006](0006-lit-web-components.md)                  | The interactive player is built as Web Components with Lit           | Accepted                            |
| [0007](0007-explicit-element-ids.md)                | Element identity is explicit in the protocol                         | Accepted                            |
| [0008](0008-trace-wide-layout-metrics.md)           | Layout uses metrics measured over the whole trace                    | Accepted                            |
| [0009](0009-accessible-themable-visual-encoding.md) | Visual encoding is redundant, and themes are partial overrides       | Accepted                            |
| [0010](0010-player-architecture.md)                 | Player architecture: shared painting, keyed animation, no decorators | Accepted                            |
| [0011](0011-display-mode.md)                        | Display mode: the player as a purely visual element                  | Accepted                            |
| [0012](0012-kind-registry.md)                       | Structure kinds are plug-ins of one registry                         | Accepted                            |
| [0013](0013-node-link-layout.md)                    | Node-link layout: stable positions, routed edges, free-space labels  | Accepted                            |
| [0014](0014-mcp-and-evals.md)                       | Models write documents through MCP tools, and evals measure how well | Accepted                            |
| [0015](0015-mcp-app-player.md)                      | The player opens in the conversation as an MCP App                   | Accepted                            |
| [0016](0016-code-highlighting.md)                   | Source code is highlighted by small, pure tokenizers                 | Accepted                            |
| [0017](0017-multi-language-source.md)               | A document may carry its source in several languages                 | Accepted                            |
| [0018](0018-operation-recipes.md)                   | Data-structure operations are recipes that start from a given state  | Accepted, partly superseded by 0019 |
| [0019](0019-algorithm-registry.md)                  | Every algorithm is a module in one registry                          | Accepted, refined by 0022           |
| [0020](0020-step-names-and-sections.md)             | Steps have names and documents have sections                         | Accepted                            |
| [0021](0021-protocol-versioning.md)                 | The protocol version says what a reader must understand              | Accepted                            |
| [0022](0022-registry-details.md)                    | Registry details: traces, structure modules, ids and sorting         | Accepted                            |
| [0023](0023-remaining-modules.md)                   | The remaining recipes as registry modules: ids, inputs, procedures   | Accepted                            |

Template: Status · Context · Decision · Consequences.
