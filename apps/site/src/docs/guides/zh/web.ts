import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'web',
  title: '在网页中使用',
  nav: '网页',
  summary:
    '播放器只需加载一次，之后页面上每个运行过程或文档各放一个 algo-player 元素。',
  figures: [
    {
      key: 'distance',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      alt: '一张带权图，以及 Dijkstra 算法维护的优先队列。',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="bundle">构建并加载脚本包</h2>
<p>这些包还没有发布到 npm。在仓库的检出目录里安装工作区依赖，然后构建这个元素：</p>
${code(
  `npm ci
npm run build -w @algomotion/elements`,
  '构建浏览器脚本包',
)}
<p>把 <code>packages/elements/dist/cdn/</code> 复制到你的网站。<code>algomotion-player.js</code> 和 <code>algomotion-recipes.js</code> 要放在一起，名字不要改，旁边放上 <code>fonts/</code> 文件夹。第二个脚本只在播放器运行算法时才加载。请通过 HTTP 提供这些文件，不要直接从磁盘打开 HTML。</p>
${code(
  `<script type="module" src="/assets/algomotion-player.js"></script>
<algo-player algorithm="dijkstra" input="A-B 4, B-C 1, A-C 7"
  frame="improve#3" theme="auto"></algo-player>`,
  '嵌入一个算法',
)}
${figure('distance', '上面这次运行停在 <code>improve#3</code>。交互式播放器还会加上控件、解说和代码。')}
<p><code>input</code> 属性接受<a href="${root}guide/inputs/">记法或 JSON</a>。不写它就运行第一个示例。设置了 <code>algorithm</code> 时，也可以改由 <code>src</code> 或内嵌 JSON 提供输入。</p>

<h2 id="documents">加载文档</h2>
<p>没有 <code>algorithm</code> 时，<code>src</code> 指向一份<a href="${root}guide/documents/">文档</a>。这个文件可以用 <code>algomotion run insertion-sort '5 2 4' --out sort.json</code> 生成；也可以把完整的文档直接写在元素里面：</p>
${code(
  `<algo-player src="sort.json"></algo-player>
<algo-player>
  <script type="application/json">
    {"version":"1.0","structures":{"a":{"kind":"array","initial":[5,2,4]}},
     "steps":[{"actions":[{"target":"a","type":"swap","i":0,"j":1}],
               "meta":{"id":"swap","narration":"2 belongs before 5."}}]}
  </script>
</algo-player>`,
  '文件文档与内嵌文档',
)}
<p><code>visualization</code> 属性接收一个文档对象，优先于其他所有来源。除此之外，有 <code>algorithm</code> 时，优先级依次是 <code>input</code>、<code>src</code>、内嵌 JSON、第一个示例；没有 <code>algorithm</code> 时，<code>src</code> 优先于内嵌 JSON。</p>

<h2 id="attributes">属性</h2>
<div class="scroll" role="region" aria-label="播放器属性" tabindex="0"><table class="params">
<thead><tr><th>属性</th><th>默认值</th><th>用途</th></tr></thead><tbody>
<tr><td><code>algorithm</code></td><td>无</td><td>注册表 id，如 <code>insertion-sort</code> 或 <code>bst.delete</code>。</td></tr>
<tr><td><code>input</code></td><td>第一个示例</td><td>文本形式的算法输入；对应的 JS 属性还接受对象和数组。</td></tr>
<tr><td><code>src</code></td><td>无</td><td>JSON 的 URL：一份文档；设置了算法时则是输入。</td></tr>
<tr><td><code>frame</code></td><td><code>0</code></td><td>起始帧的编号或选择器。</td></tr>
<tr><td><code>theme</code></td><td><code>auto</code></td><td>一个固定主题、<code>auto</code>，或两个主题名。</td></tr>
<tr><td><code>layout</code></td><td><code>wide</code></td><td><code>narrow</code> 把辅助结构放到主结构下方。</td></tr>
<tr><td><code>speed</code></td><td><code>900</code></td><td>每一步的毫秒数。</td></tr>
<tr><td><code>autoplay</code></td><td>不设置</td><td>加载后开始交互式播放。</td></tr>
<tr><td><code>loop</code></td><td>不设置</td><td>循环交互式播放。</td></tr>
<tr><td><code>hide-controls</code></td><td>不设置</td><td>隐藏播放控件。</td></tr>
<tr><td><code>hide-code</code></td><td>不设置</td><td>隐藏源代码。</td></tr>
<tr><td><code>language</code></td><td>有伪代码时为伪代码</td><td>首选的源代码语言，如 <code>python</code>。</td></tr>
<tr><td><code>mode</code></td><td><code>interactive</code></td><td><code>display</code> 只显示动画。</td></tr>
<tr><td><code>once</code></td><td>不设置</td><td>在展示模式下只播放一遍，不循环。</td></tr>
<tr><td><code>motion</code></td><td>由模式决定</td><td><code>arc</code> 或 <code>linear</code>；交互模式默认 arc，展示模式默认 linear。</td></tr>
</tbody></table></div>
<p>布尔属性只看有没有写：<code>autoplay="false"</code> 照样会自动播放。要关掉，就删掉这个属性。</p>
${code(
  `<algo-player algorithm="insertion-sort" input="5 2 4"
  autoplay loop speed="1200" hide-code hide-controls motion="linear">
</algo-player>`,
  '播放相关的属性',
)}

<h2 id="selectors">帧选择器</h2>
<p><code>0</code> 是初始状态，<code>-1</code> 是最后一帧。<code>improve</code> 这样的名字指它第一次出现；<code>improve#3</code> 指第三次。在分节内部重新计数：<code>delete-3/replacement</code>。只写分节名，就从它的第一步打开。范围如 <code>2..5</code>，从其中第一帧打开；导出和图组则会画出整个范围。时间轴上标出了各个分节；Page Up 和 Page Down 在分节之间跳转。</p>
${code(
  `<algo-player algorithm="bst.delete"
  input='{"from":[8,3,10,1,6],"key":3}' frame="delete-3"
  layout="narrow" language="python"></algo-player>`,
  '在窄栏中打开一个分节',
)}
<p>加载之后，<code>player.frame</code> 读出来是一个数字。选择器不存在时，播放器会显示一条诊断信息，列出可用的名字。</p>

<h2 id="themes">主题与展示模式</h2>
<p>固定主题有 <code>light</code>、<code>dark</code>、<code>print</code>、<code>textbook</code>、<code>textbook-dark</code>、<code>blocks</code>、<code>blocks-dark</code>、<code>answer-sheet</code> 和 <code>turbo-c</code>。<code>auto</code> 跟随读者的浅色或深色设置。写一对主题时，白天用第一个，夜间用第二个；打印时用白天的主题。参见<a href="${root}themes/">主题样例</a>。</p>
${code(
  `<algo-player algorithm="insertion-sort" input="5 2 4"
  theme="textbook textbook-dark"></algo-player>
<algo-player algorithm="insertion-sort" input="5 2 4" mode="display"
  speed="700" once motion="arc"></algo-player>`,
  '主题对与展示模式',
)}
<p>展示模式只显示数据结构，自动开始并循环播放，移出屏幕时暂停，不响应键盘。只想播放一遍就加上 <code>once</code>。读者设置了减少动态效果时，帧与帧之间不做过渡。</p>

<h2 id="javascript">事件与属性</h2>
<p><code>algo-load</code> 报告 <code>{ length }</code>，即步骤数。<code>algo-frame</code> 报告 <code>{ index, length, playing, stepName?, sectionId? }</code>。<code>algo-error</code> 报告 <code>{ errors }</code>，一个诊断信息数组。如果需要 load 事件，先注册监听，再赋值输入。</p>
${code(
  `await customElements.whenDefined('algo-player');
const player = document.querySelector('algo-player');
player.addEventListener('algo-frame', (event) => {
  console.log(event.detail.index, event.detail.stepName, event.detail.sectionId);
  console.log(player.stepName, player.section, player.currentLanguage);
});
player.addEventListener('algo-error', (event) => console.error(event.detail.errors));
player.addEventListener('algo-load', () => { player.frame = 'improve#3'; });
player.algorithm = 'dijkstra';
player.input = {graph: 'A-B 4, B-C 1, A-C 7', source: 'A'};`,
  '监听和控制播放器',
)}
<p><code>section</code> 是分节对象，带 <code>id</code>、<code>title</code> 和 <code>start</code>；它和 <code>stepName</code> 都可能是 undefined。方法有 <code>play()</code>、<code>pause()</code>、<code>next()</code>、<code>prev()</code> 和 <code>seek(index)</code>。<code>length</code> 只读。给 <code>visualization</code> 赋一个文档对象，或者给 <code>customTheme</code> 赋一个用 <code>@algomotion/svg</code> 中 <code>createTheme</code> 生成的完整主题。</p>

<h2 id="languages">源代码语言</h2>
<p>带 <code>sources</code> 的文档会在代码上方显示语言菜单。切换语言时停在当前帧。读者自己的选择优先于 <code>language="python"</code> 和默认的伪代码。这个选择通过本地存储同步到本站其他播放器和其他标签页；浏览器拒绝存储时，只在当前页面有效。<code>currentLanguage</code> 给出正在显示的语言。不同语言之间如何对应代码行，见<a href="${root}guide/documents/#sources">文档格式指南</a>。</p>

<h2 id="css">设置播放器样式</h2>
${code(
  `algo-player {
  --algo-accent: #345fbe;
  --algo-accent-fg: white;
  --algo-radius: 12px;
  --algo-control-radius: 6px;
  --algo-panel-radius: 8px;
}`,
  '播放器 CSS',
)}
<p>其他属性有 <code>--algo-bg</code>、<code>--algo-fg</code>、<code>--algo-muted</code>、<code>--algo-border</code>、<code>--algo-surface</code>、<code>--algo-error</code>、<code>--algo-line-bg</code>、<code>--algo-line-edge</code>、<code>--algo-font</code> 和 <code>--algo-mono</code>。语法高亮的颜色用 <code>--algo-code-keyword</code>、<code>--algo-code-string</code>、<code>--algo-code-number</code>、<code>--algo-code-comment</code>、<code>--algo-code-function</code> 和 <code>--algo-code-builtin</code>。这些只影响控件和代码；画面本身由主题决定。</p>

<h2 id="bundlers">工作区导入与打包工具</h2>
<p>在发布到 npm 之前，请使用仓库里的工作区包，并在本地构建。打包工具可以只导入这个类而不注册元素，先设置字体 URL，再定义元素：</p>
${code(
  `import { AlgoPlayer } from '@algomotion/elements';
AlgoPlayer.fontsUrl = '/assets/fonts/fonts.css';
customElements.define('algo-player', AlgoPlayer);`,
  '用打包工具注册',
)}
<p>把 <code>packages/elements/dist/fonts/</code> 复制到那个资源文件夹，保持样式表里字体的相对 URL 不变。<code>fontsUrl</code> 要在第一个播放器接入页面之前设置。<code>AlgoPlayer.fontsUrl = null</code> 不加载字体，改用系统的后备字体。如果只需要注册，导入 <code>@algomotion/elements/define</code> 即可。</p>
${note('<p>两个独立的 JavaScript 文件来自同一次构建。打包工具会自行处理分块；不要只复制它的入口文件而漏掉入口导入的分块。</p>')}
`,
};
