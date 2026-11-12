/**
 * Serves a `{ fetch }` handler from Node's `node:http`, for
 * `algoviz-mcp --http` (ADR 0039): each request becomes a web `Request`,
 * and the `Response` is written back. Node-only; the handler itself is not.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

import type { HttpHandler } from './http.ts';

export interface ServeOptions {
  readonly host: string;
  /** 0 picks a free port. */
  readonly port: number;
}

export interface Serving {
  /** The server's base URL, such as `http://127.0.0.1:8787/`. */
  readonly url: string;
  close(): Promise<void>;
}

/**
 * The web request for a Node one, or null if its target is not a path:
 * the URL keeps the host it was reached at, and takes only the path and
 * query from the request line, so `//other/x` cannot change the host.
 */
function toRequest(req: IncomingMessage, base: string): Request | null {
  const target = req.url ?? '/';
  if (!target.startsWith('/') || target.startsWith('//')) return null;
  const url = new URL(base);
  const query = target.indexOf('?');
  url.pathname = query < 0 ? target : target.slice(0, query);
  url.search = query < 0 ? '' : target.slice(query);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers))
    if (value !== undefined)
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(url, {
    method,
    headers,
    ...(hasBody
      ? {
          body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
          duplex: 'half',
        }
      : {}),
  });
}

/** How long a request may take to arrive, and how many sockets at once. */
const LIMITS = { headersMs: 10_000, requestMs: 30_000, connections: 256 };

/** Listens on `host:port` and answers every request with `handler`. */
export function serveHttp(
  handler: HttpHandler,
  { host, port }: ServeOptions,
): Promise<Serving> {
  // The URL's origin is where the server listens; Host stays a header,
  // which the handler checks.
  const listening = {
    base: `http://${host.includes(':') ? `[${host}]` : host}`,
  };
  const server = createServer((req, res) => {
    Promise.resolve()
      .then(() => {
        const request = toRequest(req, listening.base);
        return request === null
          ? new Response('Bad request', { status: 400 })
          : handler.fetch(request);
      })
      .then(async (response) => {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body === null) return void res.end();
        res.end(Buffer.from(await response.arrayBuffer()));
      })
      .catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
  });
  server.headersTimeout = LIMITS.headersMs;
  server.requestTimeout = LIMITS.requestMs;
  server.maxConnections = LIMITS.connections;
  // A request Node cannot parse never reaches the handler.
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    else socket.destroy();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actual =
        typeof address === 'object' && address !== null ? address.port : port;
      listening.base = `http://${host.includes(':') ? `[${host}]` : host}:${actual}`;
      resolve({
        url: `${listening.base}/`,
        close: () =>
          new Promise<void>((done, fail) =>
            server.close((e) => (e ? fail(e) : done())),
          ),
      });
    });
  });
}

/** Hostnames that name this machine, for a server bound to it. */
export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const;

/** Whether an origin is a page served from this machine, on any port. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (LOCAL_HOSTS as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
}

export interface ServeArgs {
  /** Whether to serve HTTP rather than stdio. */
  readonly http: boolean;
  readonly host: string;
  readonly port: number;
}

/**
 * `algoviz-mcp`'s arguments: none for stdio, or `--http` with optional
 * `--host` (127.0.0.1) and `--port` (8787). Throws a message for a bad one.
 */
export function parseServeArgs(argv: readonly string[]): ServeArgs {
  let http = false;
  let host = '127.0.0.1';
  let port = 8787;
  for (let k = 0; k < argv.length; k++) {
    const arg = argv[k]!;
    const value = () => {
      const next = argv[++k];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--http') http = true;
    else if (arg === '--host') host = value();
    else if (arg === '--port') {
      const text = value();
      port = Number(text);
      if (!/^\d+$/.test(text) || port > 65_535)
        throw new Error(`--port takes a number from 0 to 65535, not ${text}`);
    } else
      throw new Error(`Unknown option ${arg}; use --http, --host or --port`);
  }
  if (!http && argv.length > 0)
    throw new Error('--host and --port go with --http');
  return { http, host, port };
}

/** Whether `host` binds to this machine only. */
export const isLocalHost = (host: string): boolean =>
  (LOCAL_HOSTS as readonly string[]).includes(host) || host === '::1';
