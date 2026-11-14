/**
 * The project pages (roadmap 5.5): the changelog, the roadmap and the
 * contributing page. Each is built from a file of the repository at build
 * time, so the site says what the repository says: `CHANGELOG.md`,
 * `docs/roadmap.md` and `CONTRIBUTING.md`.
 */
import { attribute, page, REPOSITORY, text, type Assets } from './html.ts';
import { rootsOf, type Locale } from './locale.ts';
import { CHROME } from './text/chrome.ts';
import {
  inline,
  parse,
  plain,
  render,
  repositoryLinks,
  section,
  slug,
  type Block,
  type ListItem,
  type RenderOptions,
} from './markdown.ts';

const PULLS = `${REPOSITORY}/pull/`;
const ROOT = '../';

/** How a file of the repository is rendered: its links point at GitHub. */
const optionsFor = (file: string): RenderOptions => ({
  link: repositoryLinks(REPOSITORY, file),
  issues: PULLS,
});

const sourceLink = (file: string, label: string): string =>
  `<a href="${attribute(`${REPOSITORY}/blob/main/${file}`)}"><code>${text(label)}</code></a>`;

const crumbs = (title: string, locale: Locale): string =>
  `<nav class="crumbs" aria-label="${attribute(CHROME[locale].breadcrumb)}"><ol><li><a href="${ROOT}">algomotion</a></li><li aria-current="page">${text(title)}</li></ol></nav>`;

/**
 * A project page at `path`. The Chinese changelog and roadmap keep the
 * English files' text, marked `lang="en"` inside `englishBody`.
 */
function projectPage(
  title: string,
  description: string,
  body: string,
  assets: Assets,
  locale: Locale,
  path: string,
): string {
  return page({
    title: `${title} · algomotion`,
    description,
    root: rootsOf(locale, path).site,
    assets,
    section: 'project',
    layout: 'project',
    locale,
    alternate: path,
    body: `${crumbs(title, locale)}
<article class="guide-body project-body">
<h1>${text(title)}</h1>
${body}
</article>`,
  });
}

/* ── The changelog ─────────────────────────────────────────────────── */

/** `CHANGELOG.md` as a page; its own title gives way to the page's. */
export function changelogPage(
  markdown: string,
  assets: Assets,
  locale: Locale = 'en',
): string {
  const blocks = parse(markdown);
  const body = render(
    blocks[0]?.type === 'heading' ? blocks.slice(1) : blocks,
    optionsFor('CHANGELOG.md'),
  );
  const source = sourceLink('CHANGELOG.md', 'CHANGELOG.md');
  return locale === 'en'
    ? projectPage(
        'Changelog',
        'What has changed in algomotion, by phase of the roadmap, from the repository’s CHANGELOG.md.',
        `<p class="lede">What changed in each phase of the roadmap, newest first. Built from ${source} in the repository.</p>
${body}`,
        assets,
        locale,
        'changelog/',
      )
    : projectPage(
        '更新日志',
        'algomotion 按路线图阶段记录的改动，取自仓库的 CHANGELOG.md。',
        `<p class="lede">按路线图的阶段列出每次改动，最新的在前。内容取自仓库里的 ${source}。</p>
${ENGLISH_NOTE}
<div lang="en">
${body}
</div>`,
        assets,
        locale,
        'changelog/',
      );
}

/** Said above a page whose text stays in English. */
const ENGLISH_NOTE =
  '<aside class="note"><p>本页正文为英文，与仓库中的文件保持一致。</p></aside>';

/* ── The roadmap ───────────────────────────────────────────────────── */

export interface RoadmapItem {
  readonly phase: string;
  /** The bold lead of the item, or its whole first line. */
  readonly title: string;
  /** The first line as Markdown. */
  readonly text: string;
  readonly item: ListItem;
}

export interface RoadmapPhase {
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly items: readonly RoadmapItem[];
}

export interface RoadmapSummary {
  readonly phases: readonly RoadmapPhase[];
  readonly total: number;
  readonly done: number;
  readonly doing: readonly RoadmapItem[];
  /** Open items anyone can pick up, in order. */
  readonly next: readonly RoadmapItem[];
  /** Open items marked _owner_. */
  readonly owner: readonly RoadmapItem[];
}

