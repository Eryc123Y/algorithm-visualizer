# 0003. Layout is a pure, DOM-free function producing a Scene IR

- Status: Accepted
- Date: 2026-10-06

## Context

We want the same visualization to appear in several media: an interactive player on web pages, an MCP App inside Claude and ChatGPT, static SVG for documents, Typst packages, and TikZ for LaTeX/Beamer. Several of these run where there is no browser (CLI, server, Typst's WASM sandbox).

## Decision

Rendering is split into two stages:

1. **Layout**: `layout(state, options) → Scene`, a pure function with no DOM or Node APIs. A `Scene` is a medium-independent description of boxes, edges and labels with coordinates and semantic roles (for example, "compare" rather than a colour).
2. **Painters** turn a `Scene` into output: DOM/Web Components (interactive, animated), SVG strings, TikZ.

Elements in a `Scene` carry stable ids (see ADR 0007) so painters can animate transitions between consecutive scenes.

## Consequences

- Static export (CLI, SVG, Typst, LaTeX) needs no headless browser.
- Painters stay thin, which also lowers the cost of the component technology choice (ADR 0006).
- Layout is fully unit-testable with snapshot tests of `Scene` values.
- Theming lives in painters, mapping semantic roles to colours.
