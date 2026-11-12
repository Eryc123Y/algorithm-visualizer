/**
 * The snippets of each documentation page (roadmap 3.4): the same run in
 * a web page, Typst, LaTeX, the command line, MCP and a share link. Each
 * one's input must run to the example's document.
 */
import { algorithms, readInput, runAlgorithm } from '@algoviz/recipes';
import { readShareFragment } from '@algoviz/spec';
import { describe, expect, it } from 'vitest';

import { shortInput } from '../../src/docs/short-input.ts';
import {
  inputText,
  latexText,
  shellQuote,
  snippetsFor,
  typstValue,
  type Snippet,
} from '../../src/docs/snippets.ts';

const documentOf = (id: string, input: unknown) => {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(`${id}: ${JSON.stringify(run.error)}`);
  return JSON.stringify(run.value.document);
};

const byId = (snippets: readonly Snippet[], id: Snippet['id']) =>
  snippets.find((s) => s.id === id)!.code;

describe('inputText', () => {
  it('keeps a notation, and writes an object without its braces', () => {
    expect(inputText('A-B 4, B-C 1')).toBe('A-B 4, B-C 1');
    expect(inputText({ from: '8 3 10', key: 3 })).toBe(
      '"from": "8 3 10", "key": 3',
    );
    expect(inputText([1, 2])).toBe('[1,2]');
    expect(inputText('7')).toBe('"7"');
  });
});

describe('typstValue', () => {
  it('writes JSON values as Typst values', () => {
    expect(typstValue('a "b" \\ c\nd')).toBe('"a \\"b\\" \\\\ c\\nd"');
    expect(typstValue(3)).toBe('3');
    expect(typstValue(-2.5)).toBe('-2.5');
    expect(typstValue(true)).toBe('true');
    expect(typstValue(null)).toBe('none');
    expect(typstValue([])).toBe('()');
    expect(typstValue([1])).toBe('(1,)');
    expect(typstValue([1, [2, 3]])).toBe('(1, (2, 3))');
    expect(typstValue({})).toBe('(:)');
    expect(typstValue({ from: '8 3', key: 3 })).toBe('(from: "8 3", key: 3)');
    expect(typstValue({ 'a b': 1, in: 2, replaceWith: 'x' })).toBe(
      '("a b": 1, "in": 2, replaceWith: "x")',
    );
    expect(typstValue({ '1st': 1, 'find-set': 2, none: 3 })).toBe(
      '("1st": 1, find-set: 2, "none": 3)',
    );
  });
});

describe('latexText', () => {
  it('escapes what TeX would read otherwise', () => {
    expect(latexText('A-B 4, B-C 1')).toBe('A-B 4, B-C 1');
    expect(latexText('50% of #1')).toBe('50\\% of \\#1');
    expect(latexText('"from": {"t": 3}')).toBe('"from": {"t": 3}');
    expect(latexText('"text": "{["')).toBe('"text": "\\{["');
    expect(latexText('"text": "}{"')).toBe('"text": "\\}\\{"');
    expect(latexText('"text": "{50% #1"')).toBe('"text": "\\{50\\% \\#1"');
  });
});

describe('shellQuote', () => {
  it('quotes for a POSIX shell', () => {
    expect(shellQuote('A-B 4')).toBe("'A-B 4'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    // The command takes the word after --input as its value, dash or not.
    expect(shellQuote('-3 5 2')).toBe("'-3 5 2'");
  });
});

describe('snippetsFor', () => {
  it('shows Dijkstra’s algorithm in every output', async () => {
    const snippets = await snippetsFor(
      'dijkstra',
      'A-B 4, B-C 1',
      1,
      'improve#2',
    );
    expect(snippets.find((s) => s.id === 'cli')!.note).toContain(
      '--step improve#2',
    );
    expect(snippets.map((s) => s.id)).toEqual([
      'web',
      'typst',
      'latex',
      'cli',
      'mcp',
      'link',
    ]);
    expect(byId(snippets, 'web')).toBe(
      '<script type="module" src="algoviz-player.js"></script>\n<algo-player algorithm="dijkstra" input="A-B 4, B-C 1"></algo-player>',
    );
    expect(byId(snippets, 'typst')).toBe(
      '#import "@preview/algoviz:0.1.0": algoviz\n#algoviz("dijkstra", "A-B 4, B-C 1")',
    );
    expect(byId(snippets, 'latex')).toBe(
      '\\usepackage{algoviz}\n\\algoviz{dijkstra}{A-B 4, B-C 1}',
    );
    expect(byId(snippets, 'cli')).toBe(
      "algoviz export dijkstra --input 'A-B 4, B-C 1' --out figures",
    );
    expect(
      JSON.parse(byId(snippets, 'mcp').replace(/^algoviz_show /, '')),
    ).toEqual({ recipe: 'dijkstra', input: 'A-B 4, B-C 1' });
    expect(byId(snippets, 'link')).toBe(
      '../play/#v=1&alg=dijkstra&in=A-B%204%2C%20B-C%201',
    );
  });

  it('gives a structured input to the player as inline JSON, safely', async () => {
    const web = byId(
      await snippetsFor('bst.delete', { from: '8 3', key: '</script>' }, 2),
      'web',
    );
    expect(web).toContain('<algo-player algorithm="bst.delete">');
    expect(web).toContain('<script type="application/json">');
    expect(web).not.toContain('"</script>"');
    expect(web).toContain('\\u003c/script>');
  });

  it('escapes the player’s attributes', async () => {
    const web = byId(await snippetsFor('x', 'a "b" & <c>', 0), 'web');
    expect(web).toContain('input="a &quot;b&quot; &amp; &lt;c>"');
  });

  it('runs every example the same in every snippet', async () => {
    for (const a of algorithms) {
      const example = a.examples[0];
      const expected = documentOf(a.id, example);
      const input = shortInput(a.id, example);
      const snippets = await snippetsFor(a.id, input, 1);

      // The command line, the LaTeX package (which calls it) and the
      // player's attribute read the input as text.
      const cli = /--input '((?:[^']|'\\'')*)'/.exec(byId(snippets, 'cli'))!;
      const text = cli[1]!.replaceAll("'\\''", "'");
      const read = readInput(text);
      expect(read.ok, a.id).toBe(true);
      if (read.ok) expect(documentOf(a.id, read.value), a.id).toBe(expected);
      expect(
        byId(snippets, 'latex')
          .split('\n')[1]!
          .replace(/^\\algoviz\{[^}]*\}\{/, '')
          .replace(/\}$/, '')
          .replace(/\\([%#{}])/g, '$1'),
        a.id,
      ).toBe(text);

      // MCP takes JSON values.
      const mcp = JSON.parse(
        byId(snippets, 'mcp').replace(/^algoviz_show /, ''),
      );
      expect(documentOf(a.id, mcp.input), a.id).toBe(expected);

      // The share link carries the input as text.
      const link = await readShareFragment(
        byId(snippets, 'link').split('#')[1]!,
      );
      expect(link.ok && link.value, a.id).toMatchObject({ algorithm: a.id });
      if (link.ok && link.value !== undefined && 'algorithm' in link.value) {
        const linked = readInput(link.value.input ?? '');
        expect(linked.ok && documentOf(a.id, linked.value), a.id).toBe(
          expected,
        );
      }
    }
  });
});
