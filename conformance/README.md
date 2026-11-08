# Conformance fixtures

Language-agnostic test data for the protocol (ADR 0005). Every implementation, in any language, must produce the same results for these files.

## `spec/`: static validation

- `valid/*.json`: `{ "description", "input", "expected" }`. Parsing `input` must succeed and produce exactly `expected` (the canonical form).
- `invalid/*.json`: `{ "description", "input", "expectedErrors" }`. Parsing `input` must fail with exactly these `{ code, path }` pairs, in order. Messages and hints are not compared.

## `core/`: replay

- `valid/*.json`: `{ "description", "input", "expectedLength", "expectedFrames" }`. Loading `input` must succeed with `expectedLength` steps, and each listed frame `{ index, state }` must equal the engine's state at that index. Frame 0 is the initial state; frame `n` is the state after step `n`.
- `invalid/*.json`: `{ "description", "input", "expectedErrors" }`. Loading must fail with exactly these `{ code, path }` pairs. Static protocol errors take precedence over replay errors, and replay stops at the first invalid action.

A state maps each structure name to `{ "kind", "state": { "data", "marks" } }`.

## `layout/`: scenes

- `*.json`: `{ "description", "input", "frames" }`. With the default layout options and metrics measured over the whole trace, the scene of each listed frame `{ index, scene }` must equal the expected scene exactly, including item order. Coordinates are hand-computed from the rules in `packages/core/src/layout/`, with text widths from the metrics of the bundled fonts in `packages/fonts/src/faces/` (ADR 0024). A structure alone in its document has no caption unless it has a `label`.
