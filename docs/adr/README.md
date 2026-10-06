# Architecture Decision Records

Each file records one architectural decision: the context, what we decided, and what follows from it. Records are immutable once accepted; to change a decision, add a new record that supersedes the old one and update the old record's status.

| ADR                                   | Title                                                            | Status   |
| ------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](0001-event-sourced-trace.md)   | Traces are event-sourced: actions are the source of truth        | Accepted |
| [0002](0002-structure-composition.md) | Visualizations compose structures as a product of state machines | Accepted |
| [0003](0003-pure-layout-scene-ir.md)  | Layout is a pure, DOM-free function producing a Scene IR         | Accepted |
| [0004](0004-zod-schema-source.md)     | Zod 4 is the single source for types, validation and JSON Schema | Accepted |
| [0005](0005-typescript-core.md)       | The core is written in TypeScript; a Rust port is deferred       | Accepted |
| [0006](0006-lit-web-components.md)    | The interactive player is built as Web Components with Lit       | Accepted |
| [0007](0007-explicit-element-ids.md)  | Element identity is explicit in the protocol                     | Accepted |

Template: Status · Context · Decision · Consequences.
