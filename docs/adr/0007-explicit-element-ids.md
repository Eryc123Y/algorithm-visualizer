# 0007. Element identity is explicit in the protocol

- Status: Accepted
- Date: 2026-10-06

## Context

Animating a swap, a rotation or a node removal requires knowing which element is which across steps. Identity derived from indices breaks as soon as elements move, and it is ambiguous with duplicate values.

## Decision

In the canonical protocol, every element, node and edge has an explicit `id` that is unique within its structure and stable for the whole trace. Actions may refer to elements by position where that is natural (`swap i j` on an array), but the state always tracks elements by id.

Authoring layers may generate ids: the L0 one-liners and the L1 builder assign ids automatically, and the protocol may define a documented shorthand (for example, a bare value array) that a normalisation step expands into explicit ids before validation. The validator and renderers only ever see the canonical, explicit form.

## Consequences

- Animations and diffing between scenes are well defined.
- Hand-written and LLM-written JSON is slightly more verbose; the shorthand plus normalisation keeps simple cases short.
- Duplicate or missing ids are validation errors with a precise location.
