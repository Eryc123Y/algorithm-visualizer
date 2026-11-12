# algoviz MCP server on Cloudflare Workers

The algoviz MCP server as a Cloudflare Worker: the same tools as `algoviz-mcp`, over Streamable HTTP at `/mcp`, stateless and rate-limited ([ADR 0039](../../docs/adr/0039-http-transport.md)). Models can validate, inspect, render and show step-by-step algorithm visualizations without installing anything.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Eryc123Y/algorithm-visualizer/tree/main/apps/worker)

The button works once the repository is public, and needs a Cloudflare account. The Worker builds from this monorepo, so the deploy must check out the whole repository, not only this folder; if it does not, deploy by hand as below.

## What it does

- `POST /mcp` serves MCP: every algoviz tool, the guide and the schema as resources, the `visualize` prompt, and the player page that `algoviz_show` opens in hosts with MCP Apps. Each request gets one JSON answer; there are no sessions.
- `GET /` says what the address is, in plain text.
- Each client IP may make 60 requests a minute; past that the answer is 429 with `Retry-After: 60`. CORS preflight is not counted.
- Requests over 1 MiB (413), not JSON (415), on other paths (404) or with other methods (405) are refused. A request gets 10 seconds (504), and Cloudflare's CPU limit bounds the work. Unexpected failures answer a bare "Internal error".
- Any origin may call it: it uses no cookies or credentials, so CORS allows `*` without them.

The guide and the player page are built into the Worker, which needs no other bindings than the rate limit.

## Connecting clients

Replace `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev` with the Worker's address.

- **Claude (claude.ai and Claude Desktop):** Settings → Connectors → Add custom connector, with the URL `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp`. No authentication.
- **Claude Code:**

  ```sh
  claude mcp add --transport http algoviz https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp
  ```

- **Other clients** that speak Streamable HTTP take the same URL, for example in a `mcp.json`:

  ```json
  {
    "servers": {
      "algoviz": {
        "type": "http",
        "url": "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp"
      }
    }
  }
  ```

- **The MCP Inspector:** `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", the same URL.

## Deploying by hand

From the repository root, with a Cloudflare account:

1. Choose the Worker's name: replace the placeholder `algoviz-mcp-example` in `wrangler.jsonc`. The name becomes part of its `workers.dev` address.
2. Optionally adjust the rate limit in `wrangler.jsonc` (`ratelimits`: `limit` requests per `period` seconds, 10 or 60; `namespace_id` is any integer unique in the account).
3. Install, sign in and deploy:

   ```sh
   npm ci
   npx wrangler login
   cd apps/worker && npx wrangler deploy
   ```

   `wrangler deploy` runs the configured build, `npm run build`: it builds the player page, then bundles the Worker with the guide and the page into `dist/worker.js`, about 2 MB.

## Developing

```sh
npm run dev -w @algoviz/worker      # build, then serve on http://localhost:8787 with wrangler dev
npm run test:worker                 # build, then test the Worker in workerd with the MCP SDK's client
```

Both run locally with workerd from npm; neither needs a Cloudflare account. The rate limit is simulated locally. `npm run check` runs the Worker's own unit tests in Node.
