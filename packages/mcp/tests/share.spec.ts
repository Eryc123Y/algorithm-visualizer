/**
 * Share links from the tools (ADR 0040): algoviz_show and
 * algoviz_run_recipe return one as a second text item when the server
 * has a share page's address, and no tool does without one.
 */
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { readShareFragment } from '@algoviz/spec';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer, type ServerOptions } from '../src/server.ts';
import { shareBaseFromEnv } from '../src/share.ts';

const BASE = 'https://example.org/play/';

const doc = {
  version: '0.1',
  title: 'Two pushes',
  structures: { s: { kind: 'stack', initial: [] } },
  steps: [
    { actions: [{ target: 's', type: 'push', element: 1 }] },
    { actions: [{ target: 's', type: 'push', element: 2 }] },
  ],
};

async function connect(options?: ServerOptions): Promise<Client> {
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(options).connect(a);
  await client.connect(b);
  return client;
}

type Called = Awaited<ReturnType<Client['callTool']>>;
const texts = (result: Called) =>
  (result.content as { type: string; text: string }[]).map((c) => c.text);

/** The link in a result's second item, read back. */
async function linked(result: Called) {
  const [, second] = texts(result);
  const prefix = `Share link (opens it in the algoviz player in any browser): ${BASE}#`;
  expect(second?.startsWith(prefix)).toBe(true);
  const read = await readShareFragment(second!.slice(prefix.length));
  if (!read.ok) throw new Error(JSON.stringify(read.error));
  return read.value;
}

describe('with a share page', () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect({ shareUrl: BASE });
  });
  afterAll(() => client.close());

  it('links a recipe that algoviz_show shows to the recipe and its input', async () => {
    const result = await client.callTool({
      name: 'algoviz_show',
      arguments: {
        recipe: 'dijkstra',
        input: 'A-B 4, B-C 1',
        frame: 'improve#1',
      },
    });
    expect(result.isError).toBeFalsy();
    expect(texts(result)[1]).toBe(
      `Share link (opens it in the algoviz player in any browser): ${BASE}#v=1&alg=dijkstra&in=A-B%204%2C%20B-C%201&frame=improve%231`,
    );
  });

  it('writes a structured input as JSON, and no input as none', async () => {
    const structured = await client.callTool({
      name: 'algoviz_show',
      arguments: { recipe: 'insertion-sort', input: { values: [3, 1, 2] } },
    });
    expect(await linked(structured)).toEqual({
      algorithm: 'insertion-sort',
      input: '{"values":[3,1,2]}',
    });
    const none = await client.callTool({
      name: 'algoviz_show',
      arguments: { recipe: 'insertion-sort' },
    });
    expect(await linked(none)).toEqual({ algorithm: 'insertion-sort' });
  });

  it('links a document that algoviz_show shows to the document itself', async () => {
    const result = await client.callTool({
      name: 'algoviz_show',
      arguments: { document: JSON.stringify(doc), frame: -1 },
    });
    expect(await linked(result)).toEqual({ document: doc, frame: '-1' });
  });

  it('links a recipe that algoviz_run_recipe runs, after its document', async () => {
    const result = await client.callTool({
      name: 'algoviz_run_recipe',
      arguments: { id: 'bst.delete', input: { from: '8 3 10', key: 3 } },
    });
    const [first] = texts(result);
    expect(JSON.parse(first!)).toHaveProperty('steps');
    expect(await linked(result)).toEqual({
      algorithm: 'bst.delete',
      input: '{"from":"8 3 10","key":3}',
    });
  });

  it('makes no link for an error', async () => {
    const result = await client.callTool({
      name: 'algoviz_show',
      arguments: { recipe: 'no-such-recipe' },
    });
    expect(result.isError).toBe(true);
    expect(texts(result)).toHaveLength(1);
  });

  it('links nothing from the tools that check or draw', async () => {
    for (const [name, args] of [
      ['algoviz_validate', { document: doc }],
      ['algoviz_inspect', { document: doc }],
      ['algoviz_render', { document: doc }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(texts(result), name).toHaveLength(1);
    }
  });

  it('says why a document too large for a link has none', async () => {
    // Narration of random letters, which compresses poorly.
    let x = 7;
    const noise = () =>
      Array.from({ length: 1900 }, () => {
        x = (x * 48271) % 2147483647; // Park–Miller: exact in doubles
        return String.fromCharCode(97 + (x % 26));
      }).join('');
    const big = {
      ...doc,
      steps: Array.from({ length: 16 }, (_, k) => ({
        actions: [{ target: 's', type: 'push', element: k }],
        meta: { narration: noise() },
      })),
    };
    const result = await client.callTool({
      name: 'algoviz_show',
      arguments: { document: big },
    });
    expect(result.isError).toBeFalsy();
    const [, second] = texts(result);
    expect(second).toMatch(
      /^No share link\. The link would be [\d,]+ characters long, over the limit of 16,384/,
    );
    expect(second).toMatch(/recipe/);
  });
});

describe('without a share page', () => {
  it('makes no links', async () => {
    const client = await connect();
    const shown = await client.callTool({
      name: 'algoviz_show',
      arguments: { recipe: 'bfs' },
    });
    expect(texts(shown)).toHaveLength(1);
    const ran = await client.callTool({
      name: 'algoviz_run_recipe',
      arguments: { id: 'bfs' },
    });
    expect(texts(ran)).toHaveLength(1);
    await client.close();
  });
});

describe('the share page address', () => {
  it('stops the server at start when it is not a page’s address', () => {
    expect(() => createServer({ shareUrl: 'example.org/play' })).toThrow(
      /ALGOVIZ_SHARE_URL.*absolute URL/,
    );
    expect(() => createServer({ shareUrl: `${BASE}#x` })).toThrow(/fragment/);
  });

  it('is read from ALGOVIZ_SHARE_URL, where an empty value is none', () => {
    expect(shareBaseFromEnv({ ALGOVIZ_SHARE_URL: BASE })).toBe(BASE);
    expect(shareBaseFromEnv({ ALGOVIZ_SHARE_URL: ' ' })).toBeUndefined();
    expect(shareBaseFromEnv({})).toBeUndefined();
  });
});
