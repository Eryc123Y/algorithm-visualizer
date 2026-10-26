# 0016. Source code is highlighted by small, pure tokenizers

## Status

Accepted

## Context

The player shows `source.code` next to the visualization (ADR 0010) but drew it as plain text, although documents already name a `language`. Teaching code is short, but learners read it closely, and keywords, strings and comments are easier to follow in colour. Highlighting has to work in the player now and in later static outputs (Typst, TikZ), and in print, where colour is not available.

General-purpose highlighters (Shiki, Prism, highlight.js) cover hundreds of languages, but they are large next to the player's bundle, and their token classes and colours come from their own grammars and themes, which our themes and painters would have to map.

## Decision

- `highlightCode(code, language)` in `@algoviz/core` turns code into lines of tokens, each with a kind: `keyword`, `builtin`, `function`, `string`, `number`, `comment` or `plain`. It is pure and DOM-free, like layout (ADR 0003), so every painter shows the same classes. Lines are split at `\n`, as the protocol counts them, and the `\r` of a CRLF line end is dropped.
- Each language is one tokenizer, registered by name (`python`, alias `py`). Code in other languages, or without a language, stays plain. Tokenizers never fail and stay linear in the length of the code: token texts always concatenate to the input, and unterminated strings end at their line (or, for triple quotes, at the end).
- The Python tokenizer follows CPython 3.12+'s lexical rules: hard keywords; names in any script (XID); every string prefix, including t-strings, and triple quotes; f- and t-string replacement fields that reuse the quote, nest strings and span lines; every number form; and comments. On top of the lexical classes it marks common builtins (but not attributes such as `node.next`), and names after `def` and `class` or before a call.
- The player renders every token that is not plain as `<span class="tok-{kind}">` and colours it with custom properties (`--algo-code-keyword`, `-builtin`, `-function`, `-string`, `-number`, `-comment`), with defaults for the light and dark themes. Keywords are bold and comments italic in every theme. The greyscale `print` theme (ADR 0009) uses the text colour for code, so in print only keywords and comments stay distinct; other kinds print as plain text.

## Consequences

- Highlighting adds a few kilobytes and no dependency. The default colours reach at least 4.5:1 against the code background and the current-line highlight.
- Before this record was accepted, the Python tokenizer was compared with CPython 3.15's `tokenize` module, span by span for strings, numbers, comments, keywords and defined names: every recipe snippet, 126 hand-written edge cases and the 2,054 files of the standard library agree, and the remaining differences in 100,000 random snippets are names that CPython itself rejects (such as `x²`). The comparison was a one-off check and its harness is not in the repository; the unit tests keep a regression case for every difference it found, and a property test checks for random input that no character is lost.
- Builtins and attributes are a heuristic layer that CPython's tokenizer does not classify, so they are covered by unit tests only.
- Adding a language means adding a tokenizer and its tests; nothing else changes. Showing one algorithm in several languages is a separate, protocol-level question (ADR 0017).
