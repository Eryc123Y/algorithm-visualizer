/**
 * The MCP server over Streamable HTTP (ADR 0039): a web-standard
 * `{ fetch }` handler for Workers, Deno, Bun, or Node through
 * `http-node.ts`. It is stateless, answers every POST with one JSON body,
 * and puts what a public endpoint needs in front of the SDK: one path,
 * POST only, a size limit, JSON only, a time budget, Origin and Host
 * checks, explicit CORS, and errors that name nothing.
 *
 * This module imports no Node APIs.
 */
import {
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
  type McpServer,
} from '@modelcontextprotocol/server';

import { createServer } from './server.ts';

export interface HttpOptions {
  /** The path that serves MCP; `/mcp` by default. */
  readonly path?: string;
  /** The largest request body, in bytes; 1 MiB by default. */
  readonly maxBodyBytes?: number;
  /** How long a request may take, in milliseconds; 10 s by default. */
  readonly timeoutMs?: number;
  /**
   * The browser origins served: `'*'` (the default) for any, a list
   * matched exactly against `Origin`, or a predicate. A request without
   * `Origin`, as non-browser clients send, is always served.
   */
  readonly allowedOrigins?:
    '*' | readonly string[] | ((origin: string) => boolean);
  /** When given, the hostnames `Host` may name (port ignored). */
  readonly allowedHosts?: readonly string[];
  /** The server for each request; `createServer` hiding internal errors by default. */
  readonly server?: () => McpServer;
}

export interface HttpHandler {
  fetch(request: Request): Promise<Response>;
}

export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 10_000;

const ALLOW_METHODS = 'POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Accept, Mcp-Protocol-Version';

/** A JSON-RPC error answered for no particular request. */
function rpcError(status: number, code: number, message: string): Response {
  return Response.json(
    { jsonrpc: '2.0', id: null, error: { code, message } },
    { status },
  );
}

const plain = (
  status: number,
  text: string,
  headers: Record<string, string> = {},
) =>
  new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  });

/** Reads at most `limit` bytes of a body; null if it is longer. */
async function readBody(
  request: Request,
  limit: number,
): Promise<string | null> {
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Whether a header lists `application/json`, ignoring parameters. */
const isJson = (type: string | null) =>
  type !== null &&
  type.split(';')[0]!.trim().toLowerCase() === 'application/json';

/** Settles with `fallback` once `ms` have passed, if `work` has not. */
function within<T>(
  work: Promise<T>,
  ms: number,
  fallback: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback()), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** The MCP server as a `{ fetch }` handler, with the limits of ADR 0039. */
export function createHttpHandler(options: HttpOptions = {}): HttpHandler {
  const path = options.path ?? '/mcp';
  const maxBody = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowed = options.allowedOrigins ?? '*';
  const makeServer =
    options.server ?? (() => createServer({ hideInternalErrors: true }));
  const modern = createMcpHandler(() => makeServer(), {
    legacy: 'reject',
    responseMode: 'json',
    maxRequestBodySize: maxBody,
  });

  const originOk = (origin: string) =>
    allowed === '*'
      ? true
      : typeof allowed === 'function'
        ? allowed(origin)
        : allowed.includes(origin);

  /** The CORS headers for a response to `origin`, which is allowed. */
  const cors = (origin: string | null): Record<string, string> =>
    origin === null
      ? {}
      : {
          'access-control-allow-origin': allowed === '*' ? '*' : origin,
          'access-control-expose-headers': 'Retry-After',
          ...(allowed === '*' ? {} : { vary: 'Origin' }),
        };

  /** Serves a 2025-era request with a fresh server and a JSON-only transport. */
  async function legacy(request: Request, body: unknown): Promise<Response> {
    const server = makeServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody: body });
    } finally {
      void server.close();
    }
  }

  async function serve(request: Request): Promise<Response> {
    const length = Number(request.headers.get('content-length') ?? '0');
    if (length > maxBody) return plain(413, 'Request body too large');
    if (!isJson(request.headers.get('content-type')))
      return plain(415, 'Content-Type must be application/json');
    const text = await readBody(request, maxBody);
    if (text === null) return plain(413, 'Request body too large');
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return rpcError(400, -32700, 'Parse error');
    }
    // The body is read: hand the parsed form on with a fresh request.
    const again = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: text,
    });
    const work = (await isLegacyRequest(again, body, {
      maxRequestBodySize: maxBody,
    }))
      ? legacy(again, body)
      : modern.fetch(again, { parsedBody: body });
    return within(work, timeoutMs, () =>
      rpcError(504, -32603, 'Request took too long'),
    );
  }

  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin !== null && !originOk(origin))
      return plain(403, 'Origin not allowed');
    if (options.allowedHosts !== undefined) {
      const host = url.hostname.replace(/^\[|\]$/g, '');
      const hosts = options.allowedHosts.map((h) => h.replace(/^\[|\]$/g, ''));
      if (!hosts.includes(host)) return plain(403, 'Host not allowed');
    }
    if (url.pathname !== path) return plain(404, 'Not found');
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-methods': ALLOW_METHODS,
          'access-control-allow-headers': ALLOW_HEADERS,
          'access-control-max-age': '86400',
        },
      });
    if (request.method !== 'POST')
      return plain(405, 'Method not allowed', { allow: ALLOW_METHODS });
    return serve(request);
  }

  return {
    async fetch(request) {
      const origin = request.headers.get('origin');
      let response: Response;
      try {
        response = await route(request);
      } catch {
        response = rpcError(500, -32603, 'Internal error');
      }
      if (origin === null || !originOk(origin)) return response;
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(cors(origin)))
        headers.set(name, value);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  };
}
