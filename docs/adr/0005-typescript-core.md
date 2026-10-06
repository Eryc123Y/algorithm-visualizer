# 0005. The core is written in TypeScript; a Rust port is deferred

- Status: Accepted
- Date: 2026-10-06

## Context

A Rust core compiled to WASM could be shared by the web, Typst plugins and Python bindings. However, the team works primarily in TypeScript, the protocol is still changing quickly, and every consumer we need first (web player, MCP, CLI, Typst via pre-rendered SVG) works with a TypeScript core.

## Decision

The core (spec, engine, reducers, layout) is written in TypeScript. We keep it portable:

- No DOM or Node APIs in `spec` or `core` (enforced by lint rules and tsconfig `lib`/`types`).
- Pure functions and plain JSON data at every boundary.
- A language-agnostic **conformance suite**: fixture traces with expected states and scenes as JSON files. Any future implementation must pass the same fixtures.

We revisit a Rust port when at least one of these holds: the protocol reaches 1.0, in-Typst rendering via a WASM plugin is a committed goal, Python bindings are needed, or layout performance becomes a measured problem.

## Consequences

- Fast iteration while the protocol is unstable, in a language the whole team can review.
- Typst support starts with pre-rendered SVG (or Scene JSON drawn natively in Typst); in-Typst rendering waits for the revisit.
- The conformance suite is useful immediately as regression tests, and later as the porting contract.
