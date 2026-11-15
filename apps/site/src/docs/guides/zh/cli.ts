import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'cli',
  title: '命令行',
  nav: '命令行',
  summary: '运行算法、检查文档，并把选中的帧导出为 SVG 或 TikZ 文件。',
  figures: [
    {
      key: 'export',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      theme: 'print',
      alt: '导出的一帧 Dijkstra 算法：C 经由 B 得到改进，灰度显示。',
    },
  ],
  body: ({ root, code, figure, note, scene }) => `
<h2 id="install">安装</h2>
<p>这个命令已作为 1.0 alpha 发布到 npm，在 <code>@algomotion/mcp</code> 包里。可以不安装直接运行，也可以全局安装：</p>
${code(
  `npx -p @algomotion/mcp@alpha algomotion --help
npm install -g @algomotion/mcp@alpha`,
  '运行或安装命令',
)}
<p>也可以从仓库检出目录构建：安装工作区依赖，再构建 MCP 包：</p>
${code(
  `npm ci
npm run build -w @algomotion/mcp
node packages/mcp/dist/algomotion.js --help`,
  '构建 Node.js 命令',
)}
<p>下文的 <code>algomotion</code> 代表 <code>node /absolute/path/packages/mcp/dist/algomotion.js</code>。也可以不构建，直接从仓库运行：</p>
${code(`node --conditions=@algomotion/source packages/mcp/src/algomotion.ts recipes`, '从源码运行')}
<p>想要不依赖 Node.js 的命令，就构建独立可执行文件。构建需要 rustup 和 C 编译器，默认面向当前机器；<code>-- --target &lt;triple&gt;</code> 可以选工具链支持的其他目标。</p>
${code(
  `npm run build:standalone -w @algomotion/mcp
packages/mcp/dist/standalone/algomotion --help`,
  '构建独立可执行文件',
)}
<p>把这个可执行文件放进 <code>PATH</code>。本页所有命令它都支持；MCP 服务器本身仍需要 JavaScript 运行时。</p>

<h2 id="run">查找和运行算法</h2>
<p><code>recipes</code> 列出所有 id，以及各自的标题、领域、简介和输入的 JSON Schema。<code>run</code> 把文档写到标准输出，或用 <code>--out</code>（<code>-o</code>）写到文件。不给输入时运行第一个示例。输入参数是文本，不是文件路径。</p>
${code(
  `algomotion recipes
algomotion run insertion-sort '5 2 4' --out sort.json
algomotion run dijkstra 'A-B 4, B-C 1, A-C 7' --out graph-run.json
algomotion run bst.delete '"from":"8 3 10 1 6", "key":3'
algomotion run kruskal`,
  '列出并运行算法',
)}
<p>记法和 JSON 形式见<a href="${root}guide/inputs/">输入写法</a>。</p>

<h2 id="guide">阅读编写指南</h2>
<p><code>guide</code> 打印文档指南和所有结构类型。传入类型名则只打印这几部分。AI 助手拿到的也是这份指南。</p>
${code(
  `algomotion guide
algomotion guide array graph table`,
  '阅读协议指南',
)}

<h2 id="validate">校验与查看</h2>
<p><code>validate</code> 先检查结构，再重放每个动作。<code>inspect</code> 报告指定帧上的结构状态、标记、解说、步骤名和分节；不给选择器时报告最后一帧。每次最多 20 帧。文件名写 <code>-</code> 时从标准输入读取文档。</p>
${code(
  `algomotion validate sort.json
algomotion inspect sort.json 0 insert -1
cat sort.json | algomotion validate -`,
  '检查一次运行',
)}
<p>选择器可以是数字（负数从末尾倒数）、步骤名、带序号的出现（如 <code>improve#3</code>）、限定分节的步骤、整个分节或一个范围。只写步骤名时选中它第一次出现的位置。选出的帧按时间线顺序排列，不重复。</p>

<h2 id="render">绘制一帧</h2>
<p><code>render</code> 读入文档文件，返回一张独立的 SVG，文字仍保留为文字。<code>--frame</code> 默认 <code>-1</code>，<code>--theme</code> 默认 <code>light</code>，<code>--layout</code> 默认 <code>wide</code>。不给 <code>--out</code> 时 SVG 写到标准输出。在这里，包含多帧的分节或范围会报错。</p>
${code(`algomotion render graph-run.json --frame improve#3 --theme print --layout narrow --out distance.svg`, '绘制一帧')}

