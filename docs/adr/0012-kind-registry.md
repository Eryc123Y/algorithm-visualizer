# 0012. Structure kinds are plug-ins of one registry

- Status: Accepted
- Date: 2026-10-06

## Context

The protocol started with one structure, the array, and its handling was spread over `switch` statements in the parser, the reducer dispatch, the metrics and the layout. Covering undergraduate algorithms needs at least eight kinds (array, stack, queue, linked list, tree, graph, table, hash table), and later ones (Turing machines, number lines, plots) should not need edits all over the code base.

## Decision

A kind is a pair of plug-ins, one per layer, each listed once in a registry:

- **Protocol** (`@algoviz/spec`, `kinds/<kind>.ts`): a `KindSpec` with the canonical and authoring schemas of its declaration and actions, `normalizeDecl`, `normalizeAction` (shorthands, generated ids), `declIds` / `introducedIds` (for the trace-wide id rules of ADR 0007) and an optional `validateDecl` for rules a schema cannot express (tree shape, edge endpoints). The parser is generic over this interface and has no kind-specific code.
- **Engine** (`@algoviz/core`): a `KindRuntime` with `init`, `beginStep` (clear one-step marks), the pure `reduce`, and `measure` / `mergeMetrics` / `layout` (ADR 0003, 0008). Reducers and layouts live in separate modules and are joined in `registry.ts`.

Types flow from the registries: `KindTypeMap[K]` holds a kind's declaration and action types, and dispatch helpers are generic in the kind name (`function reduceOf<K>(kind: K, state: State<K>, action: Action<K>)`), TypeScript's correlated-union pattern, so no call site needs a cast. The engine registry is checked with `satisfies` against the protocol registry, so a kind declared in the protocol but missing in the engine, or with a mismatched action type, does not compile.

Actions are routed by the target structure's kind, so kinds may reuse action names with different fields (`highlight` takes indices on arrays, node ids on graphs). Tools that build documents get one typed method per action for free: the `@algoviz/recipes` recorder derives its handles from `KindTypeMap`.

Adding a kind therefore means: one protocol module and one registry entry; a reducer, a layout and one registry entry; conformance fixtures; and an entry in `TargetedAction` / `StructureDecl`, whose order defines the JSON Schema.

## Consequences

- The parser, trace engine, layout dispatch, painters and player did not change when six kinds were added.
- Kinds are not yet loadable at run time: third-party kinds would need the registries to accept entries from outside, plus a namespacing rule for kind names. The interfaces are designed for that, but it is not exposed.
- The CDN bundle carries every kind's schemas (about 71 kB gzip with eight kinds, up from 48 kB with one). Lazy loading per kind is possible later because nothing outside the registries refers to a kind module.
