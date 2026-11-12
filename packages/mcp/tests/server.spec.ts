/**
 * The server through a real MCP client, over an in-memory transport.
 */
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { kindNames } from '@algomotion/spec';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_INSTRUCTIONS } from '../src/instructions.ts';
import { createServer } from '../src/server.ts';
import { PLAYER_URI } from '../src/show.ts';
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
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
  });

  it('lists every tool as read-only, with an input schema', async () => {
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name)).toEqual([
      ...tools.map((t) => t.name),
      'algomotion_show',
    ]);
    for (const t of listed) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('validates a document', async () => {
    const result = await client.callTool({
      name: 'algomotion_validate',
      arguments: {
        document: {
          version: '1.0',
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
      name: 'algomotion_render',
      arguments: { document: {}, theme: 'neon' },
    });
    expect(result.isError).toBe(true);
  });

  it('serves the guide, a section per kind, and the schema', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual([
      PLAYER_URI,
      'algomotion://guide',
      ...kindNames.map((k) => `algomotion://guide/${k}`),
      'algomotion://schema',
    ]);
    const graph = await client.readResource({
      uri: 'algomotion://guide/graph',
    });
    expect((graph.contents[0] as { text: string }).text).toMatch(/^## graph/);
    const schema = await client.readResource({ uri: 'algomotion://schema' });
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
      text: 'Make an algomotion visualization: bubble sort on [3, 1, 2]',
    });
  });
});

describe('algomotion_show, the MCP App', () => {
  const doc = {
    version: '1.0',
    title: 'Two pushes',
    structures: { s: { kind: 'stack', initial: [] } },
    steps: [
      {
        actions: [{ target: 's', type: 'push', element: 1 }],
        meta: { narration: 'Push 1.' },
      },
      {
        actions: [{ target: 's', type: 'push', element: 2 }],
        meta: { narration: 'Push 2.' },
      },
    ],
  };

  it('links the tool to the player page', async () => {
    const { tools: listed } = await client.listTools();
    const shown = listed.find((t) => t.name === 'algomotion_show')!;
    expect(shown._meta).toMatchObject({ ui: { resourceUri: PLAYER_URI } });
    expect(shown.annotations?.readOnlyHint).toBe(true);
  });

  it('serves the player page as one self-contained HTML file', async () => {
    const page = await client.readResource({ uri: PLAYER_URI });
    const [content] = page.contents as { mimeType: string; text: string }[];
    expect(content!.mimeType).toBe('text/html;profile=mcp-app');
    expect(content!.text).toMatch(/^<!doctype html>/);
    expect(content!.text).toContain('<algo-player hidden>');
    // Hosts load nothing but this file.
    expect(content!.text).not.toMatch(/<script[^>]* src=|<link[^>]* href=/);
  });

  it('hands a valid document and frame to the page', async () => {
    const result = await client.callTool({
      name: 'algomotion_show',
      arguments: { document: JSON.stringify(doc), frame: -1 },
    });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toMatch(/^Shown to the user .* at frame 2\. Valid:/);
    const shown = result.structuredContent as {
      document: { title: string; steps: unknown[] };
      frame: number;
    };
    expect(shown.frame).toBe(2);
    expect(shown.document.title).toBe('Two pushes');
    expect(shown.document.steps).toHaveLength(2);
  });

  it('reports an invalid document or frame as an error', async () => {
    const invalid = await client.callTool({
      name: 'algomotion_show',
      arguments: {
        document: {
          ...doc,
          steps: [{ actions: [{ target: 's', type: 'pop' }] }],
        },
      },
    });
    expect(invalid.isError).toBe(true);
    expect(text(invalid)).toContain('EMPTY at $.steps[0].actions[0]');
    expect(invalid.structuredContent).toBeUndefined();
    const frame = await client.callTool({
      name: 'algomotion_show',
      arguments: { document: doc, frame: 3 },
    });
    expect(frame.isError).toBe(true);
    expect(text(frame)).toContain('OUT_OF_RANGE');
  });
});
