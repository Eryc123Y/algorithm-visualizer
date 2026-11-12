#!/usr/bin/env node
/**
 * Runs the MCP server over stdio, for clients such as Claude Desktop or
 * Claude Code: `algoviz-mcp`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { createServer } from './server.ts';
import { shareBaseFromEnv } from './share.ts';

// Share links need the share page's address, which no code assumes.
await createServer({ shareUrl: shareBaseFromEnv(process.env) }).connect(
  new StdioServerTransport(),
);
