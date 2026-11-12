/**
 * The MCP server: the tools, the guide and schema as resources, and a
 * prompt that starts a visualization.
 */
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/server';
import { kindNames, visualizationJsonSchema } from '@algoviz/spec';
import { z } from 'zod';

import { guide, guideSection } from './guide.ts';
import { SERVER_INSTRUCTIONS, visualizeRequest } from './instructions.ts';
import { PLAYER_URI, playerHtml, showSource } from './show.ts';
import { sourceArgs } from './source.ts';
import { FrameSelectorArg, tools } from './tools.ts';

export const SERVER_NAME = 'algoviz';
export const SERVER_VERSION = '0.0.0';

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export interface ServerOptions {
  /**
   * Answer a tool or resource that throws with a bare "Internal error"
   * rather than the error's message, which can name files: for servers
   * open to the network (ADR 0039).
   */
  readonly hideInternalErrors?: boolean;
}

/** The text a failure shows when `hideInternalErrors` is on. */
export const INTERNAL_ERROR_TEXT = 'Internal error';

export function createServer(options: ServerOptions = {}): McpServer {
  const hide = options.hideInternalErrors === true;
  /** A tool callback that, when hiding, answers a throw with the bare text. */
  const guarded =
    <A, R>(run: (args: A) => R) =>
    (
      args: A,
    ): R | { content: { type: 'text'; text: string }[]; isError: true } => {
      if (!hide) return run(args);
      try {
        return run(args);
      } catch {
        return {
          content: [{ type: 'text', text: INTERNAL_ERROR_TEXT }],
          isError: true,
        };
      }
    };
  /** A resource callback that, when hiding, throws a bare error instead. */
  const quiet =
    <A extends unknown[], R>(read: (...args: A) => R) =>
    (...args: A): R => {
      if (!hide) return read(...args);
      try {
        return read(...args);
      } catch {
        throw new Error(INTERNAL_ERROR_TEXT);
      }
    };
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  for (const t of tools)
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: readOnly,
      },
      guarded((args: Record<string, unknown>) => {
        const result = t.run(args);
        return {
          content: [{ type: 'text' as const, text: result.text }],
          ...(result.isError ? { isError: true } : {}),
        };
      }),
    );

  registerAppTool(
    server,
    'algoviz_show',
    {
      title: 'Show to the user',
      description:
        'Shows a valid document to the user as an interactive player in the conversation, with play, step and seek controls. Use it once the document validates and does what you meant. For a recipe, give the recipe and its input instead of a document, such as recipe "dijkstra" with input "A-B 4, B-C 1, A-C 7": there is no need to run it first. Hosts without MCP Apps only get the text result, so also give the user the document or a link if they need it.',
      inputSchema: z.strictObject({
        ...sourceArgs,
        frame: FrameSelectorArg.optional().describe(
          'The frame to open on: 0 (default) is the initial state, -1 the last; or a selector of one frame, such as "relax#2" or "insert-5/go".',
        ),
      }),
      annotations: readOnly,
      _meta: { ui: { resourceUri: PLAYER_URI } },
    },
    guarded(({ frame, ...source }) => {
      const result = showSource(source, frame);
      return result.ok
        ? {
            content: [{ type: 'text', text: result.text }],
            structuredContent: { ...result.content },
          }
        : { content: [{ type: 'text', text: result.text }], isError: true };
    }),
  );
  registerAppResource(
    server,
    'player',
    PLAYER_URI,
    {
      title: 'Player',
      description: 'The interactive player that algoviz_show opens.',
      mimeType: RESOURCE_MIME_TYPE,
    },
    quiet((uri: URL) => ({
      contents: [
        { uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: playerHtml() },
      ],
    })),
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
      quiet((uri: URL) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: guideSection(kind),
          },
        ],
      })),
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
