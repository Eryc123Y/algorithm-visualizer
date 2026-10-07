/**
 * The server through a real MCP client, over an in-memory transport.
 */
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { kindNames } from '@algoviz/spec';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { INSTRUCTIONS } from '../src/instructions.ts';
import { createServer } from '../src/server.ts';
import { tools } from '../src/tools.ts';

const client = new Client({ name: 'test', version: '0.0.0' });

beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
});
afterAll(() => client.close());

const text = (result: Awaited<ReturnType<typeof client.callTool>>) => {
  const [first] = result.content as { type: string; text: string }[];
  return first!.text;
};

describe('MCP server', () => {
  it('sends the instructions', () => {
    expect(client.getInstructions()).toBe(INSTRUCTIONS);
  });

  it('lists every tool as read-only, with an input schema', async () => {
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name)).toEqual(tools.map((t) => t.name));
    for (const t of listed) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('validates a document', async () => {
    const result = await client.callTool({
      name: 'algoviz_validate',
      arguments: {
        document: {
          version: '0.1',
          structures: { s: { kind: 'stack', initial: [] } },
          steps: [{ actions: [{ target: 's', type: 'pop' }] }],
        },
      },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('EMPTY at $.steps[0].actions[0]');
  });

  it('rejects arguments that do not match the schema', async () => {
    const result = await client.callTool({
      name: 'algoviz_render',
      arguments: { document: {}, theme: 'neon' },
    });
    expect(result.isError).toBe(true);
  });

  it('serves the guide, a section per kind, and the schema', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual([
      'algoviz://guide',
      ...kindNames.map((k) => `algoviz://guide/${k}`),
      'algoviz://schema',
    ]);
    const graph = await client.readResource({ uri: 'algoviz://guide/graph' });
    expect((graph.contents[0] as { text: string }).text).toMatch(/^## graph/);
    const schema = await client.readResource({ uri: 'algoviz://schema' });
    const parsed = JSON.parse(
      (schema.contents[0] as { text: string }).text,
    ) as {
      title: string;
    };
    expect(parsed.title).toBe('Visualization');
  });

  it('offers a prompt to start a visualization', async () => {
    const prompt = await client.getPrompt({
      name: 'visualize',
      arguments: { request: 'bubble sort on [3, 1, 2]' },
    });
    expect(prompt.messages[0]!.content).toEqual({
      type: 'text',
      text: 'Make an algoviz visualization: bubble sort on [3, 1, 2]',
    });
  });
});
