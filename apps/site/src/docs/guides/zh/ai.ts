import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'ai',
  title: 'AI 助手',
  nav: 'AI 助手',
  summary:
    '连上 MCP 客户端后，让它运行一个算法，或为自定义的示例编写并检查文档。',
  body: ({ root, code, note, scene }) => `
<h2 id="hosted">连接托管服务器</h2>
<p>托管端点是 <code>https://algomotion-mcp.turing2234.com/mcp</code>，使用 Streamable HTTP 传输，无需认证。在 Claude Code 中这样添加：</p>
${code(`claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp`, '把托管服务器添加到 Claude Code')}
<p>在 claude.ai 或 Claude Desktop 中，打开 Settings → Connectors → Add custom connector，填入这个 URL。其他 MCP 客户端可以用各自的 Streamable HTTP 配置。有些客户端用 <code>servers</code> 映射，例如下面这种 JSON 写法：</p>
${code(
  `{
  "servers": {
    "algomotion": {
      "type": "http",
      "url": "https://algomotion-mcp.turing2234.com/mcp"
    }
  }
}`,
  'HTTP 客户端配置',
)}
<p>各客户端的配置键不尽相同；选 Streamable HTTP，不要选旧的 SSE 传输。服务器是无状态的。每个客户端 IP 每分钟约可发 60 个请求，超出的请求收到 <code>429</code> 和 <code>Retry-After: 60</code>。请求体上限 1 MiB，每个请求的处理时限为十秒。</p>

<h2 id="ask">请求一次运行</h2>
${code(
  `Show me Dijkstra's algorithm from A on A-B 4, B-C 1, A-C 7.
Open improve#3 and explain why C changes from 7 to 5.

Show insertion sort on 5 2 4 6 1 3. Stop at insert#2.

Show bst.delete with from [8,3,10,1,6] and key 3.
Give me a share link so I can put the run in my notes.`,
  '示例提示词',
)}
${scene('chat', '一次真实的 <code>algomotion_show</code> 调用之后的播放器，运行在项目测试所用的极简 MCP Apps 宿主中。支持 MCP Apps 的客户端会把同样的页面放进对话。在 <code>improve#3</code> 处，从 A 经 B 的路径代价为 5，小于直连边的 7。用 <code>npm run scenes</code> 生成。')}
<p>recipe 是预置好的算法。合适时助手应优先用它。助手可以直接展示一个 recipe，不必复制文档：</p>
${code(`{"recipe":"dijkstra","input":"A-B 4, B-C 1, A-C 7","frame":"improve#3"}`, 'algomotion_show 的参数')}

<h2 id="tools">七个工具</h2>
<div class="scroll" role="region" aria-label="MCP 工具" tabindex="0"><table class="params">
<thead><tr><th>工具</th><th>作用</th><th>示例参数</th></tr></thead><tbody>
<tr><td><code>algomotion_guide</code></td><td>返回所选类型的编写指南、动作和示例。</td><td><code>{"kinds":["array","graph"]}</code></td></tr>
<tr><td><code>algomotion_validate</code></td><td>检查文档的结构并重放每个动作，报告错误和警告。</td><td><code>{"document": …}</code></td></tr>
<tr><td><code>algomotion_inspect</code></td><td>返回所选帧上的结构状态和标记，附带步骤名、分节和解说。</td><td><code>{"recipe":"insertion-sort","input":"5 2 4","frames":[0,"insert",-1]}</code></td></tr>
<tr><td><code>algomotion_render</code></td><td>以固定主题返回一张独立的 SVG。</td><td><code>{"recipe":"insertion-sort","input":"5 2 4","frame":"insert","theme":"print"}</code></td></tr>
<tr><td><code>algomotion_list_recipes</code></td><td>列出 id、标题、领域、简介和输入 schema。</td><td><code>{}</code></td></tr>
<tr><td><code>algomotion_run_recipe</code></td><td>用给定输入按 id 运行算法，返回 JSON 文档。</td><td><code>{"id":"insertion-sort","input":"5 2 4"}</code></td></tr>
<tr><td><code>algomotion_show</code></td><td>在 MCP Apps 播放器中展示文档或 recipe。</td><td><code>{"recipe":"insertion-sort","input":"5 2 4"}</code></td></tr>
</tbody></table></div>
<p><code>inspect</code>、<code>render</code> 和 <code>show</code> 接受 <code>document</code>，或 <code>recipe</code> 加可选的 <code>input</code>，二者不能同时给。<code>validate</code> 只接受文档。<code>inspect</code> 接受分节和范围，最多 20 帧。<code>render</code> 和 <code>show</code> 只取一帧。请求文档时，<code>run_recipe</code> 用的键是 <code>id</code>。</p>
<p>一次完整的 <code>algomotion_validate</code> 调用这样检查自定义文档：</p>
${code(
  `{"document":{"version":"1.0","structures":{"s":{"kind":"stack","initial":[1]}},
  "steps":[{"actions":[{"target":"s","type":"push","element":2}],
    "meta":{"id":"push","narration":"Push 2 on top."}}]}}`,
  'algomotion_validate 的参数',
)}
<p>要做自定义的可视化，就让助手先读指南、写文档、校验，再查看关键帧，最后展示。例如：</p>
${code(
  `Write a document showing a stack starting at [1], then pushing 2 and popping it.
