# 0011. Display mode: the player as a purely visual element

- Status: Accepted
- Date: 2026-10-06

## Context

Besides teaching, visualizations are used as illustrations: a hero animation on a landing page, a figure beside a paragraph, a looping example in slides. There the player's teaching apparatus (controls, narration, variables, code, titles, indices, lifted swaps) is noise.

## Decision

`<algo-player mode="display">` turns the player into a self-running animation of the structures alone:

- **Shown:** cells, pointers and marks only. Layout uses `bareLayoutOptions` (no titles, no indices, small padding); `showTitles` and `showIndices` are ordinary layout options, so static SVG and document exports can produce the same bare figures.
- **Hidden:** controls, narration, variables, source code, and the card's border, padding and background. Validation errors are still shown so authors can fix documents.
- **Playback:** starts by itself and loops, holding the last frame for 1.5 s before restarting; `once` plays it a single time. Display players pause while off screen (IntersectionObserver) and resume when visible.
- **Motion:** straight-line movement by default (`motion="linear"`); interactive mode keeps arcs. Either mode can override with the `motion` attribute.
- **Input:** no keyboard handling and no tab stop.

## Consequences

- One element and one document format serve both teaching and illustration; switching is a single attribute.
- Under `prefers-reduced-motion`, display players still advance frames but without movement.
