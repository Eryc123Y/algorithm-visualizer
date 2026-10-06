# 0009. Visual encoding is redundant, and themes are partial overrides

- Status: Accepted
- Date: 2026-10-06

## Context

Visualizations are used on projectors, in printed handouts, in LaTeX and Typst documents, and by colour-blind learners. Colour alone is not a reliable signal in any of these. Users also need to match visualizations to their own sites and slides without forking the library.

## Decision

- Every cell role has a non-colour cue: `compare` uses a heavy border, `swap` a heavy dashed border, `highlight` a tinted fill, and `settled` a solid fill with a check mark. A `swap` action marks both positions for that step, so learners can see what just moved.
- Pointers are drawn as badges, so their names stay legible over any background.
- Painters receive a typed theme (`SvgTheme`) covering fonts, radius, shadow, pointer colours and a style per role. Built-in themes are `light`, `dark` and `print` (greyscale, no shadows).
- Customisation is a deep partial override of a base theme: `createTheme('light', { cell: { compare: { stroke: '#e11d48' } } })`. Geometry is customised separately through `Partial<LayoutOptions>`.
- Painters use only basic SVG features (no CSS, filters or markers), so a theme renders the same in browsers, Typst and LaTeX converters.

## Consequences

- Figures stay readable in greyscale; the `print` theme relies on these cues entirely.
- Theme tokens are the contract later painters (the Lit player, TikZ) must honour; the player can expose them as CSS custom properties.
- Content and presentation stay separate: documents never carry colours. Per-document style hints, if needed later, will be roles, not colours.
