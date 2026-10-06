# 0008. Layout uses metrics measured over the whole trace

- Status: Accepted
- Date: 2026-10-06

## Context

If each frame were laid out on its own, cells would widen when a longer value appears, the scene would grow when a pointer moves past the end, and pointer rows would appear and disappear. Frames would jump during playback, and animating between them would be meaningless.

Layout also runs without a DOM (ADR 0003), so it cannot measure rendered text.

## Decision

- Layout takes two inputs: the state of one frame, and **metrics** (per structure: slots to reserve, longest value, pointer rows) merged over **every frame of the trace**. `layoutTrace(trace)` measures once and lays out any frame with the shared metrics; `layoutState` can also be called with metrics computed for a single state.
- Text width is estimated from character count with a monospace ratio (`charWidthRatio`, default 0.6 of the font size). Painters must use a monospace font for values.
- A `Scene` is plain JSON: `box`, `text` and `arrow` items with stable keys (`<structure>/element/<id>`, `<structure>/pointer/<name>`, …), semantic roles and coordinates in abstract units. Item order is paint order and part of the contract.
- A cell shows one role. When several marks apply, precedence is `compare` > `highlight` > `settled` > `default`.
- Several pointers at one index stack vertically, sorted by name; only the first has an arrow.
- Exact geometry is pinned by hand-computed fixtures in `conformance/layout/`.

## Consequences

- Scene size and cell positions are stable across frames, so painters can animate items by key.
- Measuring a trace replays every frame once, which is linear in the number of steps.
- Values in proportional fonts or with wide glyphs (e.g. CJK) may overflow their cells; a later option can supply real text measurement where a DOM is available.
