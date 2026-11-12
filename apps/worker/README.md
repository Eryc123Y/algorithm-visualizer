# algomotion MCP server on Cloudflare Workers

The algomotion MCP server as a Cloudflare Worker: the same tools as `algomotion-mcp`, over Streamable HTTP at `/mcp`, stateless and rate-limited ([ADR 0039](../../docs/adr/0039-http-transport.md)). Models can validate, inspect, render and show step-by-step algorithm visualizations without installing anything.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Eryc123Y/algorithm-visualizer/tree/main/apps/worker)

The button works once the repository is public, and needs a Cloudflare account. The Worker builds from this monorepo, so the deploy must check out the whole repository, not only this folder; if it does not, deploy by hand as below.

## What it does

- `POST /mcp` serves MCP: every algomotion tool, the guide and the schema as resources, the `visualize` prompt, and the player page that `algomotion_show` opens in hosts with MCP Apps. Each request gets one JSON answer; there are no sessions.
- `GET /` says what the address is, in plain text.
- Each client IP may make about 60 requests a minute; past that the answer is 429 with `Retry-After: 60`. CORS preflight and the page at `/` are not counted. Cloudflare counts per location and catches up within seconds, so the limit is an approximate guard against abuse rather than an exact quota; IPv6 clients are counted by full address. Cloudflare's CPU limit, the 1 MiB body limit and the 10-second budget bound what each request can cost.
- Requests over 1 MiB (413), not JSON (415), on other paths (404) or with other methods (405) are refused. A request gets 10 seconds (504), and Cloudflare's CPU limit bounds the work. Unexpected failures answer a bare "Internal error".
- Any origin may call it: it uses no cookies or credentials, so CORS allows `*` without them.

The guide and the player page are built into the Worker, which needs no other bindings than the rate limit.

### Share links

Set the variable `ALGOMOTION_SHARE_URL` to the address of a share page you serve (the site's `play/` page, built by `apps/site`), such as `https://example.org/play/`, and `algomotion_show` and `algomotion_run_recipe` also return a share link that opens the visualization in any browser ([ADR 0040](../../docs/adr/0040-share-links.md)). Uncomment `vars` in `wrangler.jsonc`, or set it in the Cloudflare dashboard. Without it the tools make no links. An address that is not an absolute `http:` or `https:` URL makes every request fail with 500 and the reason in the Worker's logs.

## Connecting clients

Replace `YOUR-SUBDOMAIN` with the account's `workers.dev` subdomain, or the whole address if the Worker has another name or a domain of its own.

- **Claude (claude.ai and Claude Desktop):** Settings → Connectors → Add custom connector, with the URL `https://algomotion-mcp.YOUR-SUBDOMAIN.workers.dev/mcp`. No authentication.
- **Claude Code:**

  ```sh
  claude mcp add --transport http algomotion https://algomotion-mcp.YOUR-SUBDOMAIN.workers.dev/mcp
  ```

- **Other clients** that speak Streamable HTTP take the same URL, for example in a `mcp.json`:

  ```json
  {
    "servers": {
      "algomotion": {
        "type": "http",
        "url": "https://algomotion-mcp.YOUR-SUBDOMAIN.workers.dev/mcp"
      }
    }
  }
  ```

- **The MCP Inspector:** `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", the same URL.

## Deploying by hand

From the repository root, with a Cloudflare account:

1. The Worker is named `algomotion-mcp` in `wrangler.jsonc`, so its address is `https://algomotion-mcp.YOUR-SUBDOMAIN.workers.dev`. Change the name there to deploy it under another.
2. Optionally adjust the rate limit in `wrangler.jsonc` (`ratelimits`: `limit` requests per `period` seconds, 10 or 60; `namespace_id` is any integer unique in the account).
3. Install, sign in and deploy:

   ```sh
   npm ci
   npx wrangler login
   cd apps/worker && npx wrangler deploy
   ```

   `wrangler deploy` runs the configured build, `npm run build`: it builds the player page, then bundles the Worker with the guide and the page into `dist/worker.js`: 2.1 MB, 0.6 MB compressed, within the free plan's 3 MB.

## Developing

```sh
npm run dev -w @algomotion/worker      # wrangler dev: builds, then serves on http://localhost:8787
npm run test:worker                    # build, then test the Worker in workerd with the MCP SDK's client
```

Both run locally with workerd from npm; neither needs a Cloudflare account. The rate limit is simulated locally. `npm run check` runs the Worker's own unit tests in Node.
