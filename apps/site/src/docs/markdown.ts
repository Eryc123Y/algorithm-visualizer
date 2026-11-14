/**
 * A small Markdown subset, enough for the repository's own files that the
 * project pages are built from: `CHANGELOG.md`, `docs/roadmap.md` and
 * `CONTRIBUTING.md` (roadmap 5.5). It reads headings, paragraphs, nested
 * lists with task marks, tables, fenced code and rules; inline, code
 * spans, bold, italics, links and pull request numbers.
 *
 * Nothing it reads becomes markup: text goes through `text`, link
 * targets through `attribute`, and a link whose scheme is not http(s) is
 * written as its text. Raw HTML in the source is shown as text. It runs
 * at build time only, so the site needs no Markdown library.
 */
import { attribute, text } from './html.ts';

export type Task = 'done' | 'todo' | 'doing';

export interface ListItem {
  /** `[x]`, `[ ]` or `[~]` at the start of the item. */
  readonly task?: Task;
  /** The item's first line, as inline Markdown. */
  readonly text: string;
  /** What is indented under it. */
  readonly children: readonly Block[];
}

export type Block =
  | { readonly type: 'heading'; readonly level: number; readonly text: string }
  | { readonly type: 'paragraph'; readonly text: string }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly ListItem[];
    }
  | {
      readonly type: 'table';
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly type: 'code'; readonly lang: string; readonly code: string }
  | { readonly type: 'rule' };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM = /^( *)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^ *(```|~~~)\s*([\w-]*)\s*$/;
const RULE = /^ *([-*_])( *\1){2,} *$/;
const TABLE_RULE = /^ *\|?( *:?-+:? *\|)+( *:?-+:? *)?\|? *$/;
const TASK = /^\[([ xX~])\]\s+/;

const indentOf = (line: string): number => /^ */.exec(line)![0].length;
const blank = (line: string): boolean => line.trim() === '';

/** The cells of a table row; a `|` inside code or after `\` is text. */
function cells(line: string): string[] {
  const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out: string[] = [];
  let cell = '';
  let code = false;
  for (let k = 0; k < row.length; k++) {
    const c = row[k]!;
    if (c === '\\' && row[k + 1] === '|') {
      cell += '|';
      k++;
    } else if (c === '`') {
      code = !code;
      cell += c;
    } else if (c === '|' && !code) {
      out.push(cell.trim());
      cell = '';
    } else cell += c;
  }
  out.push(cell.trim());
  return out;
}

/** Does `line` start a block other than a paragraph? */
function startsBlock(line: string, next: string | undefined): boolean {
  return (
    HEADING.test(line) ||
    ITEM.test(line) ||
    FENCE.test(line) ||
    RULE.test(line) ||
    (line.trim().startsWith('|') && next !== undefined && TABLE_RULE.test(next))
  );
}

/** The lines of a list starting at `start`, and where it ends. */
function readList(
  lines: readonly string[],
  start: number,
): { block: Block; end: number } {
  const first = ITEM.exec(lines[start]!)!;
  const indent = first[1]!.length;
  const ordered = /\d/.test(first[2]!);
  const items: ListItem[] = [];
  let k = start;
  while (k < lines.length) {
    const m = ITEM.exec(lines[k]!);
    if (m === null || m[1]!.length !== indent || /\d/.test(m[2]!) !== ordered)
      break;
    const content = indent + m[2]!.length + 1;
    const body: string[] = [];
    k++;
    // The item's own lines: indented past its marker, or blank lines
    // followed by such a line.
    while (k < lines.length) {
      const line = lines[k]!;
      if (blank(line)) {
        let j = k;
        while (j < lines.length && blank(lines[j]!)) j++;
        if (j < lines.length && indentOf(lines[j]!) >= content) {
          body.push(...lines.slice(k, j));
          k = j;
          continue;
        }
        break;
      }
      if (indentOf(line) <= indent) break;
      body.push(line);
      k++;
    }
    const raw = m[3]!;
    const task = TASK.exec(raw);
    const mark = task?.[1]!.toLowerCase();
    items.push({
      ...(mark === undefined
        ? {}
        : { task: mark === 'x' ? 'done' : mark === '~' ? 'doing' : 'todo' }),
      text: raw.slice(task?.[0].length ?? 0).trim(),
      children: parse(
        body.map((l) => l.slice(Math.min(content, indentOf(l)))).join('\n'),
      ),
    });
    // Blank lines between items of one list.
    let j = k;
    while (j < lines.length && blank(lines[j]!)) j++;
    const again = j < lines.length ? ITEM.exec(lines[j]!) : null;
    if (
      again === null ||
      again[1]!.length !== indent ||
      /\d/.test(again[2]!) !== ordered
    )
      break;
    k = j;
  }
  return { block: { type: 'list', ordered, items }, end: k };
}

