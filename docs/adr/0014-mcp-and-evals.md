# 0014. Models write documents through MCP tools, and evals measure how well

- Status: Accepted
- Date: 2026-10-06

## Context

The protocol is meant to be written by models as much as by code. A model needs three things to do that well: a way to learn the format, feedback when a document is wrong, and a way to check that a valid document shows the right thing. The JSON Schema alone does not serve: it is about 150 kB, says nothing about how steps and marks behave, and cannot express replay errors such as popping an empty stack. Whether a change to the protocol helps models also needs a measurement, not an impression.

## Decision

**`@algoviz/mcp`** offers six tools: `algoviz_guide`, `algoviz_validate`, `algoviz_inspect`, `algoviz_render`, `algoviz_list_recipes` and `algoviz_run_recipe`. They are defined once, without a transport (`tools.ts`), and served three ways: an MCP server over stdio, the `algoviz` command line, and directly to the eval harness. The server's instructions describe the workflow: use a recipe if one fits, otherwise read the guide, write, validate until valid, and inspect the result.

- **The guide** is Markdown written for models: an overview of documents, frames, marks and ids, and one section per kind with its declaration, a table of every action and a complete example. Tests check it against the kind registry: every action of every kind must have a row, and every example must validate without warnings. A new kind cannot be added without its section.
- **Validation** replays the document, so errors that depend on state (an index past the end, a node that was removed) are reported with the same code, path, message and hint as format errors. Valid documents get advice too: no narration, source code that no step points at, empty steps.
- **Inspection** returns each structure's state at chosen frames as compact JSON, without unset marks. Models that cannot see images can still check that an array ends sorted or that every distance is right.
- **Rendering** returns SVG text for now. A PNG for clients that show images is a later addition.

**Evals** (`evals/`) are 27 requests a teacher might make, covering every kind, each with a check of what a correct visualization must show. Checks read states, not names or wording: Dijkstra's check reads the distance notes in the last frame; Kruskal's adds up the selected edges. Every task has a reference solution, and tests make sure each check accepts its own reference and rejects every other task's, so checks are neither vacuous nor tied to one way of writing. Runs can use the Claude API (an agent loop with the tools, or one shot with the guide in the prompt) or agents that run commands. Both log every tool call in the same format, and `report.ts` grades a run: correct, valid, valid at the first validation, rounds of validation, and every error code hit.

## Consequences

- First runs, by Claude Haiku 4.5 as Claude Code subagents (three tasks each, so later tasks benefit from the guide read for the first):
  - With the tools: 27 of 27 correct; 25 of 27 valid at the first validation. The two failures were a colour given in `addNode` (the protocol now accepts it) and source lines past the end of the code (the hint gave the line count, and the next attempt was valid).
  - In one shot, without validation: 24 of 27 correct as handed in. Two documents used `settle` on a linked list, the only kind without it; linked lists now have it, which makes both valid. One task was handed in three times against the instructions; its last document is correct, and the report now counts submissions. With these changes, 26 of 27 are correct; the remaining failure is an algorithm traced wrongly, not a format error.
- The tasks are close to their ceiling for the tool loop. Harder tasks (longer traces, several interacting structures, recursion) are needed to tell improvements apart, and runs through the API with other models are needed to compare models.
- The guide costs about 8,000 tokens in full; `kinds` narrows it.
- Errors stay the main teaching channel: every failed validation in the runs above was fixed in one round.
