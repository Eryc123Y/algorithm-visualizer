/**
 * The built Worker (`dist/worker.js`) in wrangler's local runtime, workerd
 * from npm, with the configuration's rate limit binding simulated. The
 * SDK's own client lists and calls the tools over Streamable HTTP. Nothing
 * is deployed and no Cloudflare account is used.
 */
import { fileURLToPath } from 'node:url';

import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { unstable_startWorker } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let worker: Awaited<ReturnType<typeof unstable_startWorker>>;
let base: URL;

beforeAll(async () => {
  worker = await unstable_startWorker({
    config: fileURLToPath(new URL('../../wrangler.jsonc', import.meta.url)),
    build: { bundle: false },
    dev: {
      server: { hostname: '127.0.0.1', port: 0 },
      inspector: false,
      remote: false,
      watch: false,
    },
  });
  await worker.ready;
  base = await worker.url;
});
afterAll(async () => {
  await worker?.dispose();
});

const mcp = () => new URL('/mcp', base);

describe('the Worker in workerd', () => {
  it('describes itself at /', async () => {
    const res = await fetch(base);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('/mcp');
  });

  it('serves the SDK client: tools, a call, the player page and the guide', async () => {
    const client = new Client({ name: 'local-test', version: '0' });
    await client.connect(new StreamableHTTPClientTransport(mcp()));
    expect(client.getServerVersion()?.name).toBe('algoviz');
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'algoviz_validate',
        'algoviz_render',
        'algoviz_show',
      ]),
    );
    const rendered = await client.callTool({
      name: 'algoviz_render',
      arguments: {
        recipe: 'dijkstra',
        input: 'A-B 4, B-C 1, A-C 7',
        frame: -1,
      },
    });
    expect(rendered.isError).toBeFalsy();
    expect(JSON.stringify(rendered)).toContain('<svg');
    const shown = await client.callTool({
      name: 'algoviz_show',
      arguments: { recipe: 'stack' },
    });
    expect(shown.structuredContent).toMatchObject({ frame: 0 });
    const page = await client.readResource({ uri: 'ui://algoviz/player.html' });
    expect(JSON.stringify(page.contents[0])).toContain('<html');
    const guide = await client.callTool({
      name: 'algoviz_guide',
      arguments: { kinds: ['graph'] },
    });
    expect(JSON.stringify(guide)).toContain('## graph');
    await client.close();
  });

  it('keeps the request rules: preflight, path, method and size', async () => {
    const pre = await fetch(mcp(), {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example',
        'access-control-request-method': 'POST',
      },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect(
      (await fetch(new URL('/nope', base), { method: 'POST' })).status,
    ).toBe(404);
    expect((await fetch(mcp())).status).toBe(405);
    const big = await fetch(mcp(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(1024 * 1024 + 1),
    });
    expect(big.status).toBe(413);
  });

  // Last, since it spends a client's allowance for the minute. It sends
  // 130 requests, over twice the limit, so that even a window that rolls
  // over mid-loop counts more than 60 in one of its halves.
  it('answers 429 with Retry-After once a client passes the limit, per client', async () => {
    const as = (ip: string) =>
      fetch(mcp(), { method: 'GET', headers: { 'cf-connecting-ip': ip } });
    const statuses: number[] = [];
    let retry: string | null = null;
    for (let k = 0; k < 130; k++) {
      const res = await as('192.0.2.1');
      statuses.push(res.status);
      if (res.status === 429) retry = res.headers.get('retry-after');
    }
    expect(statuses).toContain(429);
    expect(statuses.slice(0, 60).every((s) => s === 405)).toBe(true);
    expect(retry).toBe('60');
    // Another client still has its own allowance.
    expect((await as('192.0.2.2')).status).toBe(405);
  });
});
