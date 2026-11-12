# 0039. The MCP server speaks Streamable HTTP, statelessly, on Node and on Workers

## Status

Accepted

## Context

The MCP server runs over stdio only (`algoviz-mcp`): a client starts it as a local process. Roadmap 3.1 asks for Streamable HTTP next to stdio, with the server and the MCP App page (the player that `algoviz_show` opens) running on Workers; 3.2 then serves it from a public Cloudflare Worker, stateless and rate-limited.

Three facts shape the design:

- **The SDK already has a web-standard serving entry.** `@modelcontextprotocol/server` 2.3 exports `createMcpHandler(factory, options)`, which returns `{ fetch(request) → Response }`, the shape Workers expect from `export default`. It builds a fresh `McpServer` per request from a factory. Clients on the 2025 protocol revisions get the established stateless idiom (no session ids; GET and DELETE answered 405); clients on the 2026 revision get per-request envelopes. Its `maxRequestBodySize` answers 413 before parsing.
- **The server's code is already almost runtime-neutral.** The tools, the engine and the painters use no Node APIs (a requirement since Phase 0). Two reads are the exceptions: `guide-files.ts` reads the authoring guide's Markdown from `guide/`, and `show.ts` reads the built player page from `ui/player.html`. The standalone executable (ADR 0027) already replaces `guide-files.ts` at bundle time with the files' text.
- **A public endpoint takes untrusted input.** Bodies, documents and recipe inputs come from anyone; responses must not leak internals; browsers may call it, so CORS has to be stated rather than left to defaults.

## Decision

### One server, two transports

`createServer()` stays the one place that registers tools, resources and the prompt. stdio keeps `StdioServerTransport`. Both transports serve the same tools with the same results, which the tests check by calling every tool both ways.

The HTTP transport is **stateless**: no sessions and no server-to-client stream. Every algoviz tool is a pure function of its arguments, so nothing needs a session, and every POST is answered with **one JSON body**, never a stream. The SDK's `responseMode: 'json'` covers only the 2026 protocol revision; its fallback for the 2025 revisions, which today's clients speak, answers with a stream. So the handler routes by revision itself:

- it reads and parses the body once (below);
- `isLegacyRequest(request, body)` sends 2025-era requests to a fresh `createServer()` connected to a `WebStandardStreamableHTTPServerTransport` built with `sessionIdGenerator: undefined` and `enableJsonResponse: true`;
- other requests go to `createMcpHandler(() => createServer(), { legacy: 'reject', responseMode: 'json' })`.

Both get the parsed body, so neither reads the request again.

### The shared path imports no Node APIs but two replaceable files

`server.ts`, `tools.ts`, `show.ts` and the new `http.ts` import only web APIs and the workspace packages, with two exceptions that builds replace:

- `guide-files.ts` (unchanged, reached through `guide.ts`) reads `guide/` with `node:fs`;
- a new `player-file.ts` reads `ui/player.html` with `node:fs`.

The Worker bundle (3.2) replaces both with the files' text, as the standalone bundle already does for the guide; the Vite plugin that does it moves to a shared build script used by both.

### `createHttpHandler`

`@algoviz/mcp` exports `createHttpHandler(options?)`, a `{ fetch(request) → Promise<Response> }` that adds what a public endpoint needs in front of the SDK, whose serving entry is deliberately validation-free. Defaults, each an option:

