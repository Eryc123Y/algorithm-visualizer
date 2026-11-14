import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'typst',
  title: '在 Typst 中使用',
  nav: 'Typst',
  summary:
    '在 Typst 里把某一步画成矢量图。包里自带引擎，编译时不需要任何外部命令。',
  figures: [
    {
      key: 'insert',
      algorithm: 'insertion-sort',
      input: '5 2 4 6 1 3',
      step: 'insert#2',
      alt: '第二次插入把 4 放到 2 和 5 之间。',
    },
    {
      key: 'print',
      algorithm: 'inorder-tree-walk',
      input: '[8,3,10,1,6]',
      step: '-1',
      theme: 'print',
      alt: '一棵二叉树完成中序遍历后的样子，使用 print 主题。',
    },
  ],
  body: ({ root, code, figure, note, scene }) => `
<h2 id="install">从仓库安装</h2>
<p>这个包还没有发布到 Typst Universe。先安装 Typst 0.15 或更高版本，再从仓库构建引擎。仓库里已提交编译好的 WebAssembly 插件，正常使用不需要构建 Rust。</p>
${code(
  `npm ci
npm run build -w @algomotion/typst`,
  '构建 Typst 引擎',
)}
<p>把 <code>packages/typst/package/</code> 链接或复制到本地 Typst 包目录下的 <code>algomotion/0.1.0</code>。要保留整个文件夹，包括 <code>engine.bc</code>、<code>plugin.wasm</code> 和 <code>lib.typ</code>。在 macOS 上，从仓库根目录执行：</p>
${code(
  `mkdir -p "$HOME/Library/Application Support/typst/packages/local/algomotion"
ln -s "$PWD/packages/typst/package" "$HOME/Library/Application Support/typst/packages/local/algomotion/0.1.0"`,
  '在 macOS 上安装本地包',
)}
<p>Linux 上的本地目录是 <code>~/.local/share/typst/packages/local</code>；Windows 上是 <code>%APPDATA%\\typst\\packages\\local</code>。正式发布之前，导入时写 <code>@local/algomotion:0.1.0</code>。</p>

<h2 id="one">画一步</h2>
${code(
  `#import "@local/algomotion:0.1.0": algomotion

#figure(
  algomotion("insertion-sort", "5 2 4 6 1 3", step: "insert#2", width: 100%),
  caption: [The second insertion puts 4 between 2 and 5.],
)`,
  '讲义中的一幅图',
)}
${figure('insert', '<code>algomotion</code> 在 <code>insert#2</code> 画出的图。')}
${scene('notes', 'Typst 编译出的一整页：这幅图和讲义里的其他图一样带着图注；版面只有一栏，队列排到了图的下方。由 <code>npm run scenes</code> 从 <code>apps/site/scenes/notes.typ</code> 生成。')}
<p><code>algomotion(source, input, ...)</code> 返回一张图片，可以放进 <code>figure</code>、<code>grid</code> 或 <code>box</code>。第一个参数是算法 id，后面跟它的输入；也可以只传一份文档。不给输入的算法运行它的第一个示例。<a href="${root}guide/inputs/">输入记法</a>可以直接写成字符串；结构化输入用 Typst 的数组和字典。</p>
<div class="scroll" role="region" aria-label="Typst 选项" tabindex="0"><table class="params">
<thead><tr><th>选项</th><th>默认值</th><th>用途</th></tr></thead><tbody>
<tr><td><code>step</code></td><td><code>-1</code></td><td>一帧：编号、步骤名，或带分节限定的步骤。</td></tr>
<tr><td><code>theme</code></td><td><code>"light"</code></td><td>一个固定的内置主题。</td></tr>
<tr><td><code>layout</code></td><td><code>auto</code></td><td>讲义中默认 <code>"narrow"</code>；<code>"wide"</code> 把辅助结构放在主结构旁边。</td></tr>
<tr><td><code>strict</code></td><td><code>false</code></td><td>遇到诊断信息时中止编译，而不是画一个错误框。</td></tr>
<tr><td><code>width</code>、<code>height</code></td><td><code>auto</code></td><td>传给 <code>image</code>。自然尺寸是每像素 0.75 pt。</td></tr>
<tr><td><code>fit</code></td><td><code>"contain"</code></td><td>图片的适配方式：<code>"contain"</code>、<code>"cover"</code> 或 <code>"stretch"</code>。</td></tr>
<tr><td><code>alt</code></td><td>解说</td><td>单张图片的替代文本。</td></tr>
</tbody></table></div>
<p>第 <code>0</code> 帧是初始状态，<code>-1</code> 是最后一帧。步骤名从 1 开始计数。分节或范围对应多帧，要用在图组里。选择器拼错时，报错信息会列出这次运行的步骤名和分节。</p>

<h2 id="series">画多步</h2>
<p><code>algomotion-series</code> 返回一个图片数组。<code>steps: auto</code> 选中所有帧；写一个选择器或一个数组，则选中特定的帧。结果按时间轴顺序排列，不会重复。同一份文档的所有帧共用一块画布，所以宽度相同时比例也一致。</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion-series

#grid(columns: 3, gutter: 8pt,
  ..algomotion-series("insertion-sort", "5 2 4 6 1 3",
    steps: (0, "insert#2", -1), width: 100%),
)`,
  '一排三步',
)}
<p>图组同样接受上面的 <code>theme</code>、<code>layout</code>、<code>strict</code>、<code>width</code>、<code>height</code> 和 <code>fit</code>。每张图片用各自的解说作替代文本。做幻灯片请用 <a href="${root}guide/slides/#typst"><code>algomotion-slides</code></a>，它会填满幻灯片上可用的区域。</p>

