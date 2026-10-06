# 0010. Player architecture: shared painting, keyed animation, no decorators

- Status: Accepted
- Date: 2026-10-06

## Context

The interactive player (ADR 0006) must look exactly like static SVG output, animate between frames, be easy to embed (including by LLMs inside chat artifacts), and be testable.

## Decision

- **One painting implementation.** `@algoviz/svg` exposes `paintScene(scene, theme)`, which turns scene items into small SVG node trees drawn around each item's origin. `renderSvg` serialises them inside `translate` groups; the player inserts the same nodes. Static and interactive output cannot drift apart.
- **Keyed reconciliation.** `SceneStage` keeps one `<g>` per scene key. Positions are CSS transforms animated with the Web Animations API; content is replaced only when its markup changes. Items fade in and out. Cells that move horizontally follow an arc, upwards when moving right and downwards when moving left, so swapped cells do not pass through each other. Animation is skipped under `prefers-reduced-motion`.
- **Playback logic outside the DOM.** `PlayerController` is a small state machine (index, length, playing) with an injectable scheduler, unit-tested with a fake clock.
- **Embedding.** `<algo-player>` reads its document from the `visualization` property, a `src` URL, or an inline `<script type="application/json">` child. A standalone bundle (`dist/cdn/algoviz-player.js`) includes Lit and every algoviz package, so a page needs one `<script type="module">`.
- **Customisation.** Scene styling comes from `theme` (`auto`, `light`, `dark`, `print`) or a `customTheme` object (ADR 0009). The chrome is styled with CSS custom properties (`--algo-accent`, `--algo-bg`, …) and `::part()`.
- **Protocol addition.** Documents may carry `source` (code and language). The player shows it and highlights each step's `meta.line`; the parser rejects lines past the end of the code (`LINE_OUT_OF_RANGE`).
- **No decorators.** Reactive properties use Lit's `static properties` with `declare` fields instead of decorators. Standard decorators need compiler support that is not yet uniform across our toolchain (Vite's transformer, Node's type stripping), and `static properties` is equally supported by Lit. This refines ADR 0006, which assumed decorators.

## Consequences

- Visual changes are made once in `paint.ts` and show up in every output.
- The CDN bundle is about 48 kB gzipped, mostly Zod; `zod/mini` is an option if size matters.
- Content colours change instantly between frames; only position and opacity animate.
