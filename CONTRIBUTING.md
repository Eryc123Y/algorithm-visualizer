# Contributing

## Setup

Requirements: Node.js >= 22.12 (see `.nvmrc`) and npm. Everything else is a dev dependency.

```shell
npm install
npx playwright install chromium   # only needed for E2E tests
npm run dev                       # start the playground
```

## Repository layout

This is an npm workspaces monorepo.

| Path                 | Package               | Purpose                                                                                      |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `packages/spec/`     | `@algoviz/spec`       | Protocol: Zod schemas, inferred types, parsing and validation. No DOM or Node.js APIs.       |
| `packages/core/`     | `@algoviz/core`       | Structure kinds, reducers, the timeline engine and layout to scenes. No DOM or Node.js APIs. |
| `packages/svg/`      | `@algoviz/svg`        | Scene → standalone SVG string. No DOM or Node.js APIs.                                       |
| `packages/elements/` | `@algoviz/elements`   | `<algo-player>` Web Component (Lit) and a standalone CDN bundle.                             |
| `packages/recipes/`  | `@algoviz/recipes`    | Typed recorder and classic algorithms, each tested against a reference implementation.       |
| `apps/playground/`   | `@algoviz/playground` | Vite + Vue app for demos and, later, documentation.                                          |
| `conformance/`       | —                     | Language-agnostic JSON fixtures every implementation must pass.                              |
| `docs/adr/`          | —                     | Architecture decision records. Read these before changing the design.                        |

Workspace packages expose their TypeScript sources through the `@algoviz/source` export condition. The playground, Vitest and the type checker use it, so nothing needs to be built before development or tests. Published consumers get `dist/`.

## Commands

Run from the repository root.

| Command                                     | Purpose                                                             |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                               | Start the playground dev server                                     |
| `npm run build`                             | Type-check and build every workspace                                |
| `npm run typecheck`                         | Type-check every project (`vue-tsc --build`)                        |
| `npm run lint` / `lint:fix`                 | ESLint                                                              |
| `npm run format` / `format:check`           | Prettier                                                            |
| `npm test` / `test:watch` / `test:coverage` | Unit tests for all workspaces (Vitest)                              |
| `npm run test:e2e`                          | Playwright tests against the playground's production build          |
| `npm run check`                             | Typecheck, lint, format check and unit tests (what CI runs first)   |
| `npm run generate:schema -w @algoviz/spec`  | Regenerate `packages/spec/schema/visualization.schema.json`         |
| `npm run gallery -- out.html [file.json …]` | Render every frame of fixtures or documents to one page, for review |

The pre-commit hook runs ESLint and Prettier on staged files. Run `npm run check` before pushing.

## Code conventions

- **TypeScript:** strict settings from `tsconfig.base.json`, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Only erasable syntax: no `enum`, `namespace` or parameter properties. Use string-literal unions instead of enums.
- **Imports:** relative imports inside packages use the `.ts` extension; type-only imports use `import type`.
- **Errors:** functions that can fail on untrusted input return a `Result`; reserve exceptions for programmer errors.
- **Protocol changes:** edit the Zod schemas, regenerate the JSON Schema, and add conformance fixtures for the new behaviour.
- **Naming:** files in `packages/` use kebab-case; Vue components use PascalCase file and component names; variables and functions use camelCase.
- **Comments:** start each module with a short summary of its purpose, document exported functions and types with JSDoc, and explain non-obvious decisions where they are made.

## Adding a structure kind

Kinds are plug-ins (ADR 0012). Use an existing kind of similar shape as the model (`stack` for a linear kind, `tree` or `graph` for node-link kinds).

1. **Protocol:** add `packages/spec/src/kinds/<kind>.ts` exporting a `KindSpec`, register it in `kinds/index.ts`, and add its schemas to `TargetedAction`, `TargetedActionInput`, `StructureDecl` and `StructureDeclInput` in `visualization.ts`. Regenerate the JSON Schema.
2. **Engine:** add the reducer in `packages/core/src/kinds/` and the layout in `packages/core/src/layout/`, and register both in `packages/core/src/registry.ts`. The `satisfies` check there fails until the runtime matches the protocol.
3. **Tests:** add conformance fixtures (valid replays with hand-computed states, invalid documents with expected error paths); scene invariants then run on them automatically. Check the result with `npm run gallery`.
4. **Guide:** add `packages/mcp/guide/kinds/<kind>.md` with the declaration, a table row for every action and a complete example. Tests fail until every action is listed and the example validates.
5. **Recipes and evals:** the recorder picks up the new actions by itself; add a recipe if a classic algorithm uses the kind, and an eval task in `evals/` that needs it.

## Adding an algorithm

Every algorithm, and every operation of a data structure, is a module of the registry in `@algoviz/recipes` (ADR 0019, ADR 0022). MCP, the command line and the playground read the registry, so a module needs no other changes.

1. **Module:** add `packages/recipes/src/algorithms/<topic>/<id>.ts` and export the module made by `defineAlgorithm`:
   - a kebab-case `id`, a `title`, a `topic`, a one-sentence `summary`;
   - a Zod `input` schema, and `examples`, the first being the default in menus;
   - its `code` in pseudocode (CLRS conventions, indices from 0, our own words) and in Python, with `// @name` and `# @name` markers on the lines steps point at;
   - `run(input, trace)`, which declares structures with `trace.add` and starts every step with `trace.step(anchor, narration)`. Narrations name values, not the syntax of either language. Throw a `RangeError` for an input the module cannot show.

   A data structure goes in `packages/recipes/src/structures/<name>/`, with `defineStructure`: a model, `start`, `describe`, `declare` and one entry per operation (ADR 0018).

2. **Registry:** add the module to `algorithms` in `packages/recipes/src/registry.ts`, next to its topic.
3. **Tests:** `tests/registry.spec.ts` checks every module (examples, anchors, narrations, step names, determinism). Add the module's own test against an independent reference implementation, and property tests in `tests/properties.spec.ts`.
4. **Look at it:** open it in the playground, in both languages.

## Tests

- Unit tests live in each workspace's `tests/` directory as `*.spec.ts`.
- Type-level behaviour is tested with `expectTypeOf`; those assertions are enforced by `npm run typecheck`, not by Vitest.
- Behaviour that other implementations must match belongs in `conformance/` as JSON fixtures (see its README).
- E2E tests live in `apps/playground/tests/e2e/` and run against production builds: the playground, and the standalone `<algo-player>` bundle in a plain page. They check what the player draws against the engine's scene for each frame, fail on any console error, and scan for accessibility problems with axe. Run them with `npm run test:e2e`; to use a Chromium that is already installed, set `PLAYWRIGHT_CHROMIUM=/path/to/chromium`.
- Generative (property-based) tests live in `packages/core/tests/properties/` and `packages/recipes/tests/properties.spec.ts`. They run a few dozen random cases by default; run them deeper before a release with `FUZZ_RUNS=5000 npx vitest run --project core --project recipes`, and replay a failure with the `FUZZ_SEED` it prints.

## Git workflow

- `main` holds stable code. Work on a feature branch and merge only when CI is green.
- Commit messages follow `type(scope): description`, for example `feat(spec): add tree actions`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Record architectural changes as a new ADR in `docs/adr/`.
