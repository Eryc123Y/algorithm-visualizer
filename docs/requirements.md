# Requirements

What algoviz is for, what version 1.0 must do, and how good it has to be. The [roadmap](roadmap.md) turns this into work items; the [ADRs](adr/README.md) record how each part is built. This file changes only when the owner's requirements change.

## Purpose

algoviz makes step-by-step pictures and animations of algorithms and data structures. A visualization is a declarative JSON document, so the same document becomes a vector figure, an animation on a web page, slides, or an interactive player in an AI conversation. Every output is drawn by algoviz's own engine and painters.

## Users and use cases

1. **Students writing notes in Typst or LaTeX.** A student calls a package function with an algorithm, its input and the step they want, for example the third relaxation of Dijkstra on their graph, and gets a native vector figure in the document. They can also pass a document they wrote or got from an AI. A Typst package and a LaTeX package do this, and both run algoviz's engine underneath.
2. **Teaching websites.** A teacher embeds the player with one script tag, from npm or a CDN, and points it at a document or an algorithm and input. Display mode shows only the animation, for pages that need no controls.
3. **Slides.** Each step becomes an overlay in Beamer or in a Typst slide framework, so a lecture can step through an algorithm with the slide controls. Web slides embed the player.
4. **AI conversations.** Through MCP, a model runs a ready-made algorithm or writes a document, checks it, and shows it in the conversation as an interactive player. The MCP server runs locally (stdio) or remotely (HTTP), and a user can deploy their own remote server to Cloudflare in one click. A share link opens any document in the player.

## Functional requirements

- **R1 Coverage.** Version 1.0 covers the main algorithms and data structures of CLRS (_Introduction to Algorithms_, 4th edition), plus the Fibonacci heap and the computational geometry chapter of the 3rd edition. The [roadmap](roadmap.md#phase-2-clrs-coverage) has the exact list. Parallel algorithms, linear programming, machine-learning algorithms and NP-completeness proofs are out of 1.0.
- **R2 One operation at a time.** Every data structure offers each of its operations on its own, starting from a state the user describes (ADR 0018). Whole runs are built by joining operations.
- **R3 Addressable steps.** Every step a figure shows can be named by algorithm or operation plus a step name, such as `insert 5 / fixup-case-3`. Names stay valid when the code behind them changes, so figures in notes keep showing the same step.
- **R4 Source code.** Each algorithm shows its code in pseudocode written in CLRS conventions (our own text, not copied from the book) and in Python, chosen by the viewer. Syntax highlighting and the current-line marker work for every algorithm in every language. More languages come after 1.0 through the same mechanism (ADR 0017).
- **R5 Output formats.**
  - Standalone SVG for any step, any range of steps, or all of them.
  - A Typst package and a LaTeX package that make figures from inside the document by calling algoviz.
  - Overlays for Beamer and Typst slides.
  - The `<algo-player>` web component and its standalone bundle.
  - Figures of one series share one scale, so a sequence of steps lines up across pages.
- **R6 Themes.** Themes are switchable, and every built-in theme works in every output: the player, SVG, the Typst and LaTeX packages, slides, and print.
  - The default stays the current light theme, refined where it looks unnatural.
  - Built in next to it: dark, a greyscale theme for print, and every direction from the theme lab. Those are textbook annotations (课本批注), building blocks (积木教具), each with a night variant, answer sheet (答题卡) and Turbo C lab (机房 Turbo C).
  - Colours, fonts and shapes stay customizable through theme tokens and CSS custom properties.
  - The documentation shows how to pick a theme in each output.
- **R7 Extensibility.** Adding an algorithm means adding one module and registering it. The MCP catalogue, the command line, the playground, the documentation and the tests all derive from the registry, so nothing else is edited by hand.
- **R8 Stable protocol.** From 1.0 the document format only grows: new fields and actions are optional. A breaking change needs a new major version and a function that upgrades older documents, because documents live in notes for years.
- **R9 Deployment.** The remote MCP server runs on Cloudflare Workers, stores nothing, and has a "Deploy to Cloudflare" button. Share links carry the document in the URL fragment, so no server stores it either.

## Quality bar

An algorithm counts as covered only when all of the following hold:

- it is tested against an independent reference implementation, and property tests run it on random inputs;
- every step has a narration and points at a code line in every language;
- its documents pass validation, and its figures were checked visually (gallery or browser);
- data structures meet the per-operation checks of ADR 0018: frame 0 is the starting state, chained runs agree with composed ones, and the same input gives the same document.

Across the project:

- `npm run check` and the E2E tests pass on every merge;
- the player stays accessible: it works from the keyboard, passes the E2E axe scan, and never relies on colour alone (ADR 0009);
- the core packages keep no DOM or Node.js dependency, so they run in browsers, Workers and the Typst plugin alike.

## Not in 1.0

- Languages other than pseudocode and Python.
- Structure kinds added by third parties.
- B+ tree, skip list, binomial heap, van Emde Boas tree, k-d tree and other structures outside the coverage list.
- A2UI support (after MCP Apps and share links, once its status is checked).
- Server-side storage of documents, accounts, or an editing GUI.

## Decisions the owner still has to make

- **Name:** the project name, before anything is published to npm, Typst Universe or CTAN.
