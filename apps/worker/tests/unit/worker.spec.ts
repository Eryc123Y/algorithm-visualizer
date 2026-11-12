/**
 * The Worker's own logic, without workerd: the info page, the rate limit
 * in front of the MCP handler, and the handler itself behind it.
 */
import { describe, expect, it, vi } from 'vitest';

import { createHttpHandler } from '@algoviz/mcp';

import {
  createWorker,
  RETRY_AFTER_SECONDS,
  type RateLimiter,
} from '../../src/app.ts';
import worker from '../../src/worker.ts';

const initialize = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 't', version: '0' },
  },
});
const post = (ip = '203.0.113.7') =>
  new Request('https://mcp.example/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'cf-connecting-ip': ip,
    },
    body: initialize,
  });

/** A limiter that allows `n` requests per key. */
function limiter(n: number): RateLimiter & { keys: string[] } {
  const seen = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    limit: vi.fn(({ key }: { key: string }) => {
      keys.push(key);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      return Promise.resolve({ success: count <= n });
    }),
  };
}

describe('the Worker', () => {
  it('describes itself at /', async () => {
    const res = await worker.fetch(new Request('https://mcp.example/'), {});
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('/mcp');
    const head = await worker.fetch(
      new Request('https://mcp.example/', { method: 'HEAD' }),
      {},
    );
    expect(await head.text()).toBe('');
  });

  it('serves MCP at /mcp without a limiter', async () => {
    const res = await worker.fetch(post(), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      result: { serverInfo: { name: 'algoviz' } },
    });
  });

  it('limits each client IP on its own, and says when to retry', async () => {
    const limit = limiter(2);
    const w = createWorker(createHttpHandler());
    expect((await w.fetch(post(), { RATE_LIMITER: limit })).status).toBe(200);
    expect((await w.fetch(post(), { RATE_LIMITER: limit })).status).toBe(200);
    const over = await w.fetch(post(), { RATE_LIMITER: limit });
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toBe(String(RETRY_AFTER_SECONDS));
    expect(over.headers.get('access-control-allow-origin')).toBe('*');
    expect(
      (await w.fetch(post('198.51.100.1'), { RATE_LIMITER: limit })).status,
    ).toBe(200);
    expect(limit.keys).toEqual([
      '203.0.113.7',
      '203.0.113.7',
      '203.0.113.7',
      '198.51.100.1',
    ]);
  });

  it('lets CORS preflight through without counting it', async () => {
    const limit = limiter(0);
    const res = await worker.fetch(
      new Request('https://mcp.example/mcp', {
        method: 'OPTIONS',
        headers: { origin: 'https://app.example' },
      }),
      { RATE_LIMITER: limit },
    );
    expect(res.status).toBe(204);
    expect(limit.keys).toEqual([]);
  });
});

describe('share links (ADR 0040)', () => {
  const show = new Request('https://mcp.example/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'algoviz_show', arguments: { recipe: 'bfs' } },
    }),
  });
  const texts = async (res: Response) => {
    const body = (await res.json()) as {
      result: { content: { text: string }[] };
    };
    return body.result.content.map((c) => c.text);
  };

  it('come from ALGOVIZ_SHARE_URL in the environment', async () => {
    // A fresh Worker: it makes its handler from the first request's env.
    vi.resetModules();
    const { default: fresh } = await import('../../src/worker.ts');
    const res = await fresh.fetch(show.clone(), {
      ALGOVIZ_SHARE_URL: 'https://example.org/play/',
    });
    expect(res.status).toBe(200);
    expect((await texts(res))[1]).toMatch(
      /^Share link .*: https:\/\/example\.org\/play\/#v=1&alg=bfs$/,
    );
  });

  it('are left out without it', async () => {
    const w = createWorker((env) =>
      createHttpHandler({ shareUrl: env.ALGOVIZ_SHARE_URL }),
    );
    const res = await w.fetch(show.clone(), {});
    expect(await texts(res)).toHaveLength(1);
  });

  it('answer 500 without details when the address is wrong', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = createWorker((env) =>
      createHttpHandler({ shareUrl: env.ALGOVIZ_SHARE_URL }),
    );
    const res = await w.fetch(show.clone(), {
      ALGOVIZ_SHARE_URL: 'example.org/play/',
    });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('example.org');
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('ALGOVIZ_SHARE_URL'),
    );
    error.mockRestore();
  });
});