const titleOf = (markdown: string): string => {
  const lead = /^\*\*(.+?)\*\*/.exec(markdown);
  return plain(lead === null ? markdown : lead[1]!).replace(/\.$/, '');
};

/** The roadmap's phases and their items, counted. */
export function roadmapSummary(blocks: readonly Block[]): RoadmapSummary {
  const phases: RoadmapPhase[] = [];
  blocks.forEach((b, k) => {
    if (b.type !== 'heading' || b.level !== 2 || !b.text.startsWith('Phase '))
      return;
    const end = blocks.findIndex(
      (c, j) => j > k && c.type === 'heading' && c.level <= 2,
    );
    const own = blocks.slice(k + 1, end === -1 ? undefined : end);
    const items = own.flatMap((c) =>
      c.type === 'list'
        ? c.items
            .filter((i) => i.task !== undefined)
            .map((i) => ({
              phase: b.text,
              title: titleOf(i.text),
              text: i.text,
              item: i,
            }))
        : [],
    );
    phases.push({ title: b.text, blocks: own, items });
  });
  const all = phases.flatMap((p) => p.items);
  const open = all.filter((i) => i.item.task === 'todo');
  const isOwner = (i: RoadmapItem) => i.text.includes('_owner_');
  return {
    phases,
    total: all.length,
    done: all.filter((i) => i.item.task === 'done').length,
    doing: all.filter((i) => i.item.task === 'doing'),
    next: open.filter((i) => !isOwner(i)),
    owner: open.filter(isOwner),
  };
}

const STATUS: Readonly<Record<NonNullable<ListItem['task']>, string>> = {
  done: 'Done',
  todo: 'To do',
  doing: 'In progress',
};

/** A roadmap item: its status, its first line, its details folded. */
function roadmapItem(item: ListItem, options: RenderOptions): string {
  const head = `<span class="task-mark">${STATUS[item.task ?? 'todo']}</span> ${inline(item.text, options)}`;
  if (item.task === undefined)
    return `<li>${inline(item.text, options)}${render(item.children, options)}</li>`;
  const details =
    item.children.length === 0
      ? ''
      : `<details><summary>Details</summary>${render(item.children, options)}</details>`;
  return `<li class="task task-${item.task}">${head}${details}</li>`;
}

function phaseBlocks(blocks: readonly Block[], options: RenderOptions): string {
  return blocks
    .map((b) =>
      b.type === 'list' && b.items.some((i) => i.task !== undefined)
        ? `<ul class="items">${b.items.map((i) => roadmapItem(i, options)).join('')}</ul>`
        : render([b], { ...options, shift: 1 }),
    )
    .join('\n');
}

/** Items grouped under their phase, which links to its section. */
function itemList(items: readonly RoadmapItem[], id: string): string {
  const phases = [...new Set(items.map((i) => i.phase))];
  return `<div class="state" id="${attribute(id)}">${phases
    .map(
      (phase) =>
        `<p class="state-phase"><a href="#${attribute(slug(phase))}">${text(plain(phase))}</a></p><ul class="short">${items
          .filter((i) => i.phase === phase)
          .map((i) => `<li>${text(i.title)}</li>`)
          .join('')}</ul>`,
    )
    .join('')}</div>`;
}

