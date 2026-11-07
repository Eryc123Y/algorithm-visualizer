# 0017. A document may carry its source in several languages

## Status

Accepted (revised 2026-11-07 for the 1.0 requirements: pseudocode and Python, with the open questions answered)

## Context

A document carries one `source` (code and language), and each step names one line of it in `meta.line`. Learners and teachers want to read an algorithm in the language of their course, and the built-in recipes are written only in Python. The same algorithm takes different lines in different languages (the swap in bubble sort is line 6 in Python and line 9 in Java), so a language picker cannot be added in the player alone: steps need to point into every version of the code.

Requirement R4 asks for two languages in 1.0, pseudocode in CLRS conventions and Python. The viewer chooses between them, and highlighting and the current-line marker must work for every algorithm in both. More languages come later through the same mechanism.

## Decision

- **Protocol.**
  - Besides `source`, a document may give `sources`: a list of `{ language, code, anchors }`, one per language, with distinct languages.
  - A document gives `source` or `sources`, not both. Single-language documents are unchanged.
  - `sources` may also hold a single language, so that any document can use anchors.
- **Anchors instead of line numbers.**
  - With `sources`, a step names a point in the algorithm with `meta.at: "swap"`, and each source maps anchor names to its own line numbers (`anchors: { "swap": 6 }`). Line numbers are written once per language rather than once per step and language.
  - Validation rejects a step whose anchor is missing from any source, naming the language.
  - A step may have no anchor, such as a closing "The array is sorted."
- **Languages in 1.0.** `pseudocode` and `python`.
  - The pseudocode follows CLRS conventions:
    - `for i = 0 to n - 1` and `downto`;
    - `=` for assignment and `==` for comparison;
    - `//` comments;
    - `NIL`, `TRUE` and `FALSE`;
    - procedure names in small capitals in the player, plain capitals in text output;
    - indentation for blocks.
  - It is written in our own words, never copied from the book.
- **Indices start at 0 in both languages.** The pictures number array cells from 0, and narrations and `meta.vars` are shared by all languages. With 1-based pseudocode, "Compare a[2] and a[3]" would be wrong in one of the two languages, and every picture would need a second numbering. Variables keep the same names in both languages, for example `a`, `i` and `key`. This departs from the book, which counts from 1; the pseudocode notes it in a comment where it matters.
- **Narration and variables are language-neutral.** Narrations talk about values and ideas ("Compare 5 and 3", "the smaller child"), never syntax such as `len(a)` or `a.length`.
- **Player.**
  - The code panel shows a language switcher when there is more than one source.
  - A `language` attribute picks the language shown first. Without it, pseudocode comes first.
  - The reader's choice is remembered per site in local storage, as a convenience that may be absent.
  - The current line is the anchor's line in the language on show. Switching languages keeps the frame and moves the marker.
- **Recipes.** Each module's code is written per language with marker comments (`# @swap` in Python, `// @swap` in pseudocode). The snippet helper strips the markers and builds the anchor map, and the trace takes anchor names (ADR 0019).
- **Highlighting.**
  - Pseudocode gets a tokenizer (ADR 0016) for CLRS keywords, `NIL`, `TRUE` and `FALSE`, procedure names, and `//` comments.
  - Python keeps its tokenizer, which is checked against CPython.
- **Checks that keep highlighting and the marker working.**
  - Validation of anchors in every document.
  - The registry's generic tests: every anchor that a run uses exists in every language of the module, and the anchored line is not blank or a comment.
  - Tokenizer tests: for every module and language, the tokens put back together give exactly the code.
- **Models.** The JSON Schema, the MCP authoring guide and the conformance fixtures describe `sources` and anchors, and an eval task checks that models can use them.

## Consequences

- One document serves readers of the book and readers of Python, and recipes are written so that a third language is only more code with the same markers.
- The protocol grows by one field and one step property (a minor version under ADR 0021). `source` and `meta.line` keep working, so existing documents and models are unaffected.
- Writing each recipe twice is the bulk of the work; marker comments keep it mechanical, and the generic tests catch a missing or misplaced anchor.
- Readers of CLRS see indices one lower than in the book. The alternative, 1-based pseudocode, needs narrations, variables and cell numbers per language, which costs more than it gives.
