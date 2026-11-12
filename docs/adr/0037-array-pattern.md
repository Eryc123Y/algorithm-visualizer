# 0037. An array can carry a pattern aligned under it

## Status

Accepted

## Context

Phase 2's string-matching entry (roadmap S9, CLRS chapter 32) covers the naive matcher, Rabin–Karp, matching with a finite automaton and Knuth–Morris–Pratt. Every textbook figure of these algorithms draws the same picture: the text in a row, the pattern in a second row under it, shifted so that its first character sits under text position s, with the characters matched so far marked. The algorithms differ in how they choose the next shift and how much of the next alignment they already know matches.

The `array` kind draws one row. Two arrays, one for the text and one for the pattern, cannot show the shift: each structure is laid out in its own block, and a block's place does not depend on another structure's state. Putting the pattern's characters into the text array would mix the two sequences and their indices.

## Decision

The `array` kind gains an optional pattern, drawn as a second row under the text at a shift, in protocol version **0.8** (ADR 0021), after the linked-list `move` of 0.7 (ADR 0036): a feature `array patterns` in `PROTOCOL_FEATURES`, used by any document whose array declares a pattern or uses `align` or `check`.

### Declaration

`{ "kind": "array", "initial": ["a", "b", "a", "c"], "pattern": ["a", "c"], "shift"?: 0 }`.

- `pattern` is a list of elements, written as values (ids `p0`, `p1`, … are generated) or as `{ "id", "value" }`, from 1 to 64 of them. Its ids share the document's id space.
- `shift` is where the pattern starts, from 0 to n for a text of n elements (default 0). The pattern may hang past the end of the text: an automaton or KMP may have read the last character with no character of the pattern matched.
- The text is the array as before, and every existing action works on it unchanged. An array without `pattern` is exactly the array of today.
- A pattern needs the row view: with `view` `"tree"` or `"heap"` the declaration is refused (`INVALID_STRUCTURE`, path `['pattern']`).

### Actions

| Action  | Fields              | Effect                                                                                                                                                                     |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `align` | `shift`, `matched`? | Move the pattern so that P[0] is under T[shift]. The first `matched` characters (default 0) are marked as matched; the reducer checks that they equal the text under them. |
| `check` | `j`                 | Compare P[j] with T[shift + j]: both are marked as compared in this step, and if they are equal, P[j] is marked as matched until the next `align`.                         |

- **The reducer compares.** `check` takes no result: equality is the values' equality, so a document cannot draw a match that is not one. `align` refuses a `matched` count whose characters differ (`INVALID_OPERATION`, naming the first pair that differs).
- **Ranges.** `align`: `shift` from 0 to n, `matched` from 0 to m and with `shift + matched` at most n (`OUT_OF_RANGE`, path `['shift']` or `['matched']`). `check`: `j` from 0 to m − 1 and `shift + j` at most n − 1 (`OUT_OF_RANGE`, path `['j']`). Either action on an array without a pattern is `INVALID_OPERATION`.
- **Matched marks belong to one alignment.** `align` replaces them, `check` adds to them, and any action that changes the text (`set`, `swap`, `insert`, `remove`) clears them, since a match was against the old text. The compare mark of `check` lasts one step, like the array's own `compare`.
- **Text marks are the array's.** A recipe marks a found occurrence with `settle` on its text positions, and shows the window or the current position with `highlight` and `pointer`, as today.

### Drawing

- Under the text row comes a row of pattern indices (0 to m − 1), then the pattern row, its cells under text columns `shift` to `shift + m − 1`, then the pointer band. The text's pointers are drawn in that band, under the pattern, at their text columns: in every matcher the position being compared is one column for both rows, so a pointer such as `i` points at both.
- Pattern cells are keyed by element id (`<name>/pattern/<id>`) and their indices by position (`<name>/pattern-index/<j>`), so on a new shift the pattern slides as a whole.
- Roles: a compared pair is `compare` in both rows; a matched character and the text character above it are `highlight`; settled text keeps its check mark. No new role, so no painter changes.
- The row is as wide as the most columns any frame needs, the text's length or `shift + m`, measured over the whole trace (ADR 0008), so the block keeps one width while the pattern moves.

### The modules

A new topic `strings` holds four algorithms. Each takes `text` and `pattern` as JSON strings (ADR 0032 keeps strings as they are): `text` of 1 to 24 characters and `pattern` of 1 to 10, no longer than `text`, so that a pattern hanging past the end still fits a page. Each records the valid shifts in a side array (`place: "side"`, ADR 0029), settles each occurrence's text, and returns the shifts.

- `naive-string-matcher`: for each shift from 0 to n − m, `align`, then `check` from left to right until a character differs or the whole pattern matches.
- `rabin-karp`: characters are digits (radix 10) or lower-case letters (radix 26, a = 0); a prime modulus `q` from 2 to 997 (default 13). A side table holds p and each window's t_s, with the window highlighted; equal values lead to a character check, which tells a valid shift from a spurious hit, and the table says which.
- `finite-automaton-matcher`: the transition function δ over the characters of the text and pattern (at most 8) is computed first and shown as a side table of m + 1 rows; then each character read moves the state q along δ, and the pattern is aligned with `align { shift: i + 1 − q, matched: q }`.
- `kmp`: the prefix function π is computed first, on a side array holding P with P aligned against itself (the same `align` and `check`), and shown in a side array; the matcher then checks characters and, on a mismatch after q matches, aligns with `matched: π[q − 1]`, which the reducer verifies.

The listings are in CLRS's conventions with indices from 0, in our own words, and the steps are named by the listing markers, as in every module.

### Tests

- Spec: the declaration (generated pattern ids, ranges), the two actions, the feature and version 0.8; fixtures.
- Core: `align` and `check` against hand-computed states, the refusals, matched marks cleared by text changes, and the pattern in the array model of the property tests; the scene's pattern keys, its columns, and a width that holds for every frame.
- Modules: the shifts against an independent matcher on random texts and patterns over small alphabets, δ and π against independent definitions (the longest prefix of P that is a suffix of the text read, and of P's prefix), spurious hits counted against a direct computation, and a look at each in the gallery.

### Rejected

- **A separate `pattern` structure aligned to another structure.** The layout would need one structure's place to depend on another's state, which no layout does today, and the shared column of the compared characters would be lost in the arrangement of blocks.
- **`check` with a stated result.** The reducer has the values, so asking the document for the result would only let it be wrong.
- **New roles for a match and a mismatch.** `highlight` and `compare` already read as "matched so far" and "being compared" in every theme, and a mismatch is the comparison after which the pattern moves; new roles would touch every painter and theme for little.
- **Pattern pointers.** The compared text and pattern characters share a column, so the text's pointers serve both.

## Consequences

- String matching draws as the textbooks draw it, and the shift, the characters known to match and the comparisons are all in the picture.
- An array is laid out as before unless it declares a pattern.
- **Public interfaces:** protocol 0.8: `pattern` and `shift` on `array`, the actions `align` and `check`; the MCP guide's `kinds/array.md`; the topic `strings`.