/** `docs/roadmap.md` as a page: the state first, then each phase. */
export function roadmapPage(
  markdown: string,
  assets: Assets,
  locale: Locale = 'en',
): string {
  const blocks = parse(markdown);
  const summary = roadmapSummary(blocks);
  const options = optionsFor('docs/roadmap.md');
  const firstPhase = blocks.findIndex(
    (b) => b.type === 'heading' && b.text.startsWith('Phase '),
  );
  const intro = blocks.slice(1, firstPhase === -1 ? undefined : firstPhase);
  // What follows the phases, such as "After 1.0".
  const afterAt = blocks.findIndex(
    (b, k) =>
      firstPhase !== -1 &&
      k > firstPhase &&
      b.type === 'heading' &&
      b.level === 2 &&
      !b.text.startsWith('Phase '),
  );
  const after = afterAt === -1 ? [] : blocks.slice(afterAt);
  const progress = summary.phases
    .map((p) => {
      const done = p.items.filter((i) => i.item.task === 'done').length;
      return `<li><a href="#${attribute(slug(p.title))}">${inline(p.title, options)}</a><progress max="${p.items.length}" value="${done}" aria-label="${attribute(`${plain(p.title)}: ${done} of ${p.items.length} done`)}"></progress><span class="count">${done} of ${p.items.length}</span></li>`;
    })
    .join('');
  const phases = summary.phases
    .map(
      (
        p,
      ) => `<section class="phase" aria-labelledby="${attribute(slug(p.title))}">
<h2 id="${attribute(slug(p.title))}">${inline(p.title, options)}</h2>
${phaseBlocks(p.blocks, options)}
</section>`,
    )
    .join('\n');
  const english = `<h2 id="state">Where it stands</h2>
<ul class="phases-progress">${progress}</ul>
${summary.doing.length === 0 ? '' : `<h3 id="doing">In progress</h3>${itemList(summary.doing, 'doing-items')}`}
<h3 id="next">Next</h3>
${summary.next.length === 0 ? '<p>Nothing is waiting to be picked up.</p>' : itemList(summary.next, 'next-items')}
<h3 id="owner">Waiting for the owner</h3>
<p>Names, publishing and accounts are the owner’s to decide; these items wait for that.</p>
${itemList(summary.owner, 'owner-items')}
<h2 id="how">How it is worked</h2>
${render(intro, { ...options, shift: 1 })}
${phases}
${render(after, options)}`;
  const source = sourceLink('docs/roadmap.md', 'docs/roadmap.md');
  return locale === 'en'
    ? projectPage(
        'Roadmap',
        'What is done, what comes next and what waits for the owner on the way to algomotion 1.0, built from the repository’s roadmap.',
        `<p class="lede">The way to 1.0: ${summary.done} of ${summary.total} items done. Built from ${source}, where each item names its pull requests and design records.</p>
${english}`,
        assets,
        locale,
        'roadmap/',
      )
    : projectPage(
        '路线图',
        '通往 algomotion 1.0 的路线图：哪些已经完成，接下来做什么，哪些在等项目所有者决定。取自仓库的路线图。',
        `<p class="lede">通往 1.0 的路线：${summary.total} 项中已完成 ${summary.done} 项。内容取自 ${source}，每一项都注明了对应的拉取请求和设计决策记录。</p>
${ENGLISH_NOTE}
<div lang="en">
${english}
</div>`,
        assets,
        locale,
        'roadmap/',
      );
}

/* ── Contributing ──────────────────────────────────────────────────── */

/** The issue forms in `.github/ISSUE_TEMPLATE/`. */
export const ISSUE_FORMS: readonly {
  readonly file: string;
  readonly title: string;
  readonly when: string;
}[] = [
  {
    file: 'bug.yml',
    title: 'Something does not work',
    when: 'A command fails, the player breaks, a package will not compile, or an algorithm gives a wrong answer.',
  },
  {
    file: 'drawing.yml',
    title: 'A figure looks wrong',
    when: 'Text overlaps, a mark is in the wrong place, a theme is hard to read, or a step does not show what its narration says.',
  },
  {
    file: 'algorithm.yml',
    title: 'Ask for an algorithm',
    when: 'An algorithm or data structure you would like to see, with the input you would give it.',
  },
];

