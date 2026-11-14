import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'latex',
  title: '在 LaTeX 中使用',
  nav: 'LaTeX',
  summary:
    '用 TikZ 画出步骤，文字使用文档本身的字体。命令对每幅图只生成一次，并存进缓存。',
  figures: [
    {
      key: 'tree',
      algorithm: 'inorder-tree-walk',
      input: '[8,3,10,1,6]',
      step: '-1',
      theme: 'textbook',
      alt: '使用 textbook 主题，一棵树完成中序遍历后的样子。',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="install">环境要求与安装</h2>
<p>需要 LaTeX 2024-06-01 或更新版本，以及 TikZ。支持 pdfLaTeX、LuaLaTeX 和 XeLaTeX。这个包还没有发布到 CTAN，1.0 时会发布。从 <a href="https://github.com/Eryc123Y/algorithm-visualizer/releases/tag/v1.0.0-alpha.1">GitHub Release</a> 的 <code>algomotion-latex.zip</code> 或仓库的 <code>packages/latex/package/</code> 里取出 <code>algomotion.sty</code>，放到文档旁边，或者放进本地的 <code>texmf/tex/latex/algomotion/</code> 目录树。</p>
<p>这个包要调用 <code>algomotion</code> 命令。装了 Node.js 的话，从 npm 安装：<code>npm install -g @algomotion/mcp@alpha</code>。没有 Node.js 的话，用独立可执行文件：Release 里有 Apple 芯片 macOS 版，其他平台可以在仓库里用 rustup 和 C 编译器构建：</p>
${code(
  `npm ci
npm run build:standalone -w @algomotion/mcp`,
  '构建 LaTeX 所用的命令',
)}
<p>把 <code>packages/mcp/dist/standalone/algomotion</code> 加入 <code>PATH</code>，或者用 <code>command=</code> 传入它的绝对路径。<a href="${root}guide/cli/">Node.js 版命令</a>也可以用，写成 <code>command={node /absolute/path/packages/mcp/dist/algomotion.js}</code>。</p>

<h2 id="figure">画一幅图</h2>
${code(
  String.raw`\documentclass{article}
\usepackage{algomotion}
\begin{document}
\algomotionset{theme=textbook}
\algomotion[step=-1]{inorder-tree-walk}{[8,3,10,1,6]}
\end{document}`,
  '一份完整的 LaTeX 文档',
)}
${code(`latexmk -pdf -shell-escape notes.tex`, '第一次编译')}
${figure('tree', '引擎画出的同一棵树、同一个主题。在 LaTeX 中，图里的文字用文档的字体排版。')}
<p><code>\\algomotion[keys]{id}{input}</code> 运行一个算法。<code>\\algomotionset{keys}</code> 为当前分组内后面的图设定默认值。不指定步骤时，图显示最后一帧。</p>

<h2 id="keys">键</h2>
<div class="scroll" role="region" aria-label="LaTeX 键" tabindex="0"><table class="params">
<thead><tr><th>键</th><th>默认值</th><th>用途</th></tr></thead><tbody>
<tr><td><code>step</code></td><td><code>-1</code></td><td>一帧的编号或命名选择器。</td></tr>
<tr><td><code>steps</code></td><td>无</td><td>供 Beamer 使用的图组。不给值表示所有帧；多个选择器用逗号分隔，外面加花括号。</td></tr>
<tr><td><code>start</code></td><td><code>+</code></td><td>图组的第一个叠层：递增计数，或一个明确的编号。</td></tr>
<tr><td><code>theme</code></td><td><code>light</code></td><td>一个内置的固定主题。</td></tr>
<tr><td><code>layout</code></td><td><code>auto</code></td><td>笔记中为 <code>narrow</code>，Beamer 中为 <code>wide</code>；两者都可以显式指定。</td></tr>
<tr><td><code>width</code>、<code>height</code></td><td>自然尺寸；Beamer 中填满</td><td>在给定尺寸内缩放，保持比例。</td></tr>
<tr><td><code>scale</code></td><td>无</td><td>相对自然尺寸的缩放因子；不给值时恢复默认尺寸。</td></tr>
<tr><td><code>value font</code></td><td>主题的字体族</td><td>单元格的值、节点、下标、边标签和指针所用的字体。</td></tr>
<tr><td><code>label font</code></td><td>主题的字体族</td><td>标题和标签所用的字体。</td></tr>
<tr><td><code>algorithm</code></td><td>无</td><td>与 <code>\\algomotionfile</code> 配合，把文件当作算法输入读取。</td></tr>
<tr><td><code>command</code></td><td><code>algomotion</code></td><td>包选项：可执行文件，可带路径或参数。</td></tr>
<tr><td><code>cachedir</code></td><td><code>_algomotion</code></td><td>包选项：存放可复用图的目录。</td></tr>
</tbody></table></div>
${code(
  String.raw`\usepackage[command=algomotion,cachedir=_algomotion]{algomotion}
% In the document:
\algomotion[layout=wide,width=0.8\linewidth,height=6cm,
  value font=\small\ttfamily,label font=\small\sffamily]
  {dijkstra}{A-B 4, B-C 1, A-C 7}
\algomotion[scale=0.7]{insertion-sort}{5 2 4}`,
  '尺寸与字体相关的键',
)}
<p>自然尺寸下，值的字号是周围正文的 1.25 倍，标签是正文的四分之三。图的宽度不超过行宽，除非显式给出的尺寸另有规定。主题有 <code>light</code>、<code>dark</code>、<code>print</code>、<code>textbook</code>、<code>textbook-dark</code>、<code>blocks</code>、<code>blocks-dark</code>、<code>answer-sheet</code> 和 <code>turbo-c</code>。</p>

<h2 id="files">文档、输入文件和导出的图</h2>
<p><code>\\algomotionfile{run.json}</code> 画出一份文档。加上 <code>algorithm=dijkstra</code>，则改为读取算法输入。生成下面这些示例文件，并导出一个 TikZ 文件：</p>
${code(
  `algomotion run dijkstra 'A-B 4, B-C 1, A-C 7' --out run.json
printf '%s\n' '{"graph":"A-B 4, B-C 1, A-C 7"}' > graph.json
algomotion export run.json --step -1 --format tikz --out figures --name shortest`,
  '准备文件',
)}
${code(
  String.raw`\algomotionfile[step=improve#3]{run.json}
\algomotionfile[algorithm=dijkstra,theme=print]{graph.json}
\algomotioninput[width=\linewidth]{figures/shortest.tex}`,
  '在 LaTeX 中引入文件',
)}
<p><code>\\algomotioninput</code> 直接读取导出结果，不需要 shell escape。它也能读取用 <code>--one-file</code> 导出的图组；见<a href="${root}guide/slides/">幻灯片</a>。</p>

<h2 id="steps">步骤与输入</h2>
<p>第 <code>0</code> 帧是初始状态，<code>-1</code> 是最后一帧。<code>improve#3</code> 指第三次改进，<code>delete-3/replacement</code> 指某个分节里的一步。分节或范围对应多帧，所以要用 <code>steps</code>。<code>step</code> 和 <code>steps</code> 以最后给出的那个为准。</p>
<p>在宏定义里，或者在没有 <code>[fragile]</code> 的 Beamer 帧里，选择器中的井号要写成 <code>\\#</code>；这种写法在别处也能用。输入接受<a href="${root}guide/inputs/">记法或 JSON</a>。对象最外层的花括号可以省略。输入为空时运行第一个示例。</p>
${code(
  String.raw`\algomotion[step=improve\#3]{dijkstra}{A-B 4, B-C 1, A-C 7}
\algomotion{topological-sort}{shirt->tie, tie->jacket, socks}
\algomotion{inorder-tree-walk}{[4, 2, 6, null, 7]}
\algomotion{kruskal}{}`,
  '选择器与输入记法',
)}
<p>TeX 会把换行变成空格，所以图的边要用逗号分隔。字面的 <code>%</code>、<code>#</code>、<code>{</code>、<code>}</code>、<code>&amp;</code>、<code>$</code> 和 <code>_</code> 要用反斜杠转义。JSON 的转义可以用，但 TeX 会吞掉字母转义（如 <code>\\n</code>）后面的空格；那个空格请写成 <code>\\u0020</code>。在 Windows 上，超过约 3,500 个字符的内联输入会被拒绝，请改用输入文件。</p>

<h2 id="cache">shell escape 与缓存</h2>
<p>第一次编译要加 <code>-shell-escape</code> 来运行命令。TeX 默认的受限 shell escape 不允许运行它。生成的每幅图都存进 <code>_algomotion/</code>，以输入或文件内容、算法、选择器、主题、布局、格式和包版本作为键。字体和尺寸在绘制时才生效，改动它们不需要重新导出。</p>
<p>如果要上传 arXiv 或与他人合作，请把缓存提交进版本库。所有用到的图都已缓存后，不开 shell escape、不装这个命令也能编译。在包发布到 CTAN 之前，也请把包和项目放在一起。包不会删除任何东西；更新命令后请自行清空缓存。旧的、不兼容的 TikZ 格式会报错，需要重新导出。</p>

<h2 id="errors">错误与 TeX 引擎</h2>
<p>输入、文档、选择器或主题无效时，会产生一个 LaTeX 错误，并画出一个带边框、写有完整诊断信息的框。缺少 shell escape、shell escape 受限和找不到可执行文件，各有不同的提示。如果命令没有生成图，请查看 <code>algomotion --help</code>。</p>
${code(String.raw`\algomotion{insertion-sort}{5 x 4} % Reports INVALID_NOTATION.`, '一个错误框')}
<p>pdfLaTeX、LuaLaTeX 和 XeLaTeX 画出的图形完全相同。无穷大、箭头等符号用数学模式排版；其他非 ASCII 文字需要文档有合适的字体，用 pdfLaTeX 时尤其如此。<code>latex</code> 配合 <code>dvips</code> 也能用，但 PostScript 不支持透明，阴影会变成实色。</p>
${note('<p>shell escape 允许文档运行程序。编译别人给的文档时要小心。这个包会检查算法 id、选择器和主题，以十六进制传递内联输入，并检查带引号的文件名。共享缓存后，合作者可以关掉 shell escape 编译。</p>')}
`,
};
