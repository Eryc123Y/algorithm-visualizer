# Evals

Can a model turn a teacher's request into a correct algoviz document? These evals measure that, so that changes to the protocol, the guide, the error messages and the MCP tools can be judged by how much they help.

Each task is a request such as "Dijkstra's shortest paths from S on this graph" with a check of what a correct visualization must show: here, that the final frame annotates every node with its true distance. Checks look at states, not at names or wording, so any faithful document passes. Every task has a reference solution in `tests/references.ts`, and the tests make sure each check accepts its reference and rejects every other task's.

## Running against the API

```sh
node --conditions=@algoviz/source evals/src/run.ts --model claude-opus-5-5
node --conditions=@algoviz/source evals/src/run.ts --model claude-haiku-4-5 --mode oneshot --tasks dijkstra,lcs
```

- `--mode tools` (default) gives the model the MCP tools (`algoviz_guide`, `algoviz_validate`, `algoviz_inspect`) and a `submit_document` tool, with the MCP server's instructions as the system prompt. It measures the whole loop: reading the guide, writing, fixing errors, checking.
- `--mode oneshot` puts the full guide in the system prompt and takes the first reply. It measures how learnable the format is without feedback.
- `--recipes` also offers the recipe tools. Off by default, since a matching recipe makes a task trivial.
- `--effort`, `--tasks`, `--concurrency` and `--out` do what they say.

Credentials come from the environment, as for any Anthropic SDK client. Results go to `evals/results/<model>-<mode>-<time>/`.

## Running with agents

Agents that run shell commands, such as Claude Code subagents, can use the same tools through `src/agent.ts`, which logs every call in the same format:

```sh
node --conditions=@algoviz/source evals/src/agent.ts <run-dir> <task> guide
node --conditions=@algoviz/source evals/src/agent.ts <run-dir> <task> validate doc.json
node --conditions=@algoviz/source evals/src/agent.ts <run-dir> <task> inspect doc.json -1
node --conditions=@algoviz/source evals/src/agent.ts <run-dir> <task> submit doc.json
```

Then grade the run:

```sh
node --conditions=@algoviz/source evals/src/report.ts <run-dir>
```

## Reading a report

`report.md` in each run directory has:

- **Correct**: valid, at least as many steps as the algorithm needs, and the task's check passes.
- **Valid when handed in**: the document loads.
- **Valid at first validation**: the first document the model validated was already valid. This is the best single measure of how learnable the format is.
- **Validations per task**: how many rounds of fixing it took.
- **Validation errors**: every error code the model hit, with examples. This is the list to work from when improving the guide or the error messages.

## Adding a task

Add it to `src/tasks.ts` with a check (tasks for the kinds added after 0.4, from root lists to the plane, are in `src/tasks-kinds.ts`), and a reference solution to `tests/references.ts` (a registry module's run, or a document recorded with `Recorder`). Run `npx vitest run --project evals`: the reference must pass its check and fail every other. Near misses a model might hand in, such as a related algorithm on the same input, go in the spec files as tests the check must reject.
