# 0001. Traces are event-sourced: actions are the source of truth

- Status: Accepted
- Date: 2026-10-06

## Context

An algorithm run can be described either as a sequence of full state snapshots or as a sequence of actions applied to an initial state. Snapshots alone lose information we need:

- **Intent.** `[5,3,8,1] → [3,5,8,1]` could be one swap or two assignments. Animation needs to know which, and with duplicate values it cannot tell which element moved where.
- **Steps that do not change data.** "Compare a[0] and a[1]" changes no data but is the most important step to teach.
- **Validation and token cost.** An LLM emitting full snapshots must copy the whole structure every step, which is expensive and error-prone, and nothing checks that consecutive snapshots are consistent.

## Decision

A trace is an initial state plus an ordered list of steps. Each step holds one or more actions and optional metadata (source line, narration, variables). States are derived, never stored: `state[n] = steps[0..n].reduce(reduce, initial)`, where each structure kind provides a pure `reduce(state, action) → Result<state, ActionError>`.

A state has two parts: `data` (the structure's contents) and `marks` (annotations such as highlights, pointers and settled positions). Actions like `compare` change only `marks`.

## Consequences

- Traces are small, append-only and streamable: a renderer can validate and play step _n_ while step _n+1_ is still being generated.
- Invalid actions (index out of range, unknown node) are caught at the step where they occur, with an error that can be returned to an LLM for self-correction.
- Seeking requires replay. The engine caches checkpoints every N steps so `stateAt(n)` stays cheap.
- `reduce` must be pure and deterministic; it is the contract every renderer and every future port relies on.
