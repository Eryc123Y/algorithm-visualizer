import type { Guide } from '../../guide.ts';
import { text } from '../../html.ts';

/** Complete examples and action fields, as on the English page; only the summaries are Chinese. */
const kinds = [
  {
    kind: 'array',
    summary:
      '一行单元格；用 view="heap" 在数组上方画出堆的树形。模式串会再加一行，用于字符串匹配。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "array",\n      "initial": [\n        5,\n        2\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "swap",\n          "i": 0,\n          "j": 1\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'set | index, value',
      'swap | i, j',
      'insert | index, element',
      'remove | index',
      'compare | i, j',
      'highlight | indices',
      'pointer | name, index',
      'settle | index',
      'align | shift, matched?',
      'check | j',
    ],
  },
  {
    kind: 'stack',
    summary: '后进先出。初始值从栈底排到栈顶。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "stack",\n      "initial": [\n        1\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "push",\n          "element": 2\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: ['push | element', 'pop | —', 'peek | —', 'highlight | indices'],
  },
  {
    kind: 'queue',
    summary: '先进先出，两端都支持双端队列操作。位置从队首数起。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "queue",\n      "initial": [\n        1\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "enqueue",\n          "element": 2\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'enqueue | element',
      'dequeue | —',
      'pushFront | element',
      'popBack | —',
      'peek | end?',
      'highlight | indices',
    ],
  },
  {
    kind: 'linkedList',
    summary:
      '节点按横向顺序排列，带显式的 next 链接和可选的 prev 链接。移动节点不会改接它的链接。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "linkedList",\n      "initial": [\n        1,\n        2\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "link",\n          "from": 0,\n          "to": null\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insert | index, element',
      'remove | index',
      'set | index, value',
      'move | from, to',
      'link | from, to, field?',
      'pointer | name, index',
      'highlight | indices',
      'visit | index',
      'settle | index',
    ],
  },
  {
    kind: 'tree',
    summary:
      '有根树和森林。层序中的 null 留出二叉树的空位；自动生成的节点 id 跳过这些 null。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "tree",\n      "levelOrder": [\n        8,\n        3,\n        10\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "visit",\n          "node": "e1"\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'addNode | node, parent, slot?',
      'removeNode | node',
      'setChild | parent, child, slot?',
      'detach | node, slot?',
      'rotate | node, direction',
      'setValue | node, value',
      'swapValues | a, b',
      'setColor | node, color',
      'highlight | nodes',
      'compare | a, b',
      'visit | node',
      'settle | node',
      'group | node, group',
      'pointer | name, node',
      'annotate | node, text, field?',
      'markEdge | node, mark',
      'labelEdge | node, label',
    ],
  },
  {
    kind: 'btree',
    summary:
      '每个节点含多个键的多路树。这个类型只检查形状，不检查键的顺序或最小度数。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "btree"\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "insertKey",\n          "node": "root",\n          "index": 0,\n          "key": 4\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insertKey | node, index, key',
      'removeKey | key',
      'setKey | key, value',
      'lift | key, over',
      'split | node, index, newNode',
      'grow | newRoot',
      'merge | node, index',
      'shrink | —',
      'borrow | node, child, from',
      'highlight | keys?, nodes?',
      'settle | key',
      'pointer | name, node',
      'annotate | node, text',
    ],
  },
  {
    kind: 'graph',
    summary:
      '节点和有向或无向的边，边可以带权重。边 id 默认按声明时的顺序写成 from-to。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "graph",\n      "nodes": [\n        "A",\n        "B"\n      ],\n      "edges": [\n        [\n          "A",\n          "B",\n          4\n        ]\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "visit",\n          "node": "A"\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'addNode | node',
      'removeNode | node',
      'setValue | node, value',
      'addEdge | edge',
      'removeEdge | edge',
      'setWeight | edge, weight',
      'highlight | nodes?, edges?',
      'visit | node',
      'settle | node',
      'group | node, group',
      'pointer | name, node',
      'annotate | node, text',
      'markEdge | edge, mark',
      'resetMarks | —',
    ],
  },
  {
    kind: 'table',
    summary:
      '按 [row, column] 索引的网格。null 单元格画成空白；初始值中较短的行会补齐。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "table",\n      "initial": [\n        [\n          0,\n          null\n        ]\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "set",\n          "cell": [\n            0,\n            1\n          ],\n          "value": 1\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'set | cell, value',
      'highlight | cells',
      'depend | cell, on',
      'settle | cells',
      'resetMarks | —',
    ],
  },
  {
    kind: 'hashTable',
    summary: '用链地址法解决冲突。每个桶由你自己选定，并在解说里说明散列方式。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "hashTable",\n      "size": 5\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "insert",\n          "bucket": 2,\n          "element": 7\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insert | bucket, element, index?',
      'remove | bucket, index',
      'set | bucket, index, value',
      'highlight | bucket, indices?',
      'settle | bucket, index',
      'resetMarks | —',
    ],
  },
  {
    kind: 'priorityQueue',
    summary:
      '按键排序的元素，默认最小的在前。键为 null 表示无穷大。元素位置会变，所以按 id 指称元素。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "priorityQueue",\n      "initial": [\n        {\n          "id": "A",\n          "value": "A",\n          "key": null\n        }\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "setKey",\n          "id": "A",\n          "key": 4\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insert | element, key',
      'extract | —',
      'setKey | id, key',
      'peek | —',
      'highlight | ids',
    ],
  },
  {
    kind: 'plane',
    summary: '坐标上的点和线段，y 轴朝上，整个运行过程用同一个比例。',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "plane",\n      "points": [\n        {\n          "id": "a",\n          "x": 0,\n          "y": 0\n        },\n        {\n          "id": "b",\n          "x": 4,\n          "y": 3\n        }\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "compare",\n          "points": [\n            "a",\n            "b"\n          ]\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'addPoint | point',
      'removePoint | id',
      'addSegment | segment',
      'removeSegment | id',
      'label | segment, text',
      'highlight | points?, segments?',
      'compare | points',
      'visit | point',
      'settle | point',
      'select | segment, on',
      'pointer | name, point',
      'line | name, x',
    ],
  },
] as const;

