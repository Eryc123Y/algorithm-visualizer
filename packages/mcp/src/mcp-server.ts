#!/usr/bin/env node
/**
 * Runs the MCP server: over stdio for clients such as Claude Desktop or
 * Claude Code (`algomotion-mcp`), or over Streamable HTTP
 * (`algomotion-mcp --http [--host 127.0.0.1] [--port 8787]`, ADR 0039). Bound
 * to this machine, HTTP serves only pages and hosts on it.
 */
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { createHttpHandler } from './http.ts';
import {
  isLocalHost,
  isLocalOrigin,
  LOCAL_HOSTS,
  parseServeArgs,
  serveHttp,
} from './http-node.ts';
import { createServer } from './server.ts';
import { checkShareUrl, shareBaseFromEnv } from './share.ts';

let args;
let shareUrl;
try {
  args = parseServeArgs(process.argv.slice(2));
  // Share links need the share page's address, which no code assumes.
  shareUrl = shareBaseFromEnv(process.env);
  if (shareUrl !== undefined) checkShareUrl(shareUrl);
} catch (e) {
  process.stderr.write(`algomotion-mcp: ${(e as Error).message}\n`);
  process.exit(2);
}

if (!args.http)
  await createServer({ shareUrl }).connect(new StdioServerTransport());
else {
  const local = isLocalHost(args.host);
  const handler = createHttpHandler({
    ...(local
      ? { allowedOrigins: isLocalOrigin, allowedHosts: LOCAL_HOSTS }
      : {}),
    shareUrl,
  });
  const serving = await serveHttp(handler, args);
  process.stderr.write(`algomotion MCP server on ${serving.url}mcp\n`);
}
