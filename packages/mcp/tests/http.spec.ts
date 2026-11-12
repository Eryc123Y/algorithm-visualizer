/**
 * The Streamable HTTP transport (ADR 0039): the request rules a public
 * endpoint needs, checked with plain requests, and the SDK's own client
 * over HTTP, which must get the same tools and results as over the
 * in-memory transport the stdio server uses.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createHttpHandler, type HttpHandler } from '../src/http.ts';
import {
  isLocalHost,
  isLocalOrigin,
  parseServeArgs,
  serveHttp,
} from '../src/http-node.ts';
import { createServer } from '../src/server.ts';
import { tools } from '../src/tools.ts';

const URL_ = 'https://mcp.example/mcp';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  },
};

describe('the request rules', () => {
  const handler = createHttpHandler();

  it('answers CORS preflight with the methods and headers it takes', async () => {
    const res = await handler.fetch(
      new Request(URL_, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://app.example',
          'access-control-request-method': 'POST',
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Accept, Mcp-Protocol-Version',
    );
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });

  it('serves only its path, and only POST there', async () => {
    expect(
      (await handler.fetch(new Request('https://mcp.example/'))).status,
    ).toBe(404);
    expect(
      (
        await handler.fetch(
          new Request('https://mcp.example/mcp/x', { method: 'POST' }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handler.fetch(
          new Request('https://mcp.example/x', { method: 'OPTIONS' }),
        )
      ).status,
    ).toBe(404);
    for (const method of ['GET', 'DELETE', 'PUT', 'PATCH', 'HEAD']) {
      const res = await handler.fetch(new Request(URL_, { method }));
      expect(res.status, method).toBe(405);
      expect(res.headers.get('allow')).toBe('POST, OPTIONS');
    }
  });

  it('takes JSON only, and says so in errors a browser can read', async () => {
    const res = await handler.fetch(
      post('hello', {
        'content-type': 'text/plain',
        origin: 'https://app.example',
      }),
    );
    expect(res.status).toBe(415);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-expose-headers')).toBe(
      'Retry-After',
    );
    const broken = await handler.fetch(post('{"jsonrpc": "2.0", "id": 1,'));
    expect(broken.status).toBe(400);
    expect(await broken.json()).toMatchObject({ error: { code: -32700 } });
    const ok = await handler.fetch(
      post(initialize, { 'content-type': 'application/json; charset=utf-8' }),
    );
    expect(ok.status).toBe(200);
  });

  it('refuses a body over the limit, with or without its length', async () => {
    const small = createHttpHandler({ maxBodyBytes: 1024 });
    const big = JSON.stringify({ ...initialize, padding: 'x'.repeat(2048) });
    const declared = await small.fetch(
      post(big, { 'content-length': String(big.length) }),
    );
    expect(declared.status).toBe(413);
    const streamed = new Request(URL_, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(big));
          c.close();
        },
      }),
      duplex: 'half',
    });
    expect((await small.fetch(streamed)).status).toBe(413);
  });

  it('refuses origins it does not allow, and lets clients without one through', async () => {
    const strict = createHttpHandler({
      allowedOrigins: ['https://app.example'],
    });
    expect(
      (await strict.fetch(post(initialize, { origin: 'https://evil.example' })))
        .status,
    ).toBe(403);
    const allowed = await strict.fetch(
      post(initialize, { origin: 'https://app.example' }),
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://app.example',
    );
    expect(allowed.headers.get('vary')).toContain('Origin');
    expect((await strict.fetch(post(initialize))).status).toBe(200);
  });

  it('checks the Host header when asked to', async () => {
    const local = createHttpHandler({
      allowedHosts: ['localhost', '127.0.0.1'],
    });
    const at = (host: string) =>
      new Request(`http://${host}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(initialize),
      });
    expect((await local.fetch(at('localhost:8787'))).status).toBe(200);
    expect((await local.fetch(at('rebind.example:8787'))).status).toBe(403);
  });

  it('gives up after its time budget, with an error that names nothing', async () => {
    const slow = createHttpHandler({
      timeoutMs: 50,
      server: () => {
        const server = new McpServer({ name: 'slow', version: '0' });
        server.registerTool('wait', { inputSchema: z.object({}) }, async () => {
          await new Promise((r) => setTimeout(r, 1_000));
          return { content: [{ type: 'text', text: 'done' }] };
        });
        return server;
      },
    });
    const res = await slow.fetch(
      post({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'wait', arguments: {} },
      }),
    );
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Request took too long' },
    });
  });

  it('turns an unexpected failure into an error that leaks nothing', async () => {
    const broken = createHttpHandler({
      server: () => {
        throw new Error('secret at /Users/someone/project/src/x.ts:12');
      },
    });
    const res = await broken.fetch(post(initialize));
    const text = await res.text();
    expect(text).not.toMatch(/secret|\/Users|\.ts/);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('hides the message of a tool that throws, and only when asked', async () => {
    const guide = tools.find((t) => t.name === 'algomotion_guide')!;
    const spy = vi.spyOn(guide, 'run').mockImplementation(() => {
      throw new Error('broke at /Users/someone/src/guide.ts:12');
    });
    try {
      for (const hide of [true, false]) {
        const client = new Client({ name: 't', version: '0' });
        const [a, b] = InMemoryTransport.createLinkedPair();
        await createServer({ hideInternalErrors: hide }).connect(a);
        await client.connect(b);
        const result = await client.callTool({
          name: 'algomotion_guide',
          arguments: {},
        });
        expect(result.isError).toBe(true);
        expect(
          JSON.stringify(result).includes('/Users/someone'),
          String(hide),
        ).toBe(!hide);
        await client.close();
      }
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the limits a slow or odd request meets', () => {
  it('counts reading the body in the time budget', async () => {
    const quick = createHttpHandler({ timeoutMs: 50 });
    const drip = new Request(URL_, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('{"jsonrpc":'));
          // …and never the rest.
        },
      }),
      duplex: 'half',
    });
    expect((await quick.fetch(drip)).status).toBe(504);
  });

  it('says its answers vary by Origin when origins are listed', async () => {
    const listed = createHttpHandler({
      allowedOrigins: ['https://app.example'],
    });
    for (const origin of ['https://app.example', 'https://evil.example'])
      expect(
        (await listed.fetch(post(initialize, { origin }))).headers.get('vary'),
      ).toContain('Origin');
    expect(
      (await createHttpHandler().fetch(post(initialize))).headers.get('vary') ??
        '',
    ).not.toContain('Origin');
  });

  it('hides a tool that rejects as well as one that throws', async () => {
    const guide = tools.find((t) => t.name === 'algomotion_guide')!;
    const spy = vi
      .spyOn(guide, 'run')
      .mockImplementation(
        () => Promise.reject(new Error('at /Users/someone/x.ts')) as never,
      );
    try {
      const client = new Client({ name: 't', version: '0' });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await createServer({ hideInternalErrors: true }).connect(a);
      await client.connect(b);
      const result = await client.callTool({
        name: 'algomotion_guide',
        arguments: {},
      });
      expect(JSON.stringify(result)).not.toContain('/Users/someone');
      await client.close();
    } finally {
      spy.mockRestore();
    }
  });

  it('serves a client on the 2026 revision through the SDK’s handler', async () => {
    const handler = createHttpHandler();
    const client = new Client(
      { name: 'modern', version: '0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(URL_), {
        fetch: (input, init) => handler.fetch(new Request(input, init)),
      }),
    );
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name)).toContain('algomotion_show');
    const result = await client.callTool({
      name: 'algomotion_list_recipes',
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    await client.close();
  });
});

/** Every tool, called with arguments that succeed and that fail. */
const CALLS: { name: string; arguments: Record<string, unknown> }[] = [
  { name: 'algomotion_guide', arguments: { kinds: ['stack'] } },
  { name: 'algomotion_list_recipes', arguments: {} },
  {
    name: 'algomotion_run_recipe',
    arguments: { id: 'insertion-sort', input: '3 1 2' },
  },
  {
    name: 'algomotion_validate',
    arguments: { document: { version: '1.0', structures: {}, steps: [] } },
  },
  { name: 'algomotion_validate', arguments: { document: { version: 'x' } } },
  {
    name: 'algomotion_render',
    arguments: { recipe: 'insertion-sort', input: '3 1 2', frame: -1 },
  },
  {
    name: 'algomotion_inspect',
    arguments: { recipe: 'binary-search', frames: [0, -1] },
  },
  { name: 'algomotion_show', arguments: { recipe: 'stack', frame: 2 } },
  { name: 'algomotion_show', arguments: { recipe: 'no-such-recipe' } },
];

