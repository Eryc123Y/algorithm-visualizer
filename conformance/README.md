# Conformance fixtures

Language-agnostic test data for the protocol (ADR 0005). Every implementation, in any language, must produce the same results for these files.

## `spec/`: static validation

- `valid/*.json`: `{ "description", "input", "expected" }`. Parsing `input` must succeed and produce exactly `expected` (the canonical form).
- `invalid/*.json`: `{ "description", "input", "expectedErrors" }`. Parsing `input` must fail with exactly these `{ code, path }` pairs, in order. Messages and hints are not compared.

Later suites will add expected states (`core/`) and scenes (`layout/`).
