import type { Guide } from '../../guide.ts';

export const zh: Guide = {
  slug: 'share-links',
  title: '分享链接',
  nav: '分享链接',
  summary: '分享链接把算法和输入，或一份压缩后的文档，放在地址中 # 之后。',
  figures: [
    {
      key: 'linked',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: 'insert',
      alt: '插入排序停在第一个 insert 步，也就是示例链接选中的那一帧。',
    },
  ],
  body: ({ root, site, code, figure, note }) => `
<h2 id="open">在 /play/ 打开一次运行</h2>
<p><a href="${site}play/#v=1&amp;alg=insertion-sort&amp;in=5%202%204&amp;frame=insert">分享页</a>无需安装任何东西就能打开一次运行。算法链接很短，可以手写：</p>
${code(`/play/#v=1&alg=insertion-sort&in=5%202%204&frame=insert&theme=auto`, '一个分享链接')}
${figure('linked', '链接在 <code>insert</code> 处打开，此时 2 已经移到 5 前面。')}
<p>算法链接运行的是当前注册表中的实现。要保留某次运行的具体动作，就用文档链接。不过绘制效果在以后的版本中仍可能改进。</p>

<h2 id="format">片段格式</h2>
<div class="scroll" role="region" aria-label="分享片段的键" tabindex="0"><table class="params">
<thead><tr><th>键</th><th>含义</th><th>示例</th></tr></thead><tbody>
<tr><td><code>v</code></td><td>必填的链接格式版本，与文档版本无关。</td><td><code>v=1</code></td></tr>
<tr><td><code>alg</code></td><td>算法 id。与 <code>doc</code> 二选一。</td><td><code>alg=insertion-sort</code></td></tr>
<tr><td><code>in</code></td><td>可选的算法输入，为百分号编码的文本。省略时用第一个示例。</td><td><code>in=5%202%204</code></td></tr>
<tr><td><code>doc</code></td><td>文档 JSON，依次经过 UTF-8 编码、原始 DEFLATE 压缩和无填充的 base64url 编码。有它时不能再给 <code>alg</code> 或 <code>in</code>。</td><td>用下文的编解码函数。</td></tr>
<tr><td><code>frame</code></td><td>打开时的帧号或选择器，默认 <code>0</code>。</td><td><code>frame=improve%233</code></td></tr>
<tr><td><code>theme</code></td><td>播放器主题、<code>auto</code>，或一对日间/夜间主题。</td><td><code>theme=textbook%20textbook-dark</code></td></tr>
</tbody></table></div>
<p>值用百分号编码：选择器里的 <code>#</code> 写成 <code>%23</code>，空格写成 <code>%20</code>。不要用表单编码中表示空格的 <code>+</code>。未知的键会被忽略。已知的键重复、编码格式错误或版本不受支持，都会报错。</p>

<h2 id="tools">从助手获取链接</h2>
<p><a href="${root}guide/ai/">连上托管的 MCP 服务器</a>，然后请它展示一个算法并给出链接。服务器配置了分享页 URL 时，<code>algomotion_show</code> 和 <code>algomotion_run_recipe</code> 会在结果后附上链接。</p>
${code(
  `Show insertion sort on 5 2 4 and give me its share link.
Open the first insert step.`,
  '请助手给出链接',
)}
<p>本地服务器需要设置 <code>ALGOMOTION_SHARE_URL</code>，或在代码中用 <code>createServer({ shareUrl })</code>。填你自己提供的页面，例如 <code>https://example.org/play/</code>；服务器不预设任何基础地址。</p>

<h2 id="code">用代码生成链接</h2>
<p>在发布到 npm 之前，从仓库的工作区构建并导入 <code>@algomotion/spec</code>。<code>shareFragment</code> 返回一个结果，其中的片段不带开头的井号。编码文档时会调用平台自带的压缩 API。</p>
${code(
  `import { shareFragment, shareLink } from '@algomotion/spec';

const fragment = await shareFragment({
  algorithm: 'insertion-sort', input: '5 2 4', frame: 'insert', theme: 'auto',
});
if (!fragment.ok) throw new Error(fragment.error[0].message);
const url = new URL('/play/', 'https://example.org');
url.hash = fragment.value;
console.log(url.href);

const document = {
  version: '1.0', structures: {s: {kind: 'stack', initial: [1]}},
  steps: [{actions: [{target: 's', type: 'push', element: 2}],
    meta: {id: 'push', narration: 'Push 2 on top.'}}],
};
const link = await shareLink('https://example.org/play/', {document, frame: -1});
if (!link.ok) throw new Error(link.error[0].message);
console.log(link.value);`,
  '编码一个算法或一份文档',
)}
<p><code>shareLink(base, content)</code> 会检查基础地址，并检查整条链接的长度上限。单独用 <code>shareFragment</code> 不检查这个长度；对外分发链接时用 <code>shareLink</code>。如果输入是从对象构造出来的，先序列化成 JSON 再填进 <code>input</code> 字段。</p>

<h2 id="limits">限制</h2>
<div class="scroll" role="region" aria-label="分享链接的限制" tabindex="0"><table class="params">
<thead><tr><th>限制项</th><th>上限</th></tr></thead><tbody>
<tr><td><code>shareLink</code> 或 MCP 生成的整条链接</td><td>16,384 个字符</td></tr>
<tr><td>页面读取的片段</td><td>2,097,152 个字符</td></tr>
<tr><td>解码后的 <code>alg</code>、<code>frame</code>、<code>theme</code></td><td>各 200 个字符</td></tr>
<tr><td>解码后的 <code>in</code></td><td>65,536 个字符</td></tr>
<tr><td>解压后的文档</td><td>4 MiB 的 UTF-8</td></tr>
</tbody></table></div>
<p>文档还要满足<a href="${root}guide/documents/#limits">协议的限制</a>。链接过长时报告 <code>LINK_TOO_LARGE</code>。较大的运行可以改用算法加输入的形式分享，或者把文档作为文件发送。</p>

<h2 id="privacy">隐私与课程页面</h2>
<p>浏览器不会在 HTTP 请求中发送片段。分享页在读者的浏览器里解码并运行，不上传文档。但链接本身包含输入或文档，任何拿到完整链接的人都能读到。链接也可能留在浏览器历史记录里，或留在你粘贴它的地方。</p>
<p>分享页允许用 iframe 嵌入，课程页面可以直接放进去。课程网站与分享页不同源时，使用绝对 URL：</p>
${code(
  `<iframe title="Insertion sort on 5 2 4"
  src="https://example.org/play/#v=1&alg=insertion-sort&in=5%202%204&frame=insert"
  width="100%" height="600" loading="lazy"></iframe>`,
  '嵌入分享页',
)}
${note('<p>把 <code>https://example.org/play/</code> 换成你的分享页地址。课程平台也必须允许嵌入 iframe。</p>')}
`,
};
