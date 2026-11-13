/**
 * The project pages (roadmap 5.5): the changelog, the roadmap and the
 * contributing page. Each is built from a file of the repository at build
 * time, so the site says what the repository says: `CHANGELOG.md`,
 * `docs/roadmap.md` and `CONTRIBUTING.md`.
 */
import { attribute, page, REPOSITORY, text, type Assets } from './html.ts';
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

const crumbs = (title: string): string =>
  `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${ROOT}">algomotion</a></li><li aria-current="page">${text(title)}</li></ol></nav>`;

function projectPage(
  title: string,
  description: string,
  body: string,
  assets: Assets,
): string {
  return page({
    title: `${title} · algomotion`,
    description,
    root: ROOT,
    assets,
    section: 'project',
    layout: 'project',
    body: `${crumbs(title)}
<article class="guide-body project-body">
<h1>${text(title)}</h1>
${body}
</article>`,
  });
}

/* ── The changelog ─────────────────────────────────────────────────── */

/** `CHANGELOG.md` as a page; its own title gives way to the page's. */
export function changelogPage(markdown: string, assets: Assets): string {
  const blocks = parse(markdown);
  const body = blocks[0]?.type === 'heading' ? blocks.slice(1) : blocks;
  return projectPage(
    'Changelog',
    'What has changed in algomotion, by phase of the roadmap, from the repository’s CHANGELOG.md.',
    `<p class="lede">What changed in each phase of the roadmap, newest first. Built from ${sourceLink('CHANGELOG.md', 'CHANGELOG.md')} in the repository.</p>
${render(body, optionsFor('CHANGELOG.md'))}`,
    assets,
  );
}

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

const itemList = (items: readonly RoadmapItem[], options: RenderOptions) =>
  `<ul class="short">${items
    .map(
      (i) =>
        `<li><a href="#${attribute(slug(i.phase))}">${text(i.phase.replace(/:.*/, ''))}</a>: ${inline(/^\*\*.+?\*\*/.exec(i.text)?.[0] ?? i.text, options)}</li>`,
    )
    .join('')}</ul>`;

/** `docs/roadmap.md` as a page: the state first, then each phase. */
export function roadmapPage(markdown: string, assets: Assets): string {
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
  return projectPage(
    'Roadmap',
    'What is done, what comes next and what waits for the owner on the way to algomotion 1.0, built from the repository’s roadmap.',
    `<p class="lede">The way to 1.0: ${summary.done} of ${summary.total} items done. Built from ${sourceLink('docs/roadmap.md', 'docs/roadmap.md')}, where each item names its pull requests and design records.</p>
<h2 id="state">Where it stands</h2>
<ul class="phases-progress">${progress}</ul>
${summary.doing.length === 0 ? '' : `<h3 id="doing">In progress</h3>${itemList(summary.doing, options)}`}
<h3 id="next">Next</h3>
${summary.next.length === 0 ? '<p>Nothing is waiting to be picked up.</p>' : itemList(summary.next, options)}
<h3 id="owner">Waiting for the owner</h3>
<p>Names, publishing and accounts are the owner’s to decide; these items wait for that.</p>
${itemList(summary.owner, options)}
<h2 id="how">How it is worked</h2>
${render(intro, { ...options, shift: 1 })}
${phases}
${render(after, options)}`,
    assets,
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
export function contributingPage(markdown: string, assets: Assets): string {
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
<aside class="note"><p>The licence is still to be chosen: the repository has no LICENSE file yet.</p></aside>`,
    assets,
  );
}
