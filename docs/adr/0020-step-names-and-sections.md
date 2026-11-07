# 0020. Steps have names and documents have sections

## Status

Accepted

## Context

A figure in a student's notes, a slide or a share link has to name the step it shows. Today the only handle is the frame number. Frame numbers move whenever a recipe gains or loses a step, so a note that showed "the third relaxation" silently shows something else after an update (requirements R3). A document of several operations (ADR 0018) marks where each one starts only with a narration step. The player cannot show that structure, and an export cannot ask for "all of insert 5".

## Decision

**Step names.** `meta.id` is an optional name for a step:

- lower-case kebab-case, at most 40 characters;
- it says what kind of step it is, such as `compare`, `relax` or `fixup-case-3`;
- names repeat: every relaxation in Dijkstra is named `relax`.

**Sections.** A document may give `sections`: a list of `{ id, title, start }`.

- `start` is the index of the section's first step. Sections are in order, do not overlap, and the last one runs to the end of the document.
- Steps before the first section belong to no section.
- Section ids are unique within a document, and section titles are shown to learners.
- Validation reports a section whose `start` is out of range or out of order.

**Selectors.** A selector names one frame or a range of frames. The player, the MCP tools, the CLI and the Typst and LaTeX packages all accept the same text:

| Selector                  | Meaning                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `12`, `-1`                | A frame number, as today; negative counts from the end.                                               |
| `relax`                   | The frame after the first step named `relax`.                                                         |
| `relax#3`                 | The frame after the third step named `relax`.                                                         |
| `insert-5/fixup-case-3#2` | The same, counting only inside section `insert-5`.                                                    |
| `insert-5`                | The range of frames of the section, from the frame before its first step to the frame after its last. |
| `a..b`                    | The range between two selectors, both included.                                                       |

A bare name is a section when a section has that id, and a step name otherwise. A selector that matches nothing is an error that lists the step names and sections the document has.

**Recipes.** Through the registry (ADR 0019):

- `trace.step(anchor, narration)` names the step after its anchor unless an `id` is given, so every step of a recipe is named without extra code.
- Each operation of a sequence is a section, with the id taken from its title (`insert-5`; a repeat becomes `insert-5-2`). It replaces the narration-only step that marks the start of an operation today.

**Player.**

- The timeline shows section boundaries and titles.
- The `frame` attribute also accepts a selector.
- The step's name is available to page scripts and to the MCP App's model context.

**Models.** The guide, the JSON Schema and the conformance fixtures describe `meta.id` and `sections`. `algoviz_inspect` and `algoviz_render` accept selectors.

## Consequences

- Notes, slides and links refer to steps by meaning, and they keep working when a recipe adds or removes steps elsewhere.
- Running an algorithm with a different input can still change what `relax#3` points at. That is the step the reader asked for on that input, which is the intended behaviour.
- The protocol gains one optional step field and one optional document field. Existing documents stay valid.
- The narration-only step at the start of each operation in an ADR 0018 document is replaced by a section, so those documents get one step shorter per operation.
