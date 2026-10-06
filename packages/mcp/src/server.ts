/**
 * The MCP server: the tools, the guide and schema as resources, and a
 * prompt that starts a visualization.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { kindNames, visualizationJsonSchema } from '@algoviz/spec';
import { z } from 'zod';

import { guide, guideSection } from './guide.ts';
import { INSTRUCTIONS, visualizeRequest } from './instructions.ts';
import { tools } from './tools.ts';

export const SERVER_NAME = 'algoviz';
export const SERVER_VERSION = '0.0.0';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  for (const t of tools)
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (args) => {
        const result = t.run(args);
        return {
          content: [{ type: 'text', text: result.text }],
          ...(result.isError ? { isError: true } : {}),
        };
      },
    );

  const full = guide();
  if (!full.ok) throw new Error('The guide failed to load');
  server.registerResource(
    'guide',
    'algoviz://guide',
    {
      title: 'Authoring guide',
      description: 'How to write algoviz documents, with every structure kind.',
      mimeType: 'text/markdown',
    },
    (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'text/markdown', text: full.value },
      ],
    }),
  );
  for (const kind of kindNames)
    server.registerResource(
      `guide-${kind}`,
      `algoviz://guide/${kind}`,
      {
        title: `Guide: ${kind}`,
        description: `The ${kind} structure kind: declaration, actions and an example.`,
        mimeType: 'text/markdown',
      },
      (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: guideSection(kind),
          },
        ],
      }),
    );
  server.registerResource(
    'schema',
    'algoviz://schema',
    {
      title: 'JSON Schema',
      description: 'JSON Schema (draft 2020-12) of the document format.',
      mimeType: 'application/schema+json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/schema+json',
          text: JSON.stringify(visualizationJsonSchema()),
        },
      ],
    }),
  );

  server.registerPrompt(
    'visualize',
    {
      title: 'Visualize an algorithm',
      description:
        'Make a step-by-step visualization of an algorithm on an input.',
      argsSchema: {
        request: z
          .string()
          .describe('What to show, e.g. "insertion sort on [4, 2, 5, 1]".'),
      },
    },
    ({ request }) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: visualizeRequest(request) },
        },
      ],
    }),
  );

  return server;
}
