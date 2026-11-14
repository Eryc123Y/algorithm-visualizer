import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'inputs',
  title: '输入写法',
  nav: '输入写法',
  summary:
    '输入可以写成简短的记法，也可以写成 JSON；算法会检查输入的结构，并指出需要修改的字段。',
  figures: [
    {
      key: 'graph',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      alt: '在带权图上，Dijkstra 算法经由 B 缩短了到 C 的距离。',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="choose">先选算法</h2>
<p>每个<a href="${root}algorithms/">算法页</a>都写明了它的输入。同一份输入在播放器、命令行、Typst、LaTeX 和 AI 工具里都能用。下面的命令示例用的是<a href="${root}guide/cli/">从仓库构建的命令</a>。</p>
<p>只有一个必填字段的输入，可以只写这个字段。排序算法直接接收待排序的值；Dijkstra 接收图，并从第一个顶点出发。有两个必填字段的算法需要写成对象。不给输入时，算法运行它的第一个示例。</p>
${code(
  `algomotion run insertion-sort '5 2 4 6 1 3'
algomotion run binary-search '{"values": "1 3 5 7 9", "target": 7}'
algomotion run dijkstra`,
  '运行一个算法',
)}

<h2 id="lists">列表和树</h2>
<p>数字之间用空格或逗号分隔。在记法字符串里，方括号可写可不写。在命令行中，以 <code>[</code> 开头的值会按 JSON 读取，所以里面必须用逗号分隔，符合 JSON 语法。树的层序写法用 <code>null</code> 表示空位。单词列表适用于 trie 等算法。</p>
${code(
  `algomotion run insertion-sort '5, 2, 4, 6, 1, 3'
algomotion run insertion-sort '[5, 2, 4, 6, 1, 3]'
algomotion run inorder-tree-walk '[4, 2, 6, 1, 3, null, 7]'
algomotion run trie '{"from":"cat car", "ops":"insert dog, search cat"}'`,
  '列表与层序',
)}

<h2 id="tree-shapes">B 树节点和斐波那契堆森林</h2>
<p>B 树节点先在方括号里写关键字，再在圆括号里写子节点。斐波那契堆写出各棵根树，用空格或逗号分隔；每个关键字后面可以用圆括号跟上它的子节点。星号标记失去过一个子节点的节点。这些记法要放在输入对象的 <code>from</code> 字段里。</p>
${code(
  `algomotion run b-tree.insert '{"from":"[G M] ([A C] [H K] [N R])", "key":"B"}'
algomotion run fibonacci-heap.extract-min '{"from":"7 3(18 52) 17"}'`,
  '显式写出树的形状',
)}

<h2 id="graphs">用边列表写图</h2>
<p><code>A-B</code> 表示无向边，<code>A-&gt;B</code> 表示有向边。权重写在空格之后。边与边之间用逗号分隔；单独一个名字表示一个孤立顶点。名字由字母、数字和下划线组成。顶点按首次出现的顺序排列。</p>
${code(
  `algomotion run dijkstra 'A-B 4, B-C 1, A-C 7'
algomotion run topological-sort 'shirt->tie, tie->jacket, socks'
algomotion run dijkstra '{"graph":"A-B 4, B-C 1", "source":"C"}'
algomotion run prim '{"graph":"A-B 4, B-C 1", "root":"C"}'`,
  '带权图与有向图',
)}
${figure('graph', '边列表 <code>A-B 4, B-C 1, A-C 7</code>，停在 <code>improve#3</code>。')}
<p>结构化写法显式列出顶点和边，适合在代码里构造输入。</p>
${code(`algomotion run dijkstra '{"graph":{"nodes":["A","B","C"],"edges":[["A","B",4],["B","C",1]]},"source":"A"}'`, '结构化的图')}

<h2 id="operations">操作列表</h2>
<p>数据结构的操作序列接收 <code>from</code> 和 <code>ops</code>，最多八个操作。每个操作的参数按顺序写。可用的操作名和参数取决于具体的数据结构。单个操作有自己的 id，比如 <code>bst.delete</code>。</p>
${code(
  `algomotion run bst '{"from":"8 3 10 1 6", "ops":"insert 4, delete 3"}'
algomotion run min-heap '{"from":"5 3 8", "ops":"push 1, pop"}'
algomotion run bst.delete '{"from":[8,3,10,1,6], "key":3}'
algomotion run bst '{"from":[8,3,10],"ops":[{"op":"insert","key":4},{"op":"delete","key":3}]}'`,
  '操作序列与单个操作',
)}

<h2 id="matrices">表格和矩阵</h2>
<p>矩阵算法接收嵌套数组，或者一个字符串：行与行之间用分号，元素之间用空格或逗号。矩阵乘法算法要求输入是元素为小整数的方阵。可视化中的表格本身写在<a href="${root}guide/documents/#table">文档</a>里，用若干行值表示；它没有单独的通用表格输入记法。</p>
${code(
  `algomotion run strassen '{"a":"1 2; 3 4", "b":"5 6; 7 8"}'
algomotion run strassen '{"a":[[1,2],[3,4]], "b":[[5,6],[7,8]]}'`,
  '两个矩阵',
)}

<h2 id="points">点和线段</h2>
<p>点写成 <code>(x, y)</code>，可以带名字，如 <code>a(0, 0)</code>。结构化的点可以是坐标对，也可以是带 <code>id</code>、<code>x</code> 和 <code>y</code> 的对象。几何算法只接受 −999 到 999 之间的整数坐标，并拒绝重复的坐标。线段用短横线连接两个坐标对；可选的名字写在冒号前面。</p>
${code(
  `algomotion run graham-scan 'a(0, 0) b(4, 0) c(4, 4) d(0, 4) e(2, 2)'
algomotion run graham-scan '[[0,0],[4,0],[4,4],[0,4],[2,2]]'
algomotion run any-segments-intersect '(0, 0)-(4, 4), s2: (0, 4)-(4, 0)'`,
  '几何输入',
)}

<h2 id="json">JSON 和省略花括号的对象</h2>
<p>文本先按 JSON 读取，不行再补上外层花括号，按 JSON 对象读取。其余文本都当作记法字符串。以 <code>{</code>、<code>[</code> 或 <code>&quot;</code> 开头、两种 JSON 读法都失败的文本会报错。JSON 的键和字符串要用双引号。下面例子里的单引号是 shell 的引号。</p>
${code(
  `algomotion run bst.delete '"from":"8 3 10 1 6", "key":3'
algomotion run balanced-brackets '"{[()]}"'`,
  '对象与字面字符串',
)}
<p>JavaScript 工具直接接收值本身。Typst 接收数组和字典，如 <code>(from: (8, 3, 10), key: 3)</code>。它们都不需要在值外面套一层 JSON 文本。</p>

<h2 id="files">把输入写在文件里</h2>
<p>把 <code>{"graph":"A-B 4, B-C 1", "source":"A"}</code> 存为 <code>graph.json</code>。export 命令用 <code>--input</code> 读取它；以 <code>.json</code> 结尾的名字总是当作文件名。短横线表示读标准输入。<code>run</code> 的位置参数是输入文本，不是文件名。</p>
${code(
  `algomotion export dijkstra --input graph.json --step -1 --out figures
cat graph.json | algomotion export dijkstra --input - --step -1 --out figures
algomotion run dijkstra 'A-B 4, B-C 1' --out run.json`,
  '读取输入并写出文档',
)}
<p>播放器用 <code>algorithm="dijkstra" src="graph.json"</code> 读取输入文件。LaTeX 用 <code>\\algomotionfile[algorithm=dijkstra]{graph.json}</code>。Typst 用 <code>json("graph.json")</code> 读取。</p>

<h2 id="errors">出错时的样子</h2>
${code(
  `algomotion run dijkstra 'A-B 4, B-C x'
# INVALID_NOTATION at $.input: Expected a weight or "," after "B-C", not "x" (character 12)`,
  '一个记法错误',
)}
<p>错误信息包含错误码、路径、说明，常常还有提示。<code>$.input.graph</code> 指向对象内部的字段；<code>$.input</code> 指单独给出的主字段。<code>INVALID_JSON</code> 表示文本无法读取，<code>INVALID_SHAPE</code> 表示某个字段类型不对或缺失，<code>INVALID_ARGUMENT</code> 表示算法无法用这份输入运行。</p>
${note('<p>改正路径指出的字段，再运行一次。一个算法接受的输入，可能超出另一个算法的限制；每个算法的输入 schema 见算法目录和 <code>algomotion recipes</code>。</p>')}
`,
};