/** The essentials of `CONTRIBUTING.md`, with ways to report problems. */
export function contributingPage(
  markdown: string,
  assets: Assets,
  locale: Locale = 'en',
): string {
  if (locale === 'zh') return contributingZh(markdown, assets);
  const blocks = parse(markdown);
  const options = { ...optionsFor('CONTRIBUTING.md'), shift: 1 };
  const take = (title: string) => {
    try {
      return render(section(blocks, title), options);
    } catch (error) {
      throw new Error(
        `CONTRIBUTING.md: the contributing page needs the section "${title}"`,
        { cause: error },
      );
    }
  };
  const forms = ISSUE_FORMS.map(
    (f) =>
      `<li><a href="${attribute(`${REPOSITORY}/issues/new?template=${f.file}`)}">${text(f.title)}</a><p>${text(f.when)}</p></li>`,
  ).join('');
  return projectPage(
    'Contributing',
    'How to report a problem with algomotion, ask for an algorithm, or add one yourself.',
    `<p class="lede">algomotion is built in the open on GitHub. Reports of what goes wrong, requests for algorithms, and pull requests are all welcome. The full notes are in ${sourceLink('CONTRIBUTING.md', 'CONTRIBUTING.md')}; this page has the essentials.</p>
<h2 id="report">Report a problem</h2>
<p>Each kind of report has a short form that asks for what is needed to reproduce it. Search the <a href="${REPOSITORY}/issues">open issues</a> first; a figure or a share link of what you saw helps more than a description.</p>
<ul class="forms">${forms}</ul>
<h2 id="setup">Set up the repository</h2>
${take('Setup')}
<h2 id="algorithm">Add an algorithm</h2>
${take('Adding an algorithm')}
<h2 id="pull-requests">Send a pull request</h2>
<p>Open the pull request against <code>main</code>. Its template asks for the roadmap item, how you checked the change, and screenshots for anything drawn. <code>npm run check</code> runs what CI runs first; changes to the player or the site also need <code>npm run test:e2e</code>.</p>
${take('Git workflow')}
<p>Changes to the protocol, a new structure kind or a public interface start with a design record in <a href="${REPOSITORY}/tree/main/docs/adr">docs/adr</a>. The <a href="${ROOT}roadmap/">roadmap</a> shows what is planned.</p>
<aside class="note"><p>algomotion is free software under the GNU General Public License, version 3 or later (<a href="${REPOSITORY}/blob/main/LICENSE">LICENSE</a>). Contributions are accepted under the same licence. The bundled fonts keep their own licence, the SIL Open Font License.</p></aside>`,
    assets,
    locale,
    'contributing/',
  );
}

/** The Chinese issue forms' descriptions; the forms themselves are English. */
const FORMS_ZH: Readonly<Record<string, { title: string; when: string }>> = {
  'bug.yml': {
    title: '某个功能出错了',
    when: '命令失败、播放器出错、包编译不过，或者算法给出了错误的结果。',
  },
  'drawing.yml': {
    title: '某幅图画得不对',
    when: '文字重叠、标记位置不对、主题看不清，或者某一步画出来的和它的解说对不上。',
  },
  'algorithm.yml': {
    title: '想要一个算法',
    when: '你希望看到的算法或数据结构，以及你会给它的输入。',
  },
};

/**
 * The contributing page in Chinese. The steps follow `CONTRIBUTING.md`;
 * its sections are checked to exist, so a renamed one fails the build in
 * both languages, and the commands are the file's own.
 */
