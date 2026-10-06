# 0006. The interactive player is built as Web Components with Lit

- Status: Accepted
- Date: 2026-10-06

## Context

The library is meant to be embedded anywhere: plain HTML, blogs, documentation sites, React and Vue apps, MCP Apps and A2UI clients. A Vue component library would only serve Vue users. A2UI has official Lit renderers but only a community Vue renderer.

## Decision

The interactive player and structure views are Web Components built with Lit, in a dedicated package. Vue and React wrappers are thin adapters over these elements. The existing Vite + Vue app becomes the playground and documentation site.

## Consequences

- One implementation works in every framework and in A2UI catalogs.
- Components use Shadow DOM; theming is exposed through CSS custom properties and `::part`.
- Lit components use standard (TC39) decorators, so they need the `accessor` keyword and must not enable `experimentalDecorators`.
- Because layout is pure (ADR 0003), the components contain only painting, playback and interaction logic.
