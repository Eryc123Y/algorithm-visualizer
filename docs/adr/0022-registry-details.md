# 0022. Registry details: traces, structure modules, ids and the sorting procedures

## Status

Accepted

## Context

ADR 0019 decides that every algorithm and every data-structure operation is a module of one registry, and sketches the module's interface. Building it (roadmap 0.4) raised questions the sketch leaves open:

- **What a run returns.** A sequence of operations returns one result per operation and the final state, not one `OpResult`.
- **Title and code.** A run of a sequence shows only the code of the operations it runs, and its title names them. The module's `title` and `code` cannot say that.
- **Heaps.** ADR 0018 gives the binary heap an `order` option, and decrease-key works only on a min-heap. Every operation module would then need the option, and chaining through `after` would have to repeat it.
- **Ids.** Ids are public names from now on, so they are fixed here once.
- **Sorting procedures.** The recipes are rewritten once, straight into their final form (roadmap Phase 0). Some of today's sorting recipes are not the procedures in CLRS.
- **Legacy.** Until roadmap 0.5, part of the catalogue is still the old recipe functions.

This record settles those points. ADR 0019 stands; where the two differ, this record wins.

## Decision

**Trace.** `Trace` has three methods:

- `add(name, decl)` declares a structure and returns its typed handle.
- `step(anchor, narration, { id?, vars? })` starts a step. The anchor names a line in every language, or is `null` for a step with no line. The step is named after its anchor unless `id` says otherwise.
- `section(id, title)` starts a section.

Every step needs a non-empty narration and a name, so a step at `null` passes an `id`. The quality bar of the requirements asks more of registered modules: every step points at a line in every language. So they do not use `null`; a closing step such as "The array is sorted." points at the loop test that ends the run. The generic tests check every step for a narration, a name and an anchor on a line of code.

An anchor the code does not have is a programming error and throws an `Error`, not a `RangeError`. `silentTrace()` records nothing; structures build their starting state with it (ADR 0018).

**Module.** `Algorithm<I>` is as in ADR 0019, with two changes:

- `run(input, trace)` returns `{ results?, after? }` or nothing. `results` holds one `OpResult` per operation; `after` is a structure's final state, in the form `from` takes.
- An optional `present(input)` gives the `{ title, sources }` of a run, when they depend on the input. Structure modules use it; other modules show `title` and `code`.

`code` is the code a module shows by default. A run may show a variant: deleting with the predecessor shows a different `TREE-DELETE`. A module whose code is plain text is written with `defineAlgorithm`, which checks that both languages mark the same anchors.

**Running.** `runModule(module, input)` runs one module, so a page that imports a single module does not load the registry. `runAlgorithm(id, input)` finds the module first. Both return `Result<{ document, results, after? }, Diagnostic[]>`:

- `UNKNOWN_ALGORITHM` at `$.id`, with the known ids as a hint;
- `INVALID_SHAPE` at a path under `$.input`;
- `INVALID_ARGUMENT` at `$.input`, from a `RangeError`, for an input the module cannot show, such as a pop from an empty heap;
- the engine's errors, if the document does not replay.

**Structures.** `defineStructure(def)` returns `{ operations, sequence, modules }`.

- Each operation has a kebab-case `name`, its argument schema, examples, code and `apply(state, args, trace, on)`.
- The operation's module id is `<structure>.<name>`, and its input is `{ from, …args }`.
- The sequence module's id is the structure's, and its input is `{ from, ops }`, with 1 to 8 calls `{ op: name, …args }`. `op` is the same kebab-case name as in the operation's id, so `decrease-key`, not `decreaseKey`.
- An unknown `op` is reported at `$.input.ops[k].op`, naming the operations the structure has.
- `modules` lists the operations first, then the sequence.

**Heaps.** The binary heap is two structures, `min-heap` and `max-heap`, instead of one with an `order` option:

