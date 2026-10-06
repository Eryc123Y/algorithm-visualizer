# 0002. Visualizations compose structures as a product of state machines

- Status: Accepted
- Date: 2026-10-06

## Context

Real algorithms touch several structures at once: Dijkstra uses a graph, a priority queue and a distance array; DFS uses a graph and a stack; DP uses a table and an input array. Classifying visualizations by algorithm family ("graph algorithms") does not describe this, and a class hierarchy cannot be serialized to JSON or written by an LLM.

## Decision

- Each data structure is a **structure kind**: an implementation of `StructureKind` providing `init`, `reduce`, `layout` and an action `schema`.
- A visualization declares a record of named structures. Its state is the **product** of their states; its action type is the **sum** of their actions, each tagged with `target` (the structure's name). A composite reducer dispatches on `target`.
- In TypeScript, the composite types are derived with mapped types, e.g. `{ [K in keyof M]: ActionOf<M[K]> & { target: K } }[keyof M]`.
- The algorithm family is metadata, not part of the type hierarchy.
- Version 1 supports a **flat** record of structures only. Nested structures (hash table buckets, adjacency lists) and cross-structure references are deferred; `target` is designed so it can later become a path, and references will be a separate `links` layer.
- Built-in action sets are string-literal unions (not TypeScript `enum`). Custom actions and kinds must be registered with both a schema and a reducer; unvalidated custom actions are not allowed in the protocol.

## Consequences

- New structures (Turing machine tape, automata, number lines) are added by implementing one interface; nothing else in the pipeline changes.
- We follow the rule of three: the `StructureKind` interface is finalized only after `array`, `tree` and `graph` are implemented concretely.