function contributingZh(markdown: string, assets: Assets): string {
  const blocks = parse(markdown);
  for (const title of ['Setup', 'Adding an algorithm', 'Git workflow'])
    if (section(blocks, title).length === 0)
      throw new Error(`CONTRIBUTING.md: the section "${title}" is empty`);
  const setup = section(blocks, 'Setup').find((b) => b.type === 'code');
  const forms = ISSUE_FORMS.map(
    (f) =>
      `<li><a href="${attribute(`${REPOSITORY}/issues/new?template=${f.file}`)}">${text(FORMS_ZH[f.file]!.title)}</a><p>${text(FORMS_ZH[f.file]!.when)}</p></li>`,
  ).join('');
  const contributing = sourceLink('CONTRIBUTING.md', 'CONTRIBUTING.md');
  return projectPage(
    '参与贡献',
    '如何报告 algomotion 的问题、请求新的算法，或者自己动手加一个。',
    `<p class="lede">algomotion 在 GitHub 上公开开发。欢迎报告问题、请求算法，也欢迎直接提交拉取请求。完整说明在 ${contributing} 里（英文），本页是要点。</p>
<h2 id="report">报告问题</h2>
<p>每类问题都有一个简短的表单，问的是复现问题所需的信息。表单是英文的，用中文填写也可以。提交前先搜一下<a href="${REPOSITORY}/issues">已有的 issue</a>；附上你看到的图或分享链接，比文字描述更有用。</p>
<ul class="forms">${forms}</ul>
<h2 id="setup">准备仓库</h2>
<p>需要 Node.js 22.12 或更高版本（见 <code>.nvmrc</code>）和 npm，其余都是开发依赖。只有跑 E2E 测试时才需要安装 Chromium。</p>
${setup === undefined || setup.type !== 'code' ? '' : `<pre tabindex="0"><code>${text(setup.code)}</code></pre>`}
<h2 id="algorithm">添加一个算法</h2>
<p>每个算法，以及数据结构的每个操作，都是 <code>@algomotion/recipes</code> 注册表里的一个模块。MCP、命令行和 playground 都读这个注册表，所以加一个模块不需要改别处。</p>
<ol>
<li><strong>模块：</strong>新建 <code>packages/recipes/src/algorithms/&lt;topic&gt;/&lt;id&gt;.ts</code>，导出用 <code>defineAlgorithm</code> 定义的模块：
<ul>
<li>kebab-case 的 <code>id</code>、<code>title</code>、<code>topic</code>，以及一句话的 <code>summary</code>；</li>
<li>Zod 写的 <code>input</code> 模式和若干 <code>examples</code>，第一个示例是菜单里的默认值，也是不给输入时运行的那个。列表、图和操作序列通过 <code>listField</code>、<code>Graph</code> 和 <code>defineStructure</code> 支持对应的记法；</li>
<li>伪代码（CLRS 的约定，下标从 0 开始，用自己的话写）和 Python 两种 <code>code</code>，在步骤指向的行上加 <code>// @name</code> 和 <code># @name</code> 标记；</li>
<li><code>run(input, trace)</code>：用 <code>trace.add</code> 声明结构，每一步以 <code>trace.step(anchor, narration)</code> 开始。解说要说出具体的值，不要描述某种语言的语法。模块画不了的输入，抛出 <code>RangeError</code>。</li>
</ul>
数据结构放在 <code>packages/recipes/src/structures/&lt;name&gt;/</code>，用 <code>defineStructure</code> 定义。</li>
<li><strong>注册：</strong>把模块加进 <code>packages/recipes/src/registry.ts</code> 的 <code>algorithms</code>，放在它所属领域旁边。</li>
<li><strong>测试：</strong><code>tests/registry.spec.ts</code> 会检查每个模块（示例、锚点、解说、步骤名、确定性）。再为它写一个对照独立参考实现的测试，并在 <code>tests/properties.spec.ts</code> 里加性质测试。</li>
<li><strong>亲眼看看：</strong>在 playground 里打开它，两种语言都看一遍。</li>
</ol>
<h2 id="pull-requests">提交拉取请求</h2>
<p>拉取请求的目标分支是 <code>main</code>。模板会问对应的路线图条目、你怎么检查的改动，以及画出来的东西的截图。<code>npm run check</code> 跑的就是 CI 最先跑的那些检查；改了播放器或网站，还要跑 <code>npm run test:e2e</code>。</p>
<ul>
<li>在功能分支上开发，CI 通过后再合并。</li>
<li>提交信息采用 <code>type(scope): description</code> 的格式，比如 <code>feat(spec): add tree actions</code>；类型有 <code>feat</code>、<code>fix</code>、<code>docs</code>、<code>test</code>、<code>refactor</code> 和 <code>chore</code>。</li>
</ul>
<p>改协议、加新的结构种类或改公开接口，都要先在 <a href="${REPOSITORY}/tree/main/docs/adr">docs/adr</a> 里写一份设计决策记录。计划中的工作见<a href="${ROOT}roadmap/">路线图</a>。</p>
<aside class="note"><p>algomotion 是自由软件，采用 GNU 通用公共许可证第 3 版或更高版本（<a href="${REPOSITORY}/blob/main/LICENSE">LICENSE</a>）。贡献的代码也以同一许可证接收。随附的字体保留各自的许可证，即 SIL 开放字体许可证。</p></aside>`,
    assets,
    'zh',
    'contributing/',
  );
}