async function connectHttp(fetch: typeof globalThis.fetch, url: string) {
  const client = new Client({ name: 'http-test', version: '0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), { fetch }),
  );
  return client;
}

describe('the SDK client over HTTP', () => {
  let handler: HttpHandler;
  let http: Client;
  let memory: Client;

  beforeAll(async () => {
    handler = createHttpHandler();
    http = await connectHttp(
      (input, init) => handler.fetch(new Request(input, init)),
      URL_,
    );
    memory = new Client({ name: 'memory', version: '0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer().connect(a);
    await memory.connect(b);
  });
  afterAll(async () => {
    await http.close();
    await memory.close();
  });

  it('lists the same tools, resources and prompts as over stdio', async () => {
    expect(await http.listTools()).toEqual(await memory.listTools());
    expect(await http.listResources()).toEqual(await memory.listResources());
    expect(await http.listPrompts()).toEqual(await memory.listPrompts());
  });

  it('gets the same result from every tool', async () => {
    for (const call of CALLS)
      expect(await http.callTool(call), call.name).toEqual(
        await memory.callTool(call),
      );
  });

  it('reads the player page and the guide', async () => {
    const player = await http.readResource({
      uri: 'ui://algomotion/player.html',
    });
    expect(player.contents[0]).toMatchObject({
      mimeType: 'text/html;profile=mcp-app',
    });
    const guide = await http.readResource({ uri: 'algomotion://guide/stack' });
    expect(JSON.stringify(guide)).toContain('stack');
  });
});

describe('algomotion-mcp --http on a real socket', () => {
  let server: Awaited<ReturnType<typeof serveHttp>>;
  let client: Client;

  beforeAll(async () => {
    server = await serveHttp(
      createHttpHandler({ allowedHosts: ['localhost', '127.0.0.1'] }),
      {
        host: '127.0.0.1',
        port: 0,
      },
    );
    client = await connectHttp(fetch, `${server.url}mcp`);
  });
  afterAll(async () => {
    await client.close();
    await server.close();
  });

  /** Sends raw bytes and returns the status line of the answer. */
  const raw = (text: string) =>
    new Promise<string>((resolve, reject) => {
      const { hostname, port } = new URL(server.url);
      const socket = connect(Number(port), hostname, () => socket.end(text));
      let said = '';
      socket.on('data', (d: Buffer) => (said += d.toString()));
      socket.on('end', () => resolve(said.split('\r\n')[0]!));
      socket.on('error', reject);
    });

  it('survives a malformed Host and an absolute request target', async () => {
    expect(
      await raw('GET /mcp HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n'),
    ).toMatch(/ 40[03] /);
    expect(
      await raw(
        'POST //localhost/mcp HTTP/1.1\r\nHost: evil.example\r\nContent-Length: 0\r\nConnection: close\r\n\r\n',
      ),
    ).toMatch(/ 400 /);
    expect(
      await raw(
        'POST /mcp HTTP/1.1\r\nHost: evil.example\r\nContent-Length: 0\r\nConnection: close\r\n\r\n',
      ),
    ).toMatch(/ 403 /);
    // Still serving.
    expect((await client.listTools()).tools.length).toBeGreaterThan(5);
  });

  it('lists and calls the tools through the network', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('algomotion_render');
    const result = await client.callTool({
      name: 'algomotion_render',
      arguments: { recipe: 'insertion-sort', input: '3 1 2', frame: -1 },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result)).toContain('<svg');
  });
});

describe('algomotion-mcp --http as a process', () => {
  let child: ChildProcess;
  let url: string;

  beforeAll(async () => {
    child = spawn(
      process.execPath,
      [
        '--conditions=@algomotion/source',
        fileURLToPath(new URL('../src/mcp-server.ts', import.meta.url)),
        '--http',
        '--port',
        '0',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    url = await new Promise<string>((resolve, reject) => {
      let said = '';
      child.stderr!.on('data', (chunk: Buffer) => {
        said += chunk.toString();
        const found = /on (http:\/\/\S+)/.exec(said);
        if (found) resolve(found[1]!);
      });
      child.once('exit', (code) =>
        reject(new Error(`exited ${code}: ${said}`)),
      );
    });
  }, 30_000);
  afterAll(() => {
    child.kill();
  });

  it('serves a client on localhost, and refuses other origins and hosts', async () => {
    const client = await connectHttp(fetch, url);
    expect((await client.listTools()).tools.length).toBeGreaterThan(5);
    await client.close();
    const send = (headers: Record<string, string>) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...headers,
        },
        body: JSON.stringify(initialize),
      });
    expect((await send({ origin: 'http://localhost:6274' })).status).toBe(200);
    expect((await send({ origin: 'https://evil.example' })).status).toBe(403);
    // fetch will not send another Host, so ask node:http.
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        url,
        {
          method: 'POST',
          headers: {
            host: 'rebind.example',
            'content-type': 'application/json',
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.once('error', reject);
      req.end(JSON.stringify(initialize));
    });
    expect(status).toBe(403);
  });
});

describe('the arguments of algomotion-mcp', () => {
  it('defaults to stdio, and to 127.0.0.1:8787 over HTTP', () => {
    expect(parseServeArgs([])).toEqual({
      http: false,
      host: '127.0.0.1',
      port: 8787,
    });
    expect(
      parseServeArgs(['--http', '--port', '0', '--host', '0.0.0.0']),
    ).toEqual({
      http: true,
      host: '0.0.0.0',
      port: 0,
    });
  });

  it('refuses what it does not know', () => {
    expect(() => parseServeArgs(['--port', '1'])).toThrow('go with --http');
    expect(() => parseServeArgs(['--http', '--port', 'x'])).toThrow(
      '--port takes',
    );
    expect(() => parseServeArgs(['--http', '--port'])).toThrow('needs a value');
    expect(() => parseServeArgs(['--verbose'])).toThrow('Unknown option');
  });

  it('knows the origins and hosts of this machine', () => {
    expect(isLocalOrigin('http://localhost:6274')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1')).toBe(true);
    expect(isLocalOrigin('http://[::1]:3000')).toBe(true);
    expect(isLocalOrigin('https://localhost.evil.example')).toBe(false);
    expect(isLocalOrigin('not a url')).toBe(false);
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(isLocalHost('0.0.0.0')).toBe(false);
  });
});
