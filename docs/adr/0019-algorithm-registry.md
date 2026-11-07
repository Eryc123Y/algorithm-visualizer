# 0019. Every algorithm is a module in one registry

## Status

Accepted

## Context

Version 1.0 covers about a hundred algorithms and operations (requirements R1), and each must be reachable the same way from MCP, the command line, the playground, the documentation site and the Typst and LaTeX packages (R5, R7). Today one algorithm is described in up to four places:

- **Recipe functions** in `@algoviz/recipes`. Each has its own signature, such as `dijkstra(graph, source)`. The code shown is a `python()` string, with line numbers written by hand in every `r.step({ line: 5 })`.
- **Operation definitions** (`StructureDef`, ADR 0018). These are data-structure operations with `# @anchor` markers and a `Tape`.
- **The MCP catalogue** (`packages/mcp/src/recipes.ts`). It holds 26 hand-written entries with their own Zod argument schemas, names and descriptions, kept in step with the functions by hand.
- **The playground** (`apps/playground/src/samples/examples.ts`). It is another hand-written list, with its own labels and inputs.

Adding an algorithm means editing all four. Nothing checks that they agree, and a caller that has only an id and JSON, such as the Typst package, cannot call a recipe without a hand-written adapter.

## Decision

**Module.** Every algorithm, and every operation of a data structure, is one module that satisfies `Algorithm<I>`:

```ts
interface Algorithm<I> {
  /** Stable id: 'insertion-sort', 'dijkstra', 'bst.delete'. Never reused. */
  readonly id: string;
  readonly title: string; // "Dijkstra's algorithm"
  readonly topic: Topic; // 'sorting' | 'graphs' | 'heaps' | …, for menus
  readonly summary: string; // one sentence, for catalogues and MCP
  /** The only definition of the input: validation, types, JSON Schema. */
  readonly input: z.ZodType<I>;
  /** At least one; the first is the default in menus and tests. */
  readonly examples: readonly [I, ...I[]];
  /** The code in every language, with the same `@anchor` markers. */
  readonly code: Readonly<Record<Language, Snippet>>;
  /** Records the run on `trace`; throws RangeError for inputs it cannot show. */
  run(input: I, trace: Trace): OpResult | void;
}
```

- **Ids.** Ids are lower-case and kebab-case. A data-structure operation is named `structure.operation`, as in `bst.delete` or `fibonacci-heap.decrease-key`. An id is the public name in every interface and is never reused for something else. Today's camelCase MCP names (`bubbleSort`, `bstOps`) go away, which is allowed because nothing is published yet.
- **Trace.** `Trace` merges today's `Recorder` and `Tape`:
  - `add(name, decl)` declares a structure and returns its typed handle.
  - `step(anchor, narration, { id?, vars? })` starts a step at a code anchor, never at a line number. The anchor is `null` for a step with no line, such as "The array is sorted."
  - `section(id, title)` starts a section (ADR 0020).

  The same `run` records into a silent trace when a starting state is built (ADR 0018), so the logic exists once.

- **Data structures.** `defineStructure(def)` takes the model, `start`, `describe` and `declare` of ADR 0018, plus one entry per operation (its input schema, code and `apply`).
  - It returns one module per operation, `bst.search`, `bst.insert` and `bst.delete`, each with input `{ from, …args }`.
  - It also returns a sequence module, `bst`, with input `{ from, ops }` and up to 8 operations.
  - Whole-life demos, such as "insert these keys, then search", are sequences with an empty `from`.
- **Registry.** `packages/recipes/src/registry.ts` lists every module explicitly (no file globbing) and exports `algorithms`, `findAlgorithm(id)` and `runAlgorithm(id, input)`. `runAlgorithm` does what the MCP catalogue does today:
  - checks the input with the module's schema, reporting `INVALID_SHAPE` with a path under `$.input`;
  - runs the module, turning a RangeError into `INVALID_ARGUMENT`;
  - checks the document against the protocol, replaying it through the engine.

  It returns `Result<{ document, results, after? }, Diagnostic[]>`.

- **Everything else derives from the registry:**
  - the MCP tools: the recipe list, with each input's JSON Schema from `z.toJSONSchema`, and the run tool;
  - the CLI: `algoviz run <id> <input>`, and the export of roadmap 1.2;
  - the playground menu, grouped by topic, using `examples`;
  - the documentation pages;
  - the Typst and LaTeX packages, which call `runAlgorithm` with an id and JSON.
- **Generic tests.** One suite runs over every registered module:
  - every example runs and validates;
  - every anchor used by `run` exists in every language;
  - every step has a narration;
  - the same input gives the same document;
  - ids are unique and well formed.

  Each module still has its own test against an independent reference implementation.

- **Layout of the package.**
  - Algorithms live in `src/algorithms/<topic>/<id>.ts`, and data structures in `src/structures/<name>/`.
  - Each module file exports its module, so a site that needs one algorithm imports only that one.
  - The recipe functions with positional arguments are removed after the migration (roadmap 0.4 and 0.5).
- **Dependencies.** `@algoviz/recipes` gains `zod` and `@algoviz/core`. Zod is needed for the schemas; core is needed to replay documents in `runAlgorithm`. Neither has DOM or Node.js dependencies, so the registry still runs in browsers, Workers and the Typst plugin. When this ADR is accepted, ADR 0018's note that the schemas stay in `packages/mcp` is superseded.

## Consequences

- Adding an algorithm is one file plus one line in the registry. MCP, the CLI, the playground, the documentation and the packages pick it up, and the generic tests check it.
- Callers that have only an id and JSON, such as the Typst plugin, the LaTeX package, MCP and share links, all call one function.
- Code is written with anchors in every language, so line numbers are never written by hand, and the current-line marker cannot point at the wrong line in one language and not another.
- The migration (roadmap 0.4 and 0.5) rewrites 29 recipes and the MCP catalogue. Their existing reference tests check that the documents keep the same structures and steps.
- Ids become part of the public interface, so renaming one later needs an alias.
