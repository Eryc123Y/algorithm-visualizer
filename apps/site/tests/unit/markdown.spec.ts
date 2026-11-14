/**
 * The Markdown subset the project pages are built from (roadmap 5.5):
 * everything it reads is escaped, and only safe links become links.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  inline,
  parse,
  plain,
  render,
  repositoryLinks,
  section,
  slug,
  type Block,
} from '../../src/docs/markdown.ts';

const html = (md: string) => render(parse(md));

describe('blocks', () => {
  it('reads headings, paragraphs, rules and fenced code', () => {
    expect(parse('# Title\n\nOne\ntwo.\n\n---\n\n```sh\na < b\n```\n')).toEqual(
      [
        { type: 'heading', level: 1, text: 'Title' },
        { type: 'paragraph', text: 'One two.' },
        { type: 'rule' },
        { type: 'code', lang: 'sh', code: 'a < b' },
      ],
    );
  });

  it('nests lists by indentation, and reads task marks', () => {
    const [list] = parse(
      '- [x] **Done** (#4).\n  - a detail\n  - another\n- [ ] Next\n- [~] Doing\n- plain',
    ) as [Block & { type: 'list' }];
    expect(list.type).toBe('list');
    expect(list.items.map((i) => i.task)).toEqual([
      'done',
      'todo',
      'doing',
      undefined,
    ]);
    expect(list.items[0]!.text).toBe('**Done** (#4).');
    expect(list.items[0]!.children).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          { text: 'a detail', children: [] },
          { text: 'another', children: [] },
        ],
      },
    ]);
  });

  it('keeps a numbered list together across blank lines and indented paragraphs', () => {
    const blocks = parse(
      '1. First:\n   - a\n\n   More about the first.\n\n2. Second.\n\nAfter.',
    );
    expect(blocks).toHaveLength(2);
    const list = blocks[0] as Block & { type: 'list' };
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(2);
    expect(list.items[0]!.children.map((b) => b.type)).toEqual([
      'list',
      'paragraph',
    ]);
    expect(blocks[1]).toEqual({ type: 'paragraph', text: 'After.' });
  });

  it('reads a table, with escaped pipes inside code', () => {
    expect(parse('| A | B |\n| --- | :-: |\n| `x` | y |\n| 1 | 2 |')).toEqual([
      {
        type: 'table',
        head: ['A', 'B'],
        rows: [
          ['`x`', 'y'],
          ['1', '2'],
        ],
      },
    ]);
  });

  it('renders tasks with a word as well as a mark, not by colour alone', () => {
    const out = html('- [x] a\n- [ ] b\n- [~] c');
    expect(out).toContain(
      '<li class="task task-done"><span class="task-mark">Done</span> a',
    );
    expect(out).toContain('<span class="task-mark">To do</span> b');
    expect(out).toContain('<span class="task-mark">In progress</span> c');
  });

  it('gives headings unique ids, and can shift their level', () => {
    const out = render(parse('## A b\n\n## A b\n\n### C'), { shift: 1 });
    expect(out).toContain('<h3 id="a-b">A b</h3>');
    expect(out).toContain('<h3 id="a-b-2">A b</h3>');
    expect(out).toContain('<h4 id="c">C</h4>');
  });

  it('wraps tables so they scroll instead of widening the page', () => {
    expect(html('| a |\n| - |\n| b |')).toMatch(
      /^<div class="scroll" role="region" aria-label="Table" tabindex="0"><table>/,
    );
  });
});

describe('inline', () => {
  it('reads code, bold, italics and links', () => {
    expect(
      inline(
        '`a<b` **bold** _it_ *em* [the guide](guide.md) <https://x.org/a>',
      ),
    ).toBe(
      '<code>a&lt;b</code> <strong>bold</strong> <em>it</em> <em>em</em> <a href="guide.md">the guide</a> <a href="https://x.org/a">https://x.org/a</a>',
    );
  });

  it('leaves underscores inside words and code alone', () => {
    expect(inline('snake_case_name and `a_b_`')).toBe(
      'snake_case_name and <code>a_b_</code>',
    );
  });

  it('links pull request numbers only when asked to', () => {
    expect(inline('(#14, #15)')).toBe('(#14, #15)');
    expect(inline('(#14) and `#15`', { issues: 'https://g/r/pull/' })).toBe(
      '(<a href="https://g/r/pull/14">#14</a>) and <code>#15</code>',
    );
  });

  it('turns links with an unsafe scheme into their text', () => {
    for (const href of [
      'javascript:alert`1`',
      'JavaScript:void0',
      'data:text/html,x',
      'vbscript:x',
    ])
      expect(inline(`[click](${href})`)).not.toContain('<a');
  });

  it('lets a resolver rewrite or drop links', () => {
    const link = (href: string) =>
      href.startsWith('#') ? href : href === 'drop' ? undefined : `/x/${href}`;
    expect(inline('[a](#top) [b](y.md) [c](drop)', { link })).toBe(
      '<a href="#top">a</a> <a href="/x/y.md">b</a> c',
    );
  });

  it('never lets markup through, whatever the input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = html(s) + inline(s, { issues: 'https://g/' });
        // Every tag in the output is one the renderer writes.
        const tags = out.match(/<\/?([a-z0-9]+)/g) ?? [];
        for (const t of tags)
          expect([
            'p',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'ul',
            'ol',
            'li',
            'span',
            'code',
            'pre',
            'strong',
            'em',
            'a',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'hr',
            'div',
          ]).toContain(t.replace(/^<\/?/, ''));
        expect(out).not.toMatch(/<a href="\s*(javascript|data|vbscript):/i);
        expect(out).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i);
      }),
      { numRuns: Number(process.env['FUZZ_RUNS'] ?? 200) },
    );
  });

  it('never nests a link inside a link', () => {
    expect(inline('[see [a](b) #3](c)', { issues: 'https://g/' })).not.toMatch(
      /<a [^>]*>(?:(?!<\/a>).)*<a /,
    );
    expect(inline('[**b** #3](c)', { issues: 'https://g/' })).toBe(
      '<a href="c"><strong>b</strong> #3</a>',
    );
  });

  it('escapes quotes in link targets', () => {
    expect(inline('[a](x"onmouseover="y)')).toBe(
      '<a href="x&quot;onmouseover=&quot;y">a</a>',
    );
  });
});

describe('helpers', () => {
  it('slugs headings as the renderer does', () => {
    expect(slug('Phase 0: foundations')).toBe('phase-0-foundations');
    expect(slug('**5.5 Signs of life.**')).toBe('5-5-signs-of-life');
    expect(slug('Ünïcode & co')).toBe('unicode-co');
  });

  it('strips inline markup to plain text', () => {
    expect(plain('**5.1 A** `x` [link](y) _it_')).toBe('5.1 A x link it');
  });

  it('takes a section by its heading, up to the next of its level', () => {
    const blocks = parse('## A\n\na\n\n### A.1\n\nb\n\n## B\n\nc');
    expect(section(blocks, 'A').map((b) => b.type)).toEqual([
      'paragraph',
      'heading',
      'paragraph',
    ]);
    expect(() => section(blocks, 'C')).toThrow(/no section "C"/);
  });

  it('points relative links at the repository, from the file they are in', () => {
    const link = repositoryLinks('https://github.com/o/r', 'docs/roadmap.md');
    expect(link('adr/0021-x.md')).toBe(
      'https://github.com/o/r/blob/main/docs/adr/0021-x.md',
    );
    expect(link('../CONTRIBUTING.md#setup')).toBe(
      'https://github.com/o/r/blob/main/CONTRIBUTING.md#setup',
    );
    expect(link('adr/')).toBe('https://github.com/o/r/tree/main/docs/adr/');
    expect(link('#phase-1')).toBe('#phase-1');
    expect(link('https://example.org/')).toBe('https://example.org/');
  });
});