/** The blocks of a Markdown text. */
export function parse(source: string): Block[] {
  const lines = source
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n');
  const blocks: Block[] = [];
  let k = 0;
  while (k < lines.length) {
    const line = lines[k]!;
    if (blank(line)) {
      k++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence !== null) {
      const end = lines.findIndex(
        (l, j) => j > k && l.trim().startsWith(fence[1]!),
      );
      const stop = end === -1 ? lines.length : end;
      blocks.push({
        type: 'code',
        lang: fence[2]!,
        code: lines.slice(k + 1, stop).join('\n'),
      });
      k = stop + 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length,
        text: heading[2]!,
      });
      k++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      k++;
      continue;
    }
    if (ITEM.test(line)) {
      const { block, end } = readList(lines, k);
      blocks.push(block);
      k = end;
      continue;
    }
    if (
      line.trim().startsWith('|') &&
      k + 1 < lines.length &&
      TABLE_RULE.test(lines[k + 1]!)
    ) {
      const rows: string[][] = [];
      let j = k + 2;
      while (j < lines.length && lines[j]!.trim().startsWith('|'))
        rows.push(cells(lines[j++]!));
      blocks.push({ type: 'table', head: cells(line), rows });
      k = j;
      continue;
    }
    const para: string[] = [line.trim()];
    k++;
    while (
      k < lines.length &&
      !blank(lines[k]!) &&
      !startsBlock(lines[k]!, lines[k + 1])
    )
      para.push(lines[k++]!.trim());
    blocks.push({ type: 'paragraph', text: para.join(' ') });
  }
  return blocks;
}

/** How inline Markdown becomes HTML. */
export interface InlineOptions {
  /**
   * Rewrites a link's target, or drops the link (its text stays) by
   * returning `undefined`. Targets it returns are still checked.
   */
  readonly link?: (href: string) => string | undefined;
  /** A URL that `#123` is appended to; without it, `#123` stays text. */
  readonly issues?: string;
}

/** A link target that is safe to write: http(s), or no scheme at all. */
function safe(href: string): boolean {
  const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(href);
  return scheme === null
    ? !/^\s/.test(href) && !href.includes('\\')
    : /^https?$/i.test(scheme[1]!) && !/^\s/.test(href);
}

const INLINE =
  /`([^`]+)`|\[([^\]]+)\]\(([^()\s]+)\)|<(https?:\/\/[^\s<>]+)>|\*\*(.+?)\*\*|(?<![\p{L}\p{N}_*])\*(?!\s)([^*]+?)\*(?![\p{L}\p{N}_*])|(?<![\p{L}\p{N}_])_(?!\s)([^_]+?)_(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_&/#])#(\d+)\b/gu;

/**
 * Inline Markdown as HTML. Inside a link's label (`inLink`), links and
 * pull request numbers stay text, as anchors cannot nest.
 */
export function inline(
  source: string,
  options: InlineOptions = {},
  inLink = false,
): string {
  const anchor = (href: string, label: string): string => {
    if (inLink) return label;
    const target = options.link === undefined ? href : options.link(href);
    return target === undefined || !safe(target)
      ? label
      : `<a href="${attribute(target)}">${label}</a>`;
  };
  let out = '';
  let last = 0;
  for (const m of source.matchAll(INLINE)) {
    out += text(source.slice(last, m.index));
    last = m.index + m[0].length;
    const [, code, label, href, auto, strong, star, under, issue] = m;
    if (code !== undefined) out += `<code>${text(code)}</code>`;
    else if (label !== undefined)
      out += anchor(href!, inline(label, options, true));
    else if (auto !== undefined) out += anchor(auto, text(auto));
    else if (strong !== undefined)
      out += `<strong>${inline(strong, options, inLink)}</strong>`;
    else if (star !== undefined || under !== undefined)
      out += `<em>${inline((star ?? under)!, options, inLink)}</em>`;
    else if (options.issues === undefined || inLink) out += text(m[0]);
    else out += anchor(`${options.issues}${issue!}`, `#${issue!}`);
  }
  return out + text(source.slice(last));
}

