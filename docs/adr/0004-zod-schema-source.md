# 0004. Zod 4 is the single source for types, validation and JSON Schema

- Status: Accepted
- Date: 2026-10-06

## Context

The protocol needs three artefacts that must never drift apart: static TypeScript types for developers, runtime validation for untrusted input (LLM output is often slightly wrong), and JSON Schema for LLMs, MCP tool definitions and A2UI catalogs. Candidates were Zod 4, TypeBox and Valibot.

## Decision

Protocol types are defined once as Zod 4 schemas. TypeScript types are inferred with `z.infer`, validation uses `safeParse`, and JSON Schema is generated with `z.toJSONSchema`.

## Consequences

- One definition, three outputs; no hand-maintained duplicates.
- Zod is a runtime dependency of the `spec` package. Packages that only need types import them with `import type`.
- Validation error messages are post-processed into an LLM-oriented format (step index, target, code, hint) rather than shown raw.
- Generated JSON Schema is checked into the repository and verified in CI, so protocol changes show up in review.
