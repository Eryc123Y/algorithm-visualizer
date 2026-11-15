import type { Guide } from '../guide.ts';

export const shareLinks: Guide = {
  slug: 'share-links',
  title: 'Share links',
  nav: 'Share links',
  summary:
    'A share link carries an algorithm and its input, or a compressed document, after the # in the address.',
  figures: [
    {
      key: 'linked',
      algorithm: 'insertion-sort',
      input: '5 2 4',
      step: 'insert',
      alt: 'Insertion sort at the first insert step, the frame selected by the example link.',
    },
  ],
  body: ({ root, site, code, figure, note }) => `
<h2 id="open">Open a run at /play/</h2>
<p>The <a href="${site}play/#v=1&amp;alg=insertion-sort&amp;in=5%202%204&amp;frame=insert">share page</a> opens a run without installing anything. An algorithm link is short enough to write by hand:</p>
${code(`/play/#v=1&alg=insertion-sort&in=5%202%204&frame=insert&theme=auto`, 'A share link')}
${figure('linked', 'The link opens at <code>insert</code>, after putting 2 before 5.')}
<p>Algorithm links run the current registry's implementation. To preserve the actions of a particular run, use a document link. Rendering can still improve in later releases.</p>

<h2 id="format">Fragment format</h2>
<div class="scroll" role="region" aria-label="Share fragment keys" tabindex="0"><table class="params">
<thead><tr><th>Key</th><th>Meaning</th><th>Example</th></tr></thead><tbody>
<tr><td><code>v</code></td><td>Required link-format version, separate from the document version.</td><td><code>v=1</code></td></tr>
<tr><td><code>alg</code></td><td>Algorithm id. Use this or <code>doc</code>.</td><td><code>alg=insertion-sort</code></td></tr>
<tr><td><code>in</code></td><td>Optional algorithm input as percent-encoded text. Omit for the first example.</td><td><code>in=5%202%204</code></td></tr>
<tr><td><code>doc</code></td><td>Document JSON as UTF-8, raw DEFLATE, then unpadded base64url. No <code>alg</code> or <code>in</code> with it.</td><td>Use the codec below.</td></tr>
<tr><td><code>frame</code></td><td>Opening frame number or selector. Default <code>0</code>.</td><td><code>frame=improve%233</code></td></tr>
<tr><td><code>theme</code></td><td>A player theme, <code>auto</code> or a day/night pair.</td><td><code>theme=textbook%20textbook-dark</code></td></tr>
</tbody></table></div>
<p>Values use percent-encoding: <code>#</code> inside a selector becomes <code>%23</code>, and spaces become <code>%20</code>. Do not use form encoding's <code>+</code> for spaces. Unknown keys are ignored. Duplicate known keys, malformed encoding and unsupported versions are errors.</p>

<h2 id="tools">Links from an assistant</h2>
<p><a href="${root}guide/ai/">Connect the hosted MCP server</a>, then ask for an algorithm and a link. <code>algomotion_show</code> and <code>algomotion_run_recipe</code> append a link when the server has a share-page URL configured.</p>
${code(
  `Show insertion sort on 5 2 4 and give me its share link.
Open the first insert step.`,
  'Ask for a link',
)}
<p>A local server needs <code>ALGOMOTION_SHARE_URL</code>, or <code>createServer({ shareUrl })</code> in code. Use a page you serve, for example <code>https://example.org/play/</code>; no base address is assumed.</p>

<h2 id="code">Make a link in code</h2>
<p>Until npm publication, build and import <code>@algomotion/spec</code> from the repository workspace. <code>shareFragment</code> returns a result containing the fragment without its leading hash. It uses the platform's compression APIs for documents.</p>
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
  'Encode an algorithm or a document',
)}
<p><code>shareLink(base, content)</code> checks the base and enforces the writer's whole-link length limit. <code>shareFragment</code> alone does not enforce that length limit; use <code>shareLink</code> when distributing links. If constructing input from an object, serialize it as JSON for the <code>input</code> field.</p>

<h2 id="limits">Limits</h2>
<div class="scroll" role="region" aria-label="Share link limits" tabindex="0"><table class="params">
<thead><tr><th>Limit</th><th>Maximum</th></tr></thead><tbody>
<tr><td>Whole link made by <code>shareLink</code> or MCP</td><td>16,384 characters</td></tr>
<tr><td>Fragment read by the page</td><td>2,097,152 characters</td></tr>
<tr><td>Decoded <code>alg</code>, <code>frame</code>, <code>theme</code></td><td>200 characters each</td></tr>
<tr><td>Decoded <code>in</code></td><td>65,536 characters</td></tr>
<tr><td>Inflated document</td><td>4 MiB of UTF-8</td></tr>
</tbody></table></div>
<p>Documents also face the <a href="${root}guide/documents/#limits">protocol limits</a>. Oversized links report <code>LINK_TOO_LARGE</code>. Share a large run as an algorithm with input, or send the document as a file.</p>

<h2 id="privacy">Privacy and course pages</h2>
<p>The browser does not send the fragment in its HTTP request. The share page decodes and runs it in the reader's browser; there is no document upload. The link itself contains the input or document, so anyone who receives the whole link can read it. It can also remain in browser history or wherever you paste it.</p>
<p>The share page allows framing, so a course page can embed it. Use an absolute URL when the course site has a different origin:</p>
${code(
  `<iframe title="Insertion sort on 5 2 4"
  src="https://example.org/play/#v=1&alg=insertion-sort&in=5%202%204&frame=insert"
  width="100%" height="600" loading="lazy"></iframe>`,
  'Embed a share page',
)}
${note('<p>Replace <code>https://example.org/play/</code> with the address of your share page. The course platform must also allow iframe embeds.</p>')}
`,
};