<h2 id="documents">读取文档</h2>
<p>先用 <code>algomotion run insertion-sort '5 2 4' --out sort.json</code> 生成 <code>sort.json</code>，再把解析后的文档单独传进去：</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion
#let run = json("sort.json")
#algomotion(run, step: -1, width: 80%)`,
  '在 Typst 中读取 JSON',
)}
<p>带 <code>version</code>、<code>structures</code> 和 <code>steps</code> 的 Typst 字典也可以。格式见<a href="${root}guide/documents/">文档格式</a>。</p>

<h2 id="themes">主题</h2>
<p>可用 <code>"light"</code>、<code>"dark"</code>、<code>"print"</code>、<code>"textbook"</code>、<code>"textbook-dark"</code>、<code>"blocks"</code>、<code>"blocks-dark"</code>、<code>"answer-sheet"</code> 或 <code>"turbo-c"</code>。Typst 只接受固定主题，不接受播放器的 <code>auto</code> 或日夜主题对。</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion
#let algomotion = algomotion.with(theme: "print")
#algomotion("inorder-tree-walk", (8, 3, 10, 1, 6))`,
  '为后面的图设定主题',
)}
${figure('print', '<code>print</code> 主题下的中序树遍历。文字画成主题自带字体的轮廓。')}

<h2 id="errors">文档中的错误</h2>
<p>算法未知，或者输入、文档、选择器、主题无效时，会画出一个写有诊断信息的框，文档的其余部分照常编译。要中止编译，就用 <code>strict: true</code>。参数类型错误和未知的参数名总会中止编译。</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion
#algomotion("insertion-sort", "5 x 4") // Shows INVALID_NOTATION.
// Inspect all error metadata after compiling:
// typst eval --in notes.typ 'query(<algomotion-error>).map(m => m.value)'`,
  '找出出错的图',
)}

<h2 id="figures">直接使用引擎的结果</h2>
<p><code>algomotion-figures</code> 返回一个字典，供自定义排版使用。它接受 <code>steps</code>、<code>theme</code> 和 <code>layout</code>。读取图之前先检查 <code>ok</code>。</p>
${code(
  `#import "@local/algomotion:0.1.0": algomotion-figures
#let run = algomotion-figures("insertion-sort", "5 2 4", steps: (0, -1))
#if run.ok {
  grid(columns: 2, ..run.figures.map(f => figure(
    image(bytes(f.svg), format: "svg", width: 100%),
    caption: raw(f.selector),
  )))
} else {
  raw(repr(run.diagnostics))
}`,
  '用引擎的结果自定义图注',
)}
<p>成功的结果有 <code>ok: true</code>、<code>frames</code> 和 <code>figures</code>。每幅图有 <code>frame</code>、<code>selector</code>、<code>width</code>、<code>height</code>、可选的 <code>narration</code> 和 <code>svg</code>。失败的结果有 <code>ok: false</code> 和诊断信息，每条包含错误码、路径、说明和可选的提示。</p>

<h2 id="speed">速度与局限</h2>
<p>大部分时间花在加载引擎和排布第一幅图上。同一份文档的后续图会复用准备好的运行结果；没有变化的图由 Typst 缓存。README 中在 Apple M4 上的测量结果是：加载约 0.5 秒，一次树操作约 0.2 秒，1,024 步冒泡排序的第一幅图约 11.6 秒。这些是参考测量值，不是时间上限。</p>
${note(`<p>运行过程很长时，先在 Typst 外<a href="${root}guide/cli/#export">导出 SVG 文件</a>，再用 <code>image</code> 引入。拉丁字母、希腊字母和常用符号用自带的轮廓；其他文字使用文档的字体。彩色 emoji 可能显示为缺字。嵌套过深可能触及引擎的递归上限，画出错误框。</p>`)}
${code(`algomotion export insertion-sort --input '5 2 4' --step -1 --out figures --name sorted`, '在 Typst 外导出一幅图')}
${code(`#image("figures/sorted.svg", width: 80%)`, '引入导出的 SVG')}
`,
};