export const zh: Guide = {
  slug: 'documents',
  title: '文档',
  nav: '文档',
  summary:
    '文档用 JSON 记录结构和动作。现成的算法表达不了你要讲的内容时，就自己写一份。',
  figures: [
    {
      key: 'stack',
      algorithm: 'balanced-brackets',
      input: '(())',
      step: 'push#2',
      alt: '一次括号匹配的运行，栈里有两个左括号。',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="when">什么时候写文档</h2>
<p>有合适的<a href="${root}algorithms/">算法</a>就先用算法，它会根据你的输入生成完整的文档。要讲一个自定义的过程、一段局部的执行轨迹，或一串特定的动作时，再自己写文档。文档描述发生了什么，并不执行源代码。</p>

<h2 id="shape">基本结构</h2>
<p>写上 <code>version: "1.0"</code>、一个 <code>structures</code> 映射和一个 <code>steps</code> 列表。每个声明都有 <code>kind</code>。每个动作在 <code>target</code> 中指明一个已声明的结构，在 <code>type</code> 中指明一种操作。同一步里的动作按顺序执行。第 0 帧是初始状态，第 n 帧是第 n 步之后的状态。</p>
${code(
  JSON.stringify(
    {
      version: '1.0',
      title: 'Push, then pop',
      structures: { s: { kind: 'stack', initial: [1] } },
      steps: [
        {
          actions: [{ target: 's', type: 'push', element: 2 }],
          meta: { id: 'push', narration: 'Push 2 above 1.' },
        },
        {
          actions: [{ target: 's', type: 'pop' }],
          meta: {
            id: 'pop',
            narration: 'Pop removes 2, the last value pushed.',
          },
        },
      ],
      sections: [
        { id: 'push-2', title: 'Push 2', start: 0 },
        { id: 'pop-2', title: 'Pop 2', start: 1 },
      ],
    },
    null,
    2,
  ),
  '一份完整的文档：stack.json',
)}
${figure('stack', '括号匹配用同一种栈类型保存尚未匹配的左括号。')}
<p>读者应该看到的每一处变化，各占一步。<code>actions</code> 为空列表的步骤可以只带解说，不改动数据。结构名是标识符，如 <code>a</code> 或 <code>call_stack</code>。给结构加 <code>label</code> 作为说明文字；调用栈这类辅助结构可以加 <code>place: "side"</code>。</p>

<h2 id="names">步骤名、解说和分节</h2>
<p><code>meta.id</code> 是可以重复的步骤名，如 <code>compare</code>。用连字符连接的小写单词，以字母开头，最多 40 个字符。每一步都要命名。<code>meta.narration</code> 说明发生了什么、为什么；<code>meta.vars</code> 可以显示变量的当前值。</p>
<p><code>sections</code> 把连续的步骤编成组。每个分节有唯一的 <code>id</code>、<code>title</code> 和从 0 开始的起始步骤下标 <code>start</code>。分节到下一个分节的起点或时间线末尾结束。不要拿步骤名当分节 id：否则只写这个名字的选择器会指向分节。</p>
<div class="scroll" role="region" aria-label="文档选择器" tabindex="0"><table class="params">
<thead><tr><th>选择器</th><th>在栈示例中的含义</th></tr></thead><tbody>
<tr><td><code>0</code>, <code>-1</code></td><td>初始状态；最后一帧。</td></tr>
<tr><td><code>push</code>, <code>push#1</code></td><td>第一个名为 push 的步骤；序号从 1 数起。</td></tr>
<tr><td><code>push-2/push</code></td><td>分节 push-2 中的第一个 push。</td></tr>
<tr><td><code>push-2</code></td><td>整个分节，从它第一步之前的那一帧到它的最后一帧。</td></tr>
<tr><td><code>push..-1</code></td><td>从 push 到最后一帧的范围，两端都包含。</td></tr>
</tbody></table></div>
<p>播放器打开分节时停在它的第一步。导出和查看时会带上它之前的一帧作为上下文。只绘制单帧的渲染器要求选择器只指向一帧。</p>

<h2 id="sources">一种或多种语言的源代码</h2>
<p>只有一份代码清单时，用 <code>source: {language, code}</code> 和 <code>meta.line</code>，行号从 1 数起。有多份时改用 <code>sources</code>。每份清单有 <code>language</code>、<code>code</code> 和 <code>anchors</code>；<code>anchors</code> 把名字映射到行号。步骤的 <code>meta.at</code> 指定一个每份清单里都有的锚点。<code>meta.line</code> 不能和 <code>sources</code> 一起用。</p>
${code(
  JSON.stringify(
    {
      version: '1.0',
      sources: [
        { language: 'pseudocode', code: 'PUSH(s, 2)', anchors: { push: 1 } },
        { language: 'python', code: 's.append(2)', anchors: { push: 1 } },
      ],
      structures: { s: { kind: 'stack', initial: [1] } },
      steps: [
        {
          actions: [{ target: 's', type: 'push', element: 2 }],
          meta: {
            id: 'push',
            at: 'push',
            vars: { x: 2 },
            narration: 'Push 2 on top.',
          },
        },
      ],
    },
    null,
    2,
  ),
  '带两份源代码清单的文档',
)}
<p>伪代码放在第一份。各语言中的变量名和从 0 开始的数据下标要保持一致。播放器的语言菜单只切换代码清单，不改变当前帧。</p>

<h2 id="kinds">结构类型与动作</h2>
<p>下面每个示例都是只含一个动作的完整文档。下标从 0 开始。直接给出的值会得到稳定的自动生成 id；元素也可以写成 <code>{"id":"x","value":5}</code>。删除后不要复用 id。每个动作都基于之前的动作留下的状态，包括同一步中更早的动作。</p>
<p>表格列出每个动作在 <code>target</code> 和 <code>type</code> 之外的字段。带问号的字段可选。完整的约束和演练示例，可以运行 <code>algomotion guide KIND</code>，或用 <code>algomotion_guide</code> 请求该类型。</p>
${kinds
  .map(
    (k) => `
<h2 id="${k.kind}">${k.kind}</h2>
<p>${text(k.summary)}</p>
${code(k.example, k.kind + ' 文档')}
<div class="scroll" role="region" aria-label="${k.kind} 的动作" tabindex="0"><table class="params"><thead><tr><th>动作</th><th>字段</th></tr></thead><tbody>
${k.actions
  .map((row) => {
    const [action, fields] = row.split(' | ');
    return (
      '<tr><td><code>' +
      text(action!) +
      '</code></td><td><code>' +
      text(fields!) +
      '</code></td></tr>'
    );
  })
  .join('')}
</tbody></table></div>
`,
  )
  .join('')}

<h2 id="marks">标记与引用</h2>
<p>比较、高亮、peek、表格依赖和交换标记只持续一步。访问、已确定标记、指针、分组、注释、边标记、平面的选中状态、标签和直线会一直保留，直到被改动或目标消失。图、表格和散列表有 <code>resetMarks</code>。指针目标为 null 时移除该指针。</p>
<p>数组的模式串需要行视图，并要求文本保持不变：存在模式串时，<code>set</code>、<code>swap</code>、<code>insert</code> 和 <code>remove</code> 都会被拒绝。模式串的 <code>check</code> 与实际文本比较，所以引擎会拒绝错误的匹配声明。树的边按子节点寻址，图的边按边 id 寻址。无向边 <code>["B","A"]</code> 的 id 仍是 <code>B-A</code>。</p>

<h2 id="validate">分享前校验和查看</h2>
<p>把第一个完整示例存为 <code>stack.json</code>，然后用<a href="${root}guide/cli/">命令行</a>：</p>
${code('algomotion validate stack.json\nalgomotion inspect stack.json 0 push -1', '检查手写的文档')}
<p>也可以先用 <code>{"document": ...}</code> 调用 <code>algomotion_validate</code>，再用这份文档和 <code>frames: [0, "push", -1]</code> 调用 <code>algomotion_inspect</code>。校验同时检查 schema 和重放。查看则确认这些合法的动作确实讲出了你想讲的内容。</p>
${code('OUT_OF_RANGE at $.steps[3].actions[0].j: j=4 is out of range for an array of length 4 (hint: Valid values are 0 to 3.)', '一条动作诊断信息')}
<p>这个路径指向第四步的第一个动作。重放在第一个出错的动作处停止；改好后再校验一次。JSON Schema 的 id 是 <code>urn:algomotion:schema:visualization:1.0</code>；可以通过 <code>algomotion://schema</code> 获取，也可以用 <code>@algomotion/spec</code> 中的 <code>visualizationJsonSchema()</code>。</p>

<h2 id="limits">限制与兼容性</h2>
<p>一份文档最多声明 16 个结构、10,000 个步骤，每步最多 100 个动作。结构的一般上限是 1,000 个元素和 4,000 条边；表格另有 100 行、100 列的上限。平面最多 64 个点、128 条线段。源代码清单最多 8 份，每份最多 20,000 个字符。个别算法对输入的限制可能更小。</p>
${note('<p>协议 1.x 只会新增可选字段、动作、类型、标记，或放宽限制。所有合法的 1.0 文档始终合法，含义不变。不兼容的改动需要 2.0 版本和升级。未知字段一律报错：将来的字段需要对应的新版本和新的解析器。写文档时，用能覆盖你所用功能的最老版本。</p>')}
<p>这一承诺由 ADR 0043 规定。诊断代码的含义在 1.x 中保持不变，措辞可能调整。布局、绘制和播放器属性不属于协议，可以在不升主版本的情况下改进。旧的 0.1–0.9 文档会升级到 1.0，并给出 <code>UPGRADED_VERSION</code> 警告；新文档应写 <code>1.0</code>。</p>
`,
};