- each has `push` and `pop`;
- `min-heap` has `decrease-key` and `max-heap` has `increase-key`, as in CLRS;
- every module's input is then complete without an option, and `after` chains without repeating one.

**Ids in roadmap 0.4.** Where CLRS writes a name as one word, the id does too.

| Topic   | Ids                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| sorting | `bubble-sort`, `insertion-sort`, `selection-sort`, `merge-sort`, `quicksort`, `heapsort`, `counting-sort`                                  |
| trees   | `bst`, `bst.search`, `bst.insert`, `bst.delete`                                                                                            |
| heaps   | `min-heap`, `min-heap.push`, `min-heap.pop`, `min-heap.decrease-key`, `max-heap`, `max-heap.push`, `max-heap.pop`, `max-heap.increase-key` |

**Topics.** `TOPICS` lists the topics in menu order, and `TOPIC_TITLES` gives each one's heading: sorting, searching, lists (lists, stacks and queues), trees, heaps, hashing, graphs and dynamic programming. Later items may add topics.

**Sorting procedures.** The sorting modules follow the procedures of CLRS, written in our own words with indices from 0:

- **Insertion sort** lifts `key = a[i]` into a cell of its own, shifts larger values one place right, and drops the key into the gap. Today's recipe swaps neighbours instead.
- **Merge sort** is `MERGE-SORT` and `MERGE`. `MERGE` copies `a[p..r]` into a buffer `aux` laid out under `a`, instead of CLRS's two arrays `L` and `R`, so each value sits under the place it came from.
- **Quicksort** is `QUICKSORT` with the Lomuto `PARTITION`, which keeps values `≤` the pivot on the left. Today's recipe uses `<`.
- **Heapsort** is `HEAPSORT`, `BUILD-MAX-HEAP` and a recursive `MAX-HEAPIFY`, on the array drawn as a tree.
- **Counting sort** is the stable version: counts in `c`, running sums, then each value placed into an output array `b`, from the last value to the first. Today's recipe rewrites `a` from the counts, which is not stable and does not show why radix sort can rely on it.
- **Bubble sort** follows CLRS Problem 2-2: each pass runs `j` from the end down and bubbles the smallest remaining value to the front.
- **Selection sort** follows CLRS Exercise 2.2-2: it swaps the smallest of `a[i..n-1]` into `a[i]`.

Every sorting module takes `{ values }`, 1 to 32 finite numbers; counting sort takes integers from 0 to 99.

**Legacy path.** Recipes not yet migrated stay reachable under their camelCase names until roadmap 0.5 removes them:

- The MCP catalogue lists registry modules and legacy recipes in one list with one shape: `{ id, title, topic, summary, input }`, where `input` is the JSON Schema. The run tool takes `{ id, input }` for both.
- The CLI's `algoviz run <id> <input-json>` runs both, and `algoviz recipes` lists both. `algoviz recipe` is kept as another name for `run` until 0.5.
- The playground menu shows both, grouped by topic.
- The legacy code lives in files of its own, `packages/mcp/src/legacy-recipes.ts` and `apps/playground/src/samples/legacy.ts`, which say where the legacy path ends. Roadmap 0.5 deletes them.

A legacy recipe is removed as soon as a module replaces it: the seven sorting recipes and `ops.bst` and `ops.heap` go in 0.4.

## Consequences

- One function runs everything, and every consumer reads one list. Adding a module adds its menu entry, its MCP entry and its generic tests.
- Structure authors write a model and its operations; `defineStructure` gives the operation modules, the sequence, sections, step names, anchors and `after`.
- The heap's MCP entry and inputs change: `order` goes away, and operations are kebab-case. Nothing is published yet, so nothing breaks outside this repository.
- Sorting documents change shape where the procedures change: insertion sort gains a `key` cell, counting sort gains `b` and its counts become running sums, and bubble sort moves values the other way. Their reference and property tests change with them.
- `present` is a second way for a module to set its title and code. Only structure modules need it, and the generic tests check what every run shows, whichever way it was set.