Name the steps and explain the last-in, first-out rule.
Validate the document and inspect frames 0 and -1 before showing it.`,
  '自定义文档的提示词',
)}
<p>服务器还提供一个 <code>visualize</code> 提示词，以及 <code>algomotion://guide</code>、<code>algomotion://guide/array</code> 和 <code>algomotion://schema</code> 三个资源。</p>

<h2 id="player">对话中的播放器</h2>
<p>在支持 MCP Apps 的客户端中，<code>algomotion_show</code> 在对话里打开 <code>ui://algomotion/player.html</code>，跟随客户端的浅色或深色主题。停在某一帧时，播放器把这一帧的帧号、步骤名、分节和解说告诉模型，你就可以直接问眼前这一步。不支持 MCP Apps 的客户端只收到文本结果。</p>
<p>托管服务器可以从 <code>algomotion_show</code> 和 <code>algomotion_run_recipe</code> 返回<a href="${root}guide/share-links/">分享链接</a>。recipe 链接带 id 和输入；自定义文档的链接带压缩后的文档。链接超过 16,384 个字符时，不生成链接，并在文本中说明原因。</p>

<h2 id="local">通过 stdio 在本地运行</h2>
<p>这个服务器已作为 1.0 alpha 发布到 npm。在 Claude Code 里注册它，npx 会在第一次使用时下载：</p>
${code(
  `claude mcp add algomotion -- npx -y -p @algomotion/mcp@alpha algomotion-mcp`,
  '注册本地 stdio 服务器',
)}
<p>想用自己构建的版本时，在仓库检出目录里构建，再填上服务器的路径（把绝对路径换成你检出仓库的位置）：</p>
${code(
  `npm ci
npm run build -w @algomotion/mcp
claude mcp add algomotion -- node /absolute/path/packages/mcp/dist/mcp-server.js`,
  '注册从仓库构建的服务器',
)}
<p>Claude Desktop 的本地服务器配置这样写：</p>
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
  '本地 stdio 配置',
)}
${note('<p>可选的 <code>ALGOMOTION_SHARE_URL</code> 必须指向你自己提供的分享页。不设置时，本地工具不生成链接。该地址必须是绝对 HTTP 或 HTTPS URL，不能含凭据、片段、反斜杠、空格或控制字符。</p>')}
<p>如果改用本地 HTTP 客户端，用 <code>--http</code> 启动同一个服务器。<code>--port</code> 和 <code>--host</code> 指定地址，默认 <code>127.0.0.1:8787</code>。</p>
${code(
  `node packages/mcp/dist/mcp-server.js --http --port 8787
claude mcp add --transport http algomotion http://127.0.0.1:8787/mcp`,
  '本地 HTTP 传输',
)}
`,
};