<h2 id="export">导出图</h2>
<p><code>export</code> 写出共用一块画布的独立图。SVG 里的文字转成内置字体的轮廓，解说成为图像描述。可以从文档导出，也可以先用 <code>--input</code> 运行一个算法。</p>
${code(
  `algomotion export graph-run.json --step improve#3,-1 --theme print --out figures
algomotion export dijkstra --input 'A-B 4, B-C 1, A-C 7' --step improve#3 --theme print --out figures --name distance
algomotion export sort.json --step 0 --step insert..-1 --layout narrow --out figures --name '{name}-{step}'`,
  '导出选中的 SVG 帧',
)}
${figure('export', 'Dijkstra 算法在 <code>improve#3</code> 处的导出图，<code>print</code> 主题。')}
${scene('terminal', '命令的一次实际会话：一次导出、一次运行、一次查看，以及一个写错的输入。输出就是命令当时打印的内容。用 <code>npm run scenes</code> 生成。')}
<div class="scroll" role="region" aria-label="导出选项" tabindex="0"><table class="params">
<thead><tr><th>选项</th><th>默认值</th><th>用途</th></tr></thead><tbody>
<tr><td><code>--input</code></td><td>无</td><td>用这段文本或输入文件运行指定的源 id；<code>-</code> 读标准输入。以 <code>.json</code> 结尾的名字总是当作文件。</td></tr>
<tr><td><code>--input-hex</code></td><td>无</td><td>供程序使用的十六进制 UTF-8 输入，代替 <code>--input</code>。</td></tr>
<tr><td><code>--step</code></td><td>所有帧</td><td>选择器；可以重复这个选项，也可以用逗号分隔多个选择器。</td></tr>
<tr><td><code>--theme</code></td><td><code>light</code></td><td>任一内置的固定主题，见<a href="${root}themes/">主题</a>。</td></tr>
<tr><td><code>--layout</code></td><td><code>wide</code></td><td><code>wide</code> 或 <code>narrow</code>。</td></tr>
<tr><td><code>--format</code></td><td><code>svg</code></td><td><code>svg</code> 或 <code>tikz</code>。</td></tr>
<tr><td><code>--one-file</code></td><td>关闭</td><td>仅限 TikZ：把各帧合并成一个用于幻灯片的图组。</td></tr>
<tr><td><code>--out</code>, <code>-o</code></td><td>当前目录</td><td>输出目录，不存在时自动创建。</td></tr>
<tr><td><code>--name</code></td><td><code>{name}-{frame}</code></td><td>文件名主干的模式；单文件导出用 <code>{name}</code>。</td></tr>
<tr><td><code>--error-file</code></td><td>无</td><td>失败时另把错误信息写到这里；成功后删除该文件。</td></tr>
</tbody></table></div>
<p>名字模式支持 <code>{name}</code>（文档文件名主干或算法 id）、<code>{frame}</code>（补零的帧号）和 <code>{step}</code>（选择器，其中的斜杠和井号换成下划线）。对应的扩展名可写可不写。用 <code>--one-file</code> 时不要用 <code>{frame}</code> 或 <code>{step}</code>。已有的输出文件会被替换；每个写出的文件都会连同选择器一起列出。所有选中的图都绘制成功之后才开始写文件。</p>
${code(
  `algomotion export sort.json --step 0,insert,-1 --format tikz --one-file --out figures --name insertion
algomotion export insertion-sort --input-hex 3520322034 --step -1 --out figures --name sorted --error-file export-error.txt`,
  'TikZ 和程序化输入',
)}
<p>上面的十六进制输入就是 <code>5 2 4</code>。用 <code>\\algomotioninput{figures/insertion.tex}</code> 引入导出的 TikZ 图组，见<a href="${root}guide/slides/">幻灯片</a>。要用输入文件，把 <code>[5,2,4]</code> 存为 <code>values.json</code>，然后运行：</p>
${code(`algomotion export insertion-sort --input values.json --step -1 --out figures`, '读取输入文件')}

<h2 id="errors">失败与帮助</h2>
<p><code>--help</code> 或 <code>-h</code> 打印用法。退出码 <code>0</code> 表示成功；<code>1</code> 表示输入、文档、选择器或写文件失败；<code>2</code> 表示用法错误，例如未知选项、无效的名字模式，或对 SVG 用了 <code>--one-file</code>。</p>
${note('<p><code>render --out</code> 指定的是文件，<code>export --out</code> 指定的是目录。文档不是算法输入：只有导出源是算法 id 时才用 <code>--input</code>。</p>')}
`,
};