| Concern     | Default                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path        | `/mcp`; any other path is 404, OPTIONS included.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Methods     | POST serves MCP; OPTIONS answers CORS preflight; GET, DELETE, HEAD and anything else are 405 with `Allow: POST, OPTIONS` (stateless: no stream to open, no session to end).                                                                                                                                                                                                                                                                                        |
| Body size   | 1 MiB. Our own check refuses a `Content-Length` above it with 413 before reading, and the handler reads at most that many bytes of a body without one. 1 MiB is tighter than the protocol's own limits (up to 10,000 steps of 100 actions each), on purpose: it bounds the work one request can cause, and holds the largest registry example's document (59 KB) many times over. Recipe inputs are bounded further by the tools' schemas.                         |
| Body format | POST must be `Content-Type: application/json`, parameters such as `; charset=utf-8` ignored, else 415; a body that is not JSON is a JSON-RPC parse error (−32700) with status 400. The SDK requires `Accept` to list both `application/json` and `text/event-stream`, as the specification asks of clients, and answers 406 otherwise.                                                                                                                             |
| Time budget | 10 seconds per request: past it the response is a JSON-RPC error (−32603, "Request took too long") with status 504, and the late result is dropped. JavaScript cannot interrupt synchronous work, and every algoviz tool is synchronous, so in practice the budget bounds only waiting. What bounds the work itself is the body limit, the tools' input limits and, on Workers, the platform's CPU limit per request.                                              |
| Origin      | `allowedOrigins`: `'*'` (the default), a list matched exactly against the `Origin` header (scheme, host and port), or a predicate. A request with an `Origin` that is not allowed is 403. A request without `Origin`, as non-browser clients send, is served. `'*'` turns the 403 off.                                                                                                                                                                             |
| Host        | `allowedHosts`: unchecked by default; when given, a request whose `Host` (port ignored) is not in the list is 403. With the Origin check this is the specification's defense against DNS rebinding, which matters for servers on localhost.                                                                                                                                                                                                                        |
| CORS        | Every response to an allowed origin carries `Access-Control-Allow-Origin` (`*`, or the origin with `Vary: Origin`) and `Access-Control-Expose-Headers: Retry-After`, errors included, so a browser client sees the error rather than an opaque failure. No `Access-Control-Allow-Credentials`: the endpoint uses no cookies or authorization. Preflight allows methods `POST, OPTIONS` and headers `Content-Type, Accept, Mcp-Protocol-Version`, cached for a day. |
| Errors      | A thrown error becomes a JSON-RPC −32603 "Internal error" with no message, stack or path. `createServer({ hideInternalErrors: true })`, which HTTP uses, does the same for a tool or resource that throws, where the SDK would otherwise return the error's message. Protocol and validation errors keep their messages, which quote only the request, and tool results keep their text, which describes the caller's input.                                       |

### Node: `algoviz-mcp --http`

`algoviz-mcp` keeps stdio by default. `algoviz-mcp --http [--port 8787] [--host 127.0.0.1]` serves `createHttpHandler` through a small `node:http` adapter (in `http-node.ts`, outside the shared path). It binds to 127.0.0.1 by default, and then allows only origins and hosts on localhost (`localhost`, `127.0.0.1`, `[::1]`, any port), as the specification asks of local servers. Another `--host` serves any origin and host, and is the caller's explicit choice.

### Workers: the shape 3.2 builds on

The Worker (3.2, `apps/worker`) is `export default { fetch }` from `createHttpHandler`, with:

- the player page and the guide embedded at build time;
- rate limiting through the Workers Rate Limiting binding, keyed by the client's IP (`CF-Connecting-IP`), answering 429 with `Retry-After` over the limit;
- a wrangler configuration with placeholder names for the owner to replace;
- a "Deploy to Cloudflare" button in its README.

The JSON Schema validator stays the SDK's default for zod schemas; if the default code-generating validator turns out to need `eval`, which Workers forbid, the Worker passes the SDK's `@modelcontextprotocol/server/validators/cf-worker` provider instead. Its tests run the Worker in `wrangler dev` (workerd, from npm) and talk to it with the SDK's client. Nothing is deployed and no Cloudflare account is used.

## Consequences

- `@algoviz/mcp` gains `createHttpHandler` and the `--http` flag; stdio clients see no change.
- Any fetch-based runtime can host the server: Workers, Deno, Bun, or Node through the adapter.
- Sessions, server-initiated messages and resumable streams are out of reach while the transport is stateless. A later ADR can add them with Durable Objects if a tool ever needs them.
- The size and time limits apply to HTTP only; stdio keeps trusting its local client.
- Builds of the Worker and of the standalone executable both embed the guide; the player page is embedded by the Worker build only, since the standalone CLI serves no MCP App.

### Rejected alternatives

- **A sessionful transport** (`WebStandardStreamableHTTPServerTransport` with session ids, or the Agents SDK's `McpAgent` on Durable Objects): state, storage and cost for tools that need none.
- **An Express or `node:http` server as the main entry:** it would not run on Workers, and Node would become a requirement of the shared path.
- **The deprecated HTTP+SSE transport:** current clients use Streamable HTTP.
- **Reading the guide and the player page with `fetch` from static assets at run time:** a second request per resource, and a static-assets binding the Worker otherwise does not need.
