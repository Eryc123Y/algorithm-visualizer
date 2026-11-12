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
import {
  kindNames,
  visualizationJsonSchema,
  type ShareContent,
} from '@algoviz/spec';
import { z } from 'zod';

import { guide, guideSection } from './guide.ts';
import { SERVER_INSTRUCTIONS, visualizeRequest } from './instructions.ts';
import { checkShareUrl, shareText, sourceShare } from './share.ts';
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
   * The share page's address, such as `https://example.org/play/`
   * (ADR 0040). With it, algoviz_show and algoviz_run_recipe return a
   * share link; without it, no tool does. No address is assumed.
   */
  readonly shareUrl?: string | undefined;
}

export function createServer(options: ServerOptions = {}): McpServer {
  const shareBase =
    options.shareUrl === undefined
      ? undefined
      : checkShareUrl(options.shareUrl);
  /** The result's text, then its share link when there is one. */
  const reply = async (text: string, share: ShareContent | undefined) => {
    const link = await shareText(shareBase, share);
    return [text, ...(link === undefined ? [] : [link])].map((t) => ({
      type: 'text' as const,
      text: t,
    }));
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
      async (args) => {
        const result = t.run(args);
        return {
          content: await reply(
            result.text,
            result.isError ? undefined : result.share,
          ),
          ...(result.isError ? { isError: true } : {}),
        };
      },
    );

  registerAppTool(
    server,
    'algoviz_show',
    {
      title: 'Show to the user',
      description:
        'Shows a valid document to the user as an interactive player in the conversation, with play, step and seek controls. Use it once the document validates and does what you meant. For a recipe, give the recipe and its input instead of a document, such as recipe "dijkstra" with input "A-B 4, B-C 1, A-C 7": there is no need to run it first. Hosts without MCP Apps only get the text result: give the user the share link it includes, when the server has one, or else the document.',
      inputSchema: z.strictObject({
        ...sourceArgs,
        frame: FrameSelectorArg.optional().describe(
          'The frame to open on: 0 (default) is the initial state, -1 the last; or a selector of one frame, such as "relax#2" or "insert-5/go".',
        ),
      }),
      annotations: readOnly,
      _meta: { ui: { resourceUri: PLAYER_URI } },
    },
    async ({ frame, ...source }) => {
      const result = showSource(source, frame);
      return result.ok
        ? {
            content: await reply(result.text, sourceShare(source, frame)),
            structuredContent: { ...result.content },
          }
        : { content: [{ type: 'text', text: result.text }], isError: true };
    },
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
    (uri) => ({
      contents: [
        { uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: playerHtml() },
      ],
    }),
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
