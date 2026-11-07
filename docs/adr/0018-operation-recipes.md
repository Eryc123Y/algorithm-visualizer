# 0018. Data-structure operations are recipes that start from a given state

## Status

Accepted. Where the argument schemas live (`packages/mcp`) is superseded by ADR 0019, which moves them into the recipe modules.

## Context

Each data-structure recipe shows one whole run from an empty structure: `bstInsert` inserts every key and may search once, and `binaryHeap` pushes every value and then pops them all (`packages/recipes/src/trees.ts`). Teachers and teaching sites want one operation at a time, on a structure in a state they choose: "delete 3 from this tree", "pop from this heap". Today that cannot be built:

- `Recorder` records every action into a step (`recorder.ts`), so building the starting tree would animate it too.
- No recipe accepts a prepared state, and the logic of each operation lives inside one monolithic function, so a recipe for "delete" would copy the code of "insert".
- Most operations are missing: there is no BST delete, heap pop on a given heap, or decrease-key.

Declarations can already hold a starting state (`TreeDecl.nodes` with `children`, `ArrayDecl.initial` with element ids), and marks start empty, which is what a starting picture needs. So the first step needs no protocol change.

## Decision

This record covers the first step only: BST and binary heap, with no change to the protocol. Step names, sections, frame ranges in the player and handout output are later steps with their own record.

- **Operations module.** `packages/recipes/src/ops/` holds one definition per structure. A definition has:
  - a pure model of the structure (states are new objects, never mutated);
  - `start(from)`, which builds the model state from a simple description, replaying the build operation silently;
  - `declare(state)`, which turns a model state into a declaration with explicit element ids (ADR 0007), so that frame 0 is the starting picture;
  - one function per operation, `apply(state, args, tape) → { state, result }`, which records its steps on a tape. The same function runs silently (a tape that records nothing) to build starting states, so each operation's logic exists once.
- **Entry points.** `ops.bst.run({ from, ops })` and `ops.heap.run(...)` take a starting description and a list of up to 8 operations, and return `{ document, results, after }`. `after` is the final model state in the same form as `from`, so the next call can continue from it. Shorthands such as `ops.bst.delete({ from, key })` run one operation.
- **BST.** `from` is keys in insertion order. Operations: `search`, `insert`, `delete`. Equal keys go right, as in `bstInsert`. Delete of a node with two children copies its successor by default, as in CLRS; `replaceWith: 'predecessor'` is an option. Because equal keys go right, copying a predecessor whose key appears more than once in the left subtree would leave an equal key on its left, so that case is refused with a hint to use the successor (an equal key elsewhere is an ancestor, which the copy keeps in order).
- **Heap.** The heap is an `array` with `view: 'tree'`, as in `binaryHeap`. `from` is values pushed silently, or `{ array }`, which must already satisfy the heap property (the error names the parent and child that break it). Operations: `push`, `pop`, and `decreaseKey` on a min-heap or `increaseKey` on a max-heap, as in CLRS. `order` is `'min'` (default) or `'max'`.
- **Source code.** Each operation shows only its own Python code and the helpers it calls. Code is written with marker comments (`# @found`) that a helper strips and turns into line numbers, the mechanism ADR 0017 proposes for other languages.
- **Composition.** Several operations in one document follow each other; each starts with a narration-only step that names it ("Delete 3."), so a viewer can see where one ends and the next begins.
- **Inputs.** Keys and values are finite numbers. A structure holds at most 32 values at any time, so a full one refuses `insert` and `push`, and `after` is always a valid `from`. Invalid descriptions (a key that is not a finite number, a non-heap array, `pop` on an empty heap, an unknown operation, too many operations) throw a `RangeError` that says why, as other recipes do (`check.ts`); the checks run at run time too, since JSON can reach recipes outside MCP.
- **MCP and playground.** The MCP catalogue gains `bstOps` and `heapOps`, one entry per structure, whose arguments are a discriminated union of operations. Their Zod schemas stay in `packages/mcp`, so recipes keep depending only on spec. The server instructions say to use them for one operation. The playground lists a few operation examples. The existing `bstInsert` and `binaryHeap` recipes stay as they are.

## Consequences

- One call gives a document for exactly the operation a teacher wants, on the structure they describe, and it plays in today's player, CLI and MCP unchanged.
- Tests can check each operation against its model:
  - frame 0 equals `declare(start(from))`;
  - the last frame equals the declaration of the final model state, ids included, so the silent and recorded paths agree; `start(after)` rebuilds the same values and shape, though it numbers ids afresh;
  - the result matches a reference implementation (in-order traversal of the BST, the heap property and the popped value);
  - running two operations in one call ends where two chained calls end;
  - the same input gives the same document.
- Showing one step of an operation, or one operation of a longer document, still needs the frame number. Named steps and sections come in the next step, and recipes will start emitting them then.
- The same pattern will carry AVL, red–black, trie, union-find, hashing and the advanced structures (Fibonacci heap, B-trees) one operation at a time.
