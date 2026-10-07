# 0015. The player opens in the conversation as an MCP App

## Status

Accepted

## Context

Through the MCP server (ADR 0014) a model can write and check a document, but the user still has to take the JSON somewhere else to watch it: a chat answer can hold text or a still SVG, not a player. MCP Apps, an extension of MCP, lets a tool name an HTML page (a `ui://` resource) that the client draws in the conversation, in a sandboxed iframe, and talks to over `postMessage`.

## Decision

- A tool, `algoviz_show`, takes a document and an optional frame. It validates the document like `algoviz_validate`; an invalid one is an error, with the same report. A valid one comes back as text for the model and as structured content (`{ document, frame }`) for the page.
- The page, `ui://algoviz/player.html`, is an `<algo-player>` and a script that uses the `App` class of `@modelcontextprotocol/ext-apps`. It shows the document from the tool result, not from the tool input, so it only ever shows what the server validated. It follows the client's theme, reports its height, and, when the user stops on a frame, sends the frame and its narration to the model with `updateModelContext`.
- The page is built (Vite, with a small plugin that inlines the scripts) into one HTML file with nothing to fetch, as clients serve it in a sandbox without network access. The build output is not committed. It is shipped in the package, and the tests build it first.
- The server moves to the v2 MCP SDK packages (`@modelcontextprotocol/server`, and `@modelcontextprotocol/client` in tests), which ext-apps requires.
- The evaluation harness keeps its six tools and instructions. `algoviz_show` is for the user, not for writing documents, and only the server's instructions mention it.

## Consequences

- In Claude and other clients that display MCP Apps, a visualization a model makes can be played, stepped through and discussed in the same conversation. Other clients get a text result and lose nothing.
- The page weighs about 360 kB (100 kB gzipped), as it carries the player, Lit and the MCP client. Nothing is fetched at run time.
- A real browser test (`apps/playground/tests/e2e/mcp-app.spec.ts`) runs the page in a minimal host built on the ext-apps `AppBridge`: an MCP client calls the server and reads the page, and the test checks the drawing, theme changes, model context updates, sizing and errors. Writing it found that `<algo-player hidden>` stayed visible, which is now fixed for every page.
