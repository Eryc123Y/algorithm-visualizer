import type { Guide } from '../guide.ts';

export const ai: Guide = {
  slug: 'ai',
  title: 'AI assistants',
  nav: 'AI assistants',
  summary:
    'Connect an MCP client, then ask it to run an algorithm or write and check a document for a custom example.',
  figures: [
    {
      key: 'show',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      alt: 'The Dijkstra frame an assistant can show while explaining why C’s distance becomes 5.',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="hosted">Connect to the hosted server</h2>
<p>The hosted endpoint is <code>https://algomotion-mcp.turing2234.com/mcp</code>. It speaks Streamable HTTP and needs no authentication. In Claude Code, add it with:</p>
${code(`claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp`, 'Add the hosted server to Claude Code')}
<p>In claude.ai or Claude Desktop, open Settings → Connectors → Add custom connector and use that URL. Other MCP clients can use their Streamable HTTP configuration. For clients with a <code>servers</code> map, such as those using this JSON form:</p>
${code(
  `{
  "servers": {
    "algomotion": {
      "type": "http",
      "url": "https://algomotion-mcp.turing2234.com/mcp"
    }
  }
}`,
  'HTTP client configuration',
)}
<p>Configuration keys vary by client; choose Streamable HTTP rather than the older SSE transport. The server is stateless. Each client IP may make about 60 requests a minute; excess requests receive <code>429</code> and <code>Retry-After: 60</code>. Requests have a 1 MiB body limit and a ten-second budget.</p>

<h2 id="ask">Ask for a run</h2>
${code(
  `Show me Dijkstra's algorithm from A on A-B 4, B-C 1, A-C 7.
Open improve#3 and explain why C changes from 7 to 5.

Show insertion sort on 5 2 4 6 1 3. Stop at insert#2.

Show bst.delete with from [8,3,10,1,6] and key 3.
Give me a share link so I can put the run in my notes.`,
  'Example prompts',
)}
${figure('show', 'At <code>improve#3</code>, the path from A through B costs 5, less than the direct edge’s 7.')}
<p>A recipe is a ready-made algorithm run. The assistant should prefer one when it fits. It can show a recipe directly without copying a document:</p>
${code(`{"recipe":"dijkstra","input":"A-B 4, B-C 1, A-C 7","frame":"improve#3"}`, 'Arguments for algomotion_show')}

<h2 id="tools">The seven tools</h2>
<div class="scroll" role="region" aria-label="MCP tools" tabindex="0"><table class="params">
<thead><tr><th>Tool</th><th>What it does</th><th>Example arguments</th></tr></thead><tbody>
<tr><td><code>algomotion_guide</code></td><td>Returns the authoring guide, actions and examples for selected kinds.</td><td><code>{"kinds":["array","graph"]}</code></td></tr>
<tr><td><code>algomotion_validate</code></td><td>Checks a document's shape and replays every action. Reports errors and warnings.</td><td><code>{"document": …}</code></td></tr>
<tr><td><code>algomotion_inspect</code></td><td>Returns structure states and marks at selected frames, with names, sections and narration.</td><td><code>{"recipe":"insertion-sort","input":"5 2 4","frames":[0,"insert",-1]}</code></td></tr>
<tr><td><code>algomotion_render</code></td><td>Returns one standalone SVG in a fixed theme.</td><td><code>{"recipe":"insertion-sort","input":"5 2 4","frame":"insert","theme":"print"}</code></td></tr>
<tr><td><code>algomotion_list_recipes</code></td><td>Lists ids, titles, topics, summaries and input schemas.</td><td><code>{}</code></td></tr>
<tr><td><code>algomotion_run_recipe</code></td><td>Runs an id on input and returns the JSON document.</td><td><code>{"id":"insertion-sort","input":"5 2 4"}</code></td></tr>
<tr><td><code>algomotion_show</code></td><td>Shows a document or recipe in an MCP Apps player.</td><td><code>{"recipe":"insertion-sort","input":"5 2 4"}</code></td></tr>
</tbody></table></div>
<p><code>inspect</code>, <code>render</code> and <code>show</code> accept either <code>document</code> or <code>recipe</code> with optional <code>input</code>, never both. <code>validate</code> takes documents only. <code>inspect</code> accepts sections and ranges, with at most 20 frames. <code>render</code> and <code>show</code> take one frame. Use <code>run_recipe</code>'s <code>id</code> key when asking for a document.</p>
<p>A complete <code>algomotion_validate</code> call checks a custom document like this:</p>
${code(
  `{"document":{"version":"1.0","structures":{"s":{"kind":"stack","initial":[1]}},
  "steps":[{"actions":[{"target":"s","type":"push","element":2}],
    "meta":{"id":"push","narration":"Push 2 on top."}}]}}`,
  'Arguments for algomotion_validate',
)}
<p>For a custom visualization, ask the assistant to read the guide, write a document, validate it, inspect its important frames, and then show it. For example:</p>
${code(
  `Write a document showing a stack starting at [1], then pushing 2 and popping it.
Name the steps and explain the last-in, first-out rule.
Validate the document and inspect frames 0 and -1 before showing it.`,
  'A custom document prompt',
)}
<p>The server also offers a <code>visualize</code> prompt and resources at <code>algomotion://guide</code>, <code>algomotion://guide/array</code> and <code>algomotion://schema</code>.</p>

<h2 id="player">The player in the conversation</h2>
<p>In clients supporting MCP Apps, <code>algomotion_show</code> opens <code>ui://algomotion/player.html</code> inside the conversation. It follows the client's light or dark theme. When you stop at a frame, it tells the model the frame, step name, section and narration, so you can ask about the step you see. Clients without MCP Apps receive the text result only.</p>
<p>The hosted server can return <a href="${root}guide/share-links/">share links</a> from <code>algomotion_show</code> and <code>algomotion_run_recipe</code>. Recipe links carry the id and input; custom-document links carry the compressed document. If a link would exceed 16,384 characters, the text explains why no link was made.</p>

<h2 id="local">Run locally over stdio</h2>
<p>Nothing is on npm yet. Build from the repository, then register the resulting server. Replace the absolute checkout path:</p>
${code(
  `npm ci
npm run build -w @algomotion/mcp
claude mcp add algomotion -- node /absolute/path/packages/mcp/dist/mcp-server.js`,
  'Register a local stdio server',
)}
<p>For Claude Desktop's local server configuration, use:</p>
${code(
  `{
  "mcpServers": {
    "algomotion": {
      "command": "node",
      "args": ["/absolute/path/packages/mcp/dist/mcp-server.js"],
      "env": {"ALGOMOTION_SHARE_URL":"https://example.org/play/"}
    }
  }
}`,
  'Local stdio configuration',
)}
${note('<p>The optional <code>ALGOMOTION_SHARE_URL</code> must point to a share page you serve. Without it, local tools make no links. Use an absolute HTTP or HTTPS URL without credentials, a fragment, backslashes, spaces or control characters.</p>')}
<p>For a local HTTP client instead, start the same server with <code>--http</code>. <code>--port</code> and <code>--host</code> select its address; the default is <code>127.0.0.1:8787</code>.</p>
${code(
  `node packages/mcp/dist/mcp-server.js --http --port 8787
claude mcp add --transport http algomotion http://127.0.0.1:8787/mcp`,
  'Local HTTP transport',
)}
`,
};
