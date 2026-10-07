/**
 * End to end over a real process: the MCP server started as a client would
 * start it, spoken to over stdio, and the CLI run as a command.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const src = (file: string) =>
  fileURLToPath(new URL(`../src/${file}`, import.meta.url));
const node = ['--conditions=@algoviz/source'];

type Content = { type: string; text: string }[];
const textOf = (result: Record<string, unknown>) =>
  (result['content'] as Content)[0]!.text;

describe('the MCP server over stdio', () => {
  const client = new Client({ name: 'e2e', version: '0.0.0' });

  beforeAll(async () => {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [...node, src('mcp-server.ts')],
        stderr: 'pipe',
      }),
    );
  }, 30_000);
  afterAll(() => client.close());

  it('introduces itself', () => {
    expect(client.getServerVersion()?.name).toBe('algoviz');
    expect(client.getInstructions()).toContain('algoviz_validate');
  });

  it('serves the workflow a model follows: guide, write, fix, check, render', async () => {
    const guide = await client.callTool({
      name: 'algoviz_guide',
      arguments: { kinds: ['stack'] },
    });
    expect(textOf(guide)).toContain('## stack');

    // A first draft with a mistake: popping an empty stack.
    const draft = {
      version: '0.1',
      structures: { s: { kind: 'stack', initial: [] } },
      steps: [
        {
          actions: [{ target: 's', type: 'pop' }],
          meta: { narration: 'Pop.' },
        },
      ],
    };
    const invalid = await client.callTool({
      name: 'algoviz_validate',
      arguments: { document: draft },
    });
    expect(invalid.isError).toBe(true);
    expect(textOf(invalid)).toContain('EMPTY at $.steps[0].actions[0]');

    const fixed = {
      ...draft,
      steps: [
        {
          actions: [{ target: 's', type: 'push', element: 1 }],
          meta: { narration: 'Push 1.' },
        },
        ...draft.steps,
      ],
    };
    const valid = await client.callTool({
      name: 'algoviz_validate',
      arguments: { document: JSON.stringify(fixed) },
    });
    expect(textOf(valid)).toBe('Valid: s (stack); 2 steps, frames 0–2.');

    const inspected = await client.callTool({
      name: 'algoviz_inspect',
      arguments: { document: fixed, frames: [1, -1] },
    });
    expect(textOf(inspected)).toContain('"data":[{"id":"e0","value":1}]');
    expect(textOf(inspected)).toContain('narration: Pop.');

    const drawn = await client.callTool({
      name: 'algoviz_render',
      arguments: { document: fixed, frame: 1, theme: 'dark' },
    });
    expect(textOf(drawn)).toMatch(/^<svg [^>]*viewBox="0 0 \d+/);
  });

  it('runs a recipe whose document validates', async () => {
    const listed = JSON.parse(
      textOf(
        await client.callTool({ name: 'algoviz_list_recipes', arguments: {} }),
      ),
    ) as { name: string }[];
    expect(listed.map((r) => r.name)).toContain('kruskal');
    const doc = await client.callTool({
      name: 'algoviz_run_recipe',
      arguments: {
        name: 'kruskal',
        args: {
          graph: {
            nodes: ['A', 'B', 'C'],
            edges: [
              ['A', 'B', 1],
              ['B', 'C', 2],
              ['A', 'C', 3],
            ],
          },
        },
      },
    });
    const valid = await client.callTool({
      name: 'algoviz_validate',
      arguments: { document: textOf(doc) },
    });
    expect(textOf(valid)).toMatch(/^Valid: g \(graph\), sets \(tree\)/);
  });

  it('reports bad recipe arguments without crashing', async () => {
    const result = await client.callTool({
      name: 'algoviz_run_recipe',
      arguments: { name: 'linearProbing', args: { keys: [1.5], size: 3 } },
    });
    expect(result.isError).toBe(true);
    // The server is still there.
    expect((await client.listTools()).tools.length).toBe(6);
  });

  it('serves resources and the prompt', async () => {
    const schema = await client.readResource({ uri: 'algoviz://schema' });
    expect(
      JSON.parse((schema.contents[0] as { text: string }).text),
    ).toHaveProperty('$id');
    const prompt = await client.getPrompt({
      name: 'visualize',
      arguments: { request: 'BFS' },
    });
    expect(prompt.messages).toHaveLength(1);
  });
});

describe('the CLI as a command', () => {
  const run = (args: string[], input?: string) =>
    spawnSync(process.execPath, [...node, src('algoviz.ts'), ...args], {
      input,
      encoding: 'utf8',
    });

  it('validates a document from standard input', () => {
    const doc = JSON.stringify({
      version: '0.1',
      structures: { q: { kind: 'queue', initial: [1] } },
      steps: [
        {
          actions: [{ target: 'q', type: 'dequeue' }],
          meta: { narration: 'Take 1.' },
        },
      ],
    });
    const result = run(['validate', '-'], doc);
    expect([result.status, result.stdout.trim()]).toEqual([
      0,
      'Valid: q (queue); 1 steps, frames 0–1.',
    ]);
  });

  it('exits with 1 and prints errors to stderr for an invalid document', () => {
    const result = run(['validate', '-'], '{"version": "0.1"}');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('INVALID_SHAPE');
    expect(result.stdout).toBe('');
  });

  it('prints a recipe that renders', () => {
    const recipe = run([
      'recipe',
      'binarySearch',
      '{"values": [1, 2, 3], "target": 3}',
    ]);
    expect(recipe.status).toBe(0);
    const svg = run(['render', '-', '--frame', '-1'], recipe.stdout);
    expect([svg.status, svg.stdout.startsWith('<svg')]).toEqual([0, true]);
  });
});