/** Inline Markdown as plain text: markup gone, links as their text. */
export const plain = (source: string): string =>
  source
    .replace(/\[([^\]]+)\]\([^()\s]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<![\p{L}\p{N}])[_*]([^_*]+)[_*](?![\p{L}\p{N}])/gu, '$1')
    .trim();

/** A heading's id: lower case, letters and digits joined by `-`. */
export const slug = (source: string): string =>
  plain(source)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface RenderOptions extends InlineOptions {
  /** Added to every heading's level, up to 6. */
  readonly shift?: number;
}

const TASK_WORDS: Readonly<Record<Task, string>> = {
  done: 'Done',
  todo: 'To do',
  doing: 'In progress',
};

/** One list item; the roadmap page draws its own. */
export function renderItem(
  item: ListItem,
  options: RenderOptions = {},
): string {
  const body = inline(item.text, options);
  const children =
    item.children.length === 0 ? '' : render(item.children, options);
  return item.task === undefined
    ? `<li>${body}${children}</li>`
    : `<li class="task task-${item.task}"><span class="task-mark">${TASK_WORDS[item.task]}</span> ${body}${children}</li>`;
}

/** Blocks as HTML. Heading ids are unique within one call. */
export function render(
  blocks: readonly Block[],
  options: RenderOptions = {},
  ids: Map<string, number> = new Map(),
): string {
  const idFor = (source: string): string => {
    const base = slug(source) || 'section';
    const n = (ids.get(base) ?? 0) + 1;
    ids.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading': {
          const level = Math.min(6, b.level + (options.shift ?? 0));
          return `<h${level} id="${attribute(idFor(b.text))}">${inline(b.text, options)}</h${level}>`;
        }
        case 'paragraph':
          return `<p>${inline(b.text, options)}</p>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((i) => renderItem(i, options)).join('')}</${tag}>`;
        }
        case 'table':
          return `<div class="scroll" role="region" aria-label="Table" tabindex="0"><table><thead><tr>${b.head
            .map((c) => `<th scope="col">${inline(c, options)}</th>`)
            .join('')}</tr></thead><tbody>${b.rows
            .map(
              (r) =>
                `<tr>${r.map((c) => `<td>${inline(c, options)}</td>`).join('')}</tr>`,
            )
            .join('')}</tbody></table></div>`;
        case 'code':
          return `<pre tabindex="0"><code>${text(b.code)}</code></pre>`;
        case 'rule':
          return '<hr />';
      }
    })
    .join('\n');
}

/**
 * The blocks under the heading whose plain text is `title`, up to the
 * next heading of the same or a higher level. Throws if there is none,
 * so a renamed section fails the build rather than vanishing.
 */
export function section(blocks: readonly Block[], title: string): Block[] {
  const at = blocks.findIndex(
    (b) => b.type === 'heading' && plain(b.text) === title,
  );
  if (at === -1) throw new Error(`no section "${title}"`);
  const level = (blocks[at] as { level: number }).level;
  const end = blocks.findIndex(
    (b, k) => k > at && b.type === 'heading' && b.level <= level,
  );
  return blocks.slice(at + 1, end === -1 ? undefined : end);
}

/**
 * A link resolver for a file of the repository: relative links point at
 * the file they name on GitHub, anchors and absolute links stay.
 */
export function repositoryLinks(
  repository: string,
  file: string,
): (href: string) => string {
  return (href) => {
    if (href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
    const url = new URL(href, `https://repo.invalid/${file}`);
    const path = url.pathname.slice(1);
    const kind = path === '' || path.endsWith('/') ? 'tree' : 'blob';
    return `${repository}/${kind}/main/${path}${url.hash}`;
  };
}
