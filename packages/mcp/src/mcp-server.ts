#!/usr/bin/env node
/**
 * Runs the MCP server: over stdio for clients such as Claude Desktop or
 * Claude Code (`algoviz-mcp`), or over Streamable HTTP
 * (`algoviz-mcp --http [--host 127.0.0.1] [--port 8787]`, ADR 0039). Bound
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

let args;
try {
  args = parseServeArgs(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`algoviz-mcp: ${(e as Error).message}\n`);
  process.exit(2);
}

if (!args.http) await createServer().connect(new StdioServerTransport());
else {
  const local = isLocalHost(args.host);
  const handler = createHttpHandler(
    local ? { allowedOrigins: isLocalOrigin, allowedHosts: LOCAL_HOSTS } : {},
  );
  const serving = await serveHttp(handler, args);
  process.stderr.write(`algoviz MCP server on ${serving.url}mcp\n`);
}
