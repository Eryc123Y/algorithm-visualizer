/** 指南首页：algomotion 做什么，以及各种用法从哪里开始。 */
import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: '',
  title: '快速上手',
  nav: '快速上手',
  summary:
    'algomotion 用你给的输入运行算法，把每一步画出来。这一页花五分钟讲清思路，并指明每种用法该看哪篇指南。',
  figures: [
    {
      key: 'insertion',
      algorithm: 'insertion-sort',
      input: '5 2 4 6 1 3',
      step: 'insert#2',
      alt: '对 5 2 4 6 1 3 做插入排序，第二次插入之后的状态。',
    },
  ],
  body: ({ root, site, figure, code, note }) => `
<h2 id="idea">基本思路</h2>
<p>你指定一个算法，再给它一份输入，写法和在纸上写的一样：列表 <code>5 2 4 6 1 3</code>，图 <code>A-B 4, B-C 1</code>，或者一串操作 <code>insert 4, delete 3</code>。algomotion 运行这个算法，记下每一步：哪里变了，执行的是代码的哪一行，再配一句话说明原因。每一步都有名字，比如 <code>insert#2</code> 表示第二次插入。</p>
${figure('insertion', '对 <code>5 2 4 6 1 3</code> 做插入排序，停在 <code>insert#2</code> 这一步。每种输出画出来都是这个样子。')}
<p>这份记录可以变成你需要的任何形式：网页上的播放器，Typst 或 LaTeX 里的图，幻灯片上的叠层，SVG 文件，或者 AI 对话里的播放器。所有输出都用同一个引擎、同一套主题绘制，看起来完全一致。</p>

<h2 id="try">不装任何东西先试试</h2>
<p><a href="${site}play/#v=1&amp;alg=insertion-sort&amp;in=5%202%204%206%201%203">分享页</a>能按链接播放任意算法。改掉 <code>in=</code> 后面的输入再刷新，或者从<a href="${root}algorithms/">算法目录</a>里任选一个：每个算法页都有播放器，以及各种输出的代码片段。</p>
<p>也可以问 AI 助手。用一条命令把 algomotion 加进 Claude Code，然后让它演示一个算法：</p>
${code('claude mcp add --transport http algomotion https://algomotion-mcp.turing2234.com/mcp', '把 algomotion 加进 Claude Code')}
<p>Claude 的各个应用和其他客户端的接法，见<a href="${root}guide/ai/">接入 AI 助手</a>。</p>

<h2 id="choose">选择输出到哪里</h2>
<div class="scroll" role="region" aria-label="各种输出" tabindex="0">
<table class="choices">
  <thead><tr><th scope="col">你想要</th><th scope="col">用什么</th><th scope="col">指南</th></tr></thead>
  <tbody>
    <tr><td>网页或课程网站上的交互式播放器</td><td><code>&lt;algo-player&gt;</code></td><td><a href="${root}guide/web/">网页</a></td></tr>
    <tr><td>笔记、论文或试卷里某一步的图</td><td>Typst 或 LaTeX 包</td><td><a href="${root}guide/typst/">Typst</a>、<a href="${root}guide/latex/">LaTeX</a></td></tr>
    <tr><td>在幻灯片上逐步演示一次运行</td><td>Beamer 叠层、polylux 或 Touying</td><td><a href="${root}guide/slides/">幻灯片</a></td></tr>
    <tr><td>SVG 或 TikZ 文件，或一份 JSON 文档</td><td><code>algomotion</code> 命令</td><td><a href="${root}guide/cli/">命令行</a></td></tr>
    <tr><td>能演示和讲解算法的 AI 助手</td><td>MCP 服务器</td><td><a href="${root}guide/ai/">AI 助手</a></td></tr>
    <tr><td>谁都能打开的链接</td><td>分享页</td><td><a href="${root}guide/share-links/">分享链接</a></td></tr>
  </tbody>
</table>
</div>

<h2 id="words">四个基本概念</h2>
<dl class="terms">
  <dt>算法</dt>
  <dd><a href="${root}algorithms/">算法目录</a>里的一个模块，用它的 id 指代：<code>dijkstra</code>、<code>insertion-sort</code>，数据结构的操作则写成 <code>bst.delete</code> 这样。</dd>
  <dt>输入</dt>
  <dd>算法运行所用的数据，用你熟悉的记法写，也可以写成 JSON。所有记法见<a href="${root}guide/inputs/">输入写法</a>。</dd>
  <dt>步骤</dt>
  <dd>一次改动，以其中发生的事命名。<code>relax#3</code> 是第三次松弛，<code>-1</code> 是最后一帧，<code>insert-5</code> 是一整个分节。所有输出选步骤的方式都一样。</dd>
  <dt>文档</dt>
  <dd>一次运行的 JSON 记录，包含数据结构和步骤。算法会替你生成文档；目录里没有的内容，你或者模型也可以手写一份。见<a href="${root}guide/documents/">文档格式</a>。</dd>
</dl>

${note(`<p>algomotion 目前是 1.0 alpha。npm 上的包都以 <code>alpha</code> 标签发布，<a href="https://github.com/Eryc123Y/algorithm-visualizer/releases/tag/v1.0.0-alpha.1">GitHub Release</a> 里有 Typst 包、LaTeX 包和独立命令。Typst Universe 和 CTAN 要等 1.0 再上，所以 Typst 和 LaTeX 两篇指南会说明如何在本地安装。1.0 之前，名称和选项仍可能调整。</p>`)}
`,
};
