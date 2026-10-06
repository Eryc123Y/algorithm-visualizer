#!/usr/bin/env node
/**
 * Runs the MCP server over stdio, for clients such as Claude Desktop or
 * Claude Code: `algoviz-mcp`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.ts';

await createServer().connect(new StdioServerTransport());
