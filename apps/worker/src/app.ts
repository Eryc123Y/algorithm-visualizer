/**
 * The algoviz MCP server as a Cloudflare Worker (ADR 0039, roadmap 3.2):
 * Streamable HTTP at `/mcp`, stateless, with the guide and the player page
 * built in. Each client IP may make `RATE_LIMITER`'s number of requests per
 * period; past it the answer is 429 with `Retry-After`. `/` describes the
 * endpoint in plain text.
 *
 * The Worker's entry, `worker.ts`, exports only the handler, as workerd
 * requires; this module holds what tests need.
 */
import type { HttpHandler } from '@algoviz/mcp';

/** The Workers Rate Limiting binding, as far as the Worker uses it. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Absent in tests and local runs without the binding: no limit. */
  readonly RATE_LIMITER?: RateLimiter;
}

/** Seconds a client should wait after a 429: the binding's period. */
export const RETRY_AFTER_SECONDS = 60;

const INFO = `algoviz MCP server

This is a Model Context Protocol server for step-by-step algorithm
visualizations. Connect an MCP client to this address with /mcp at the
end, over Streamable HTTP; there is nothing else to see here.
`;

/** The client's address, as Cloudflare reports it; one key for all others. */
const clientKey = (request: Request) =>
  request.headers.get('cf-connecting-ip') ?? 'unknown';

/** The Worker, around an MCP handler; separate so tests can give their own. */
export function createWorker(handler: HttpHandler) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const { pathname } = new URL(request.url);
      if (
        pathname === '/' &&
        (request.method === 'GET' || request.method === 'HEAD')
      )
        return new Response(request.method === 'HEAD' ? null : INFO, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      if (env.RATE_LIMITER !== undefined && request.method !== 'OPTIONS') {
        const { success } = await env.RATE_LIMITER.limit({
          key: clientKey(request),
        });
        if (!success)
          return new Response('Too many requests', {
            status: 429,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'retry-after': String(RETRY_AFTER_SECONDS),
              'access-control-allow-origin': '*',
              'access-control-expose-headers': 'Retry-After',
            },
          });
      }
      return handler.fetch(request);
    },
  };
}
