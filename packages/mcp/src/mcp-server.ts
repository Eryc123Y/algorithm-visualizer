#!/usr/bin/env node
/**
 * Runs the MCP server over stdio, for clients such as Claude Desktop or
 * Claude Code: `algoviz-mcp`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { createServer } from './server.ts';

await createServer().connect(new StdioServerTransport());
