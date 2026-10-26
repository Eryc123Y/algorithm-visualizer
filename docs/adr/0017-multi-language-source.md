# 0017. A document may carry its source in several languages

## Status

Proposed

## Context

A document carries one `source` (code and language), and each step names one line of it in `meta.line`. Learners and teachers want to read an algorithm in the language of their course, and the built-in recipes are written only in Python. The same algorithm takes different lines in different languages (the swap in bubble sort is line 6 in Python and line 9 in Java), so a language picker cannot be added in the player alone: steps need to point into every version of the code.

## Decision (proposed)

- **Protocol.** Besides `source`, a document may give `sources`: a list of `{ language, code, anchors }`, one per language, with distinct languages. A document gives `source` or `sources`, not both, and single-language documents are unchanged.
- **Anchors instead of line numbers.** With `sources`, a step names a point in the algorithm, `meta.at: "swap"`, and each source maps anchor names to its own line numbers (`anchors: { "swap": 6 }`). Line numbers are then written once per language rather than once per step and language. Validation rejects an anchor missing from any source, naming the language.
- **Player.** The code panel shows a language switcher when there is more than one source. A `language` attribute picks the first language shown, and the reader's choice is remembered (where is an open question below). The current line is the anchor's line in the language on show.
- **Recipes.** Each recipe's code is written per language with marker comments (`# @swap`, `// @swap`). A helper strips the markers and builds the anchor map, so no line number is written by hand, and the recorder takes anchor names. The first set of languages: Python, C++, Java, JavaScript and textbook pseudocode.
- **Highlighting.** Each new language gets a tokenizer (ADR 0016).
- **Models.** The JSON Schema, the MCP authoring guide and the conformance fixtures describe `sources` and anchors, and an eval task checks that models can use them.

## Open questions

- Should narration and `meta.vars` differ per language (`len(a)` against `a.length`, `snake_case` against `camelCase`), or stay language-neutral?
- Should `sources` also allow one language with anchors, so that single-language documents can use anchors too?
- Where does the remembered language live: per page, or per site through storage?

## Consequences

- One document can serve courses in different languages, and the recipes become useful beyond Python courses.
- The protocol grows by one field and one step property; `source` and `meta.line` keep working, so existing documents and models are unaffected.
- Writing each recipe in four or five languages is the bulk of the work; marker comments keep it mechanical.
