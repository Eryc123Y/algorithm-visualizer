import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'slides',
  title: '幻灯片',
  nav: '幻灯片',
  summary:
    '把选中的帧变成同一张幻灯片的叠层，每一帧都用同一块画布、同一个比例。',
  figures: [
    {
      key: 'before',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: '0',
      alt: '初始的一行：5、2、4。',
    },
    {
      key: 'insert',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: 'insert',
      alt: '第一次插入后得到 2、5、4。',
    },
    {
      key: 'after',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: '-1',
      alt: '排好序的一行：2、4、5。',
    },
  ],
  body: ({ root, code, figure, note, scene }) => `
<h2 id="frames">选择观众看到的帧</h2>
<p>讲一个概念时，挑几个命名步骤就够了；讲一道完整的例题时，可以用上每一帧。一组帧共用一块画布，翻页时结构不会跳动。</p>
<div class="overlays" role="group" aria-label="插入排序的三个步骤">
${figure('before', '初始状态，<code>0</code>。')}
${figure('insert', '第一次 <code>insert</code>。')}
${figure('after', '最后一帧，<code>-1</code>。')}
</div>

<h2 id="beamer">Beamer 叠层</h2>
<p>先安装 <a href="${root}guide/latex/">LaTeX 宏包和命令</a>。不带值的 <code>steps</code> 选中所有帧；范围、分节或花括号列表只选其中一部分。<code>start</code> 指定第一个叠层。</p>
${scene('beamer', '一个 Beamer 帧在 <code>steps=extract\\#2..improve\\#3</code> 下的三个叠层，由 <code>latexmk</code> 编译而成。用 <code>npm run scenes</code> 从 <code>apps/site/scenes/slides.tex</code> 生成。')}
${code(
  String.raw`\documentclass{beamer}
\usepackage{algomotion}
\begin{document}
\begin{frame}{Insert into a sorted prefix}
  \centering
  \algomotion[steps={0,insert,-1},start=1,height=0.6\textheight]
    {insertion-sort}{5 2 4}
\end{frame}
\begin{frame}{Every step}
  \algomotion[steps]{insertion-sort}{5 2 4}
\end{frame}
\end{document}`,
  '完整的 Beamer 演示文稿',
)}
${code(`latexmk -pdf -shell-escape slides.tex`, '编译 Beamer 演示文稿')}
<p>每个选中的帧占一个叠层，最后一帧一直保留到这张幻灯片结束。默认的 <code>start=+</code> 让这组帧接着 Beamer 的递增计数开始，排在前面的 <code>\\pause</code> 或 <code>\\item&lt;+-&gt;</code> 之后。显式写 <code>start=3</code> 则从第 3 个叠层开始。两组都写 <code>start=1</code> 的帧会同步推进。</p>
${code(
  String.raw`\begin{frame}{A deletion}
  Find the node first. \pause
  \algomotion[steps=delete-3,height=0.6\textheight]
    {bst.delete}{"from":"8 3 10 1 6", "key":3}
  \onslide<+->{The search order is preserved.}
\end{frame}
\begin{frame}{The second insertion}
  \algomotion[steps=insert\#2..-1,start=2]
    {insertion-sort}{5 2 4}
\end{frame}`,
  '分节、范围和暂停',
)}
<p>一组帧之后的新内容用 <code>\\onslide&lt;+-&gt;</code>；用 <code>\\pause</code> 会把最后一帧重复一遍。在非 fragile 的 Beamer 帧里，<code>#</code> 要转义成 <code>\\#</code>。</p>
<p>Beamer 里的图占满行宽，高度最多占正文高度的四分之三。<code>height=0.6\\textheight</code> 能给文字留出空间。<code>width</code> 改变宽度上限，<code>scale=1</code> 用原始尺寸。放在分栏里时，图占满所在的那一栏。Beamer 下默认 <code>layout=wide</code>。</p>
<p>用 <code>\\documentclass[handout]{beamer}</code>、在透明胶片模式或 <code>beamerarticle</code> 笔记里，一组帧只显示最后一帧。在 Beamer 之外也显示最后一帧，并给出警告。只含一帧的一组，在每个叠层上都是一张普通的图。</p>

<h2 id="export">编译前导出叠层</h2>
<p>不想开 shell escape 编译，就先把一组 TikZ 帧导出一次，再引入文档。<a href="${root}guide/cli/#export">导出命令</a>同样能选分节和范围。</p>
${code(`algomotion export insertion-sort --input '5 2 4' --step 0,insert,-1 --format tikz --one-file --out figures --name insertion`, '导出一组叠层')}
${code(
  String.raw`\begin{frame}{Insertion sort}
  \algomotioninput[start=1]{figures/insertion.tex}
\end{frame}`,
  '读入导出的一组帧',
)}

<h2 id="typst">Typst 与 Touying</h2>
<p>先安装<a href="${root}guide/typst/">本地 Typst 包</a>。把幻灯片框架自己的 <code>only</code> 函数传给 <code>algomotion-slides</code>，包本身不导入任何幻灯片框架。</p>
${code(
  `#import "@preview/touying:0.8.0": *
#import themes.simple: *
#import "@local/algomotion:0.1.0": algomotion-slides
#show: simple-theme.with(aspect-ratio: "16-9")

== Insertion sort
#align(center, algomotion-slides(only, "insertion-sort", "5 2 4",
  steps: (0, "insert", -1), height: 60%,
))`,
  'Touying 叠层',
)}
<p><code>steps: auto</code> 选中所有帧，也可以写范围（如 <code>"insert#2..-1"</code>）或分节（如 <code>"delete-3"</code>）。<code>start: 1</code> 是默认值。在 Touying 的 <code>#pause</code> 之后要显式写 <code>start: 2</code>：框架的 <code>only</code> 不跟随暂停计数。Touying 的讲义模式保留最后一张子幻灯片，所以这组帧显示最后一帧。</p>

<p>制作 Touying 讲义时，把上面的主题设置换成：</p>
${code(`#show: simple-theme.with(aspect-ratio: "16-9", config-common(handout: true))`, 'Touying 讲义设置')}

<h2 id="polylux">Typst 与 polylux</h2>
${code(
  `#import "@preview/polylux:0.4.0": *
#import "@local/algomotion:0.1.0": algomotion-slides
#set page(paper: "presentation-16-9", margin: 1.5cm)
#set text(size: 20pt)

#slide[
  == Insertion sort
  #align(center, algomotion-slides(only, "insertion-sort", "5 2 4",
    steps: "insert#2..-1", start: 2, height: 60%,
  ))
]`,
  'polylux 叠层',
)}
<p>两个框架支持同样的选项：<code>steps</code>、<code>start</code>、<code>theme</code>、<code>layout</code>、<code>strict</code>、<code>width</code>、<code>height</code> 和 <code>fit</code>。默认布局是 wide。这组帧在保持比例的前提下，占满所在区域的宽度和四分之三的高度。<code>width</code> 和 <code>height</code> 只覆盖各自那一边。把两组帧放进 <code>grid</code>，每组就有各自的区域。</p>
${note('<p>单个步骤也能占满一张幻灯片：用 <code>algomotion-slides</code> 并写 <code>steps: "insert"</code>。普通的 <code>algomotion</code> 图保持原始尺寸。上课前预览实际的演示文稿和讲义；要打印就选适合打印的主题。</p>')}
`,
};
