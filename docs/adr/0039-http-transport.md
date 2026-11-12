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

`createServer()` stays the one place that registers tools, resources and the prompt. stdio keeps `StdioServerTransport`; HTTP uses `createMcpHandler(() => createServer(), …)`. Both serve the same tools with the same results, which the tests check by calling every tool both ways.

The HTTP transport is **stateless**: no sessions and no server-to-client stream. Every algoviz tool is a pure function of its arguments, so nothing needs a session. `responseMode: 'json'` answers each POST with one JSON body; the tools emit no progress, so nothing is lost.

### The shared path imports no Node APIs

`server.ts`, `tools.ts`, `show.ts` and the new `http.ts` import only web APIs and the workspace packages. The two file reads move behind modules that builds replace:

- `guide-files.ts` (unchanged) reads `guide/`;
- a new `player-file.ts` reads `ui/player.html`.

The Worker bundle (3.2) replaces both with the files' text, as the standalone bundle already does for the guide; the Vite plugin that does it moves to a shared build script used by both.

### `createHttpHandler`

`@algoviz/mcp` exports `createHttpHandler(options?)`, a `{ fetch(request) → Promise<Response> }` around `createMcpHandler` that adds what a public endpoint needs. Defaults, each an option:

| Concern      | Default                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path         | `/mcp`; any other path is 404.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Methods      | POST serves MCP; OPTIONS answers CORS preflight; GET and DELETE are 405 (stateless: no stream, no session to end); anything else 405.                                                                                                                                                                                                                                                                                                  |
| Body size    | 1 MiB. A `Content-Length` above it is 413 before the body is read; the SDK's `maxRequestBodySize` enforces it on bodies without one. 1 MiB is tighter than the protocol's own limits (up to 10,000 steps of 100 actions each), on purpose: it bounds the work one request can cause, and holds every registry example's document many times over. Recipe inputs are bounded further by the tools' schemas.                             |
| Content type | POST must be `application/json`, else 415.                                                                                                                                                                                                                                                                                                                                                                                             |
| Time budget  | 10 seconds per request: past it the response is a JSON-RPC error (−32603, "Request took too long") with status 504, and the late result is dropped. JavaScript cannot interrupt synchronous work, so the budget bounds waiting; the work itself is bounded by the size limits and, on Workers, by the platform's CPU limit per request.                                                                                                |
| CORS         | `allowedOrigins`: `'*'` or a list. With `'*'` the endpoint answers any origin, sending no `Access-Control-Allow-Credentials`, since it uses no cookies or authorization. Allowed methods `POST, OPTIONS`; allowed headers `Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-Id`; preflight cached 1 day. A request whose `Origin` is not allowed is 403 (the MCP specification's defense against DNS rebinding). |
| Errors       | A thrown error becomes a JSON-RPC −32603 "Internal error" with no message, stack or path; protocol and validation errors keep the SDK's own messages, which quote only the request. Tool results keep their text, which describes the caller's input.                                                                                                                                                                                  |

### Node: `algoviz-mcp --http`

`algoviz-mcp` keeps stdio by default. `algoviz-mcp --http [--port 8787] [--host 127.0.0.1]` serves `createHttpHandler` through a small `node:http` adapter (in `http-node.ts`, outside the shared path). It binds to 127.0.0.1 by default and then allows only localhost origins, as the specification asks of local servers; `--host 0.0.0.0` with `--allow-origin '*'` is the caller's explicit choice.

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
