import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { highlightCode, type CodeLine } from '../src/index.ts';
import { RUNS } from './properties/random.ts';

/** fast-check settings, deepened with FUZZ_RUNS and replayed with FUZZ_SEED. */
const fuzz = {
  numRuns: RUNS,
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

/** The tokens of one line as `kind:text` pairs, without plain tokens. */
const marked = (line: CodeLine | undefined) =>
  (line ?? [])
    .filter((t) => t.kind !== 'plain')
    .map((t) => `${t.kind}:${t.text}`);

const text = (lines: readonly CodeLine[]) =>
  lines.map((line) => line.map((t) => t.text).join('')).join('\n');

describe('highlightCode', () => {
  it('leaves code in an unknown or missing language plain', () => {
    for (const language of [undefined, 'cobol']) {
      const lines = highlightCode('if x:\n    y = 1', language);
      expect(lines).toEqual([
        [{ kind: 'plain', text: 'if x:' }],
        [{ kind: 'plain', text: '    y = 1' }],
      ]);
    }
  });

  it('marks Python keywords, builtins, definitions, calls and numbers', () => {
    const lines = highlightCode(
      'def bubble_sort(a):\n    for i in range(len(a) - 1):\n        swap(a, i, 0)',
      'python',
    );
    expect(marked(lines[0])).toEqual(['keyword:def', 'function:bubble_sort']);
    expect(marked(lines[1])).toEqual([
      'keyword:for',
      'keyword:in',
      'builtin:range',
      'builtin:len',
      'number:1',
    ]);
    expect(marked(lines[2])).toEqual(['function:swap', 'number:0']);
  });

  it('does not mark attributes that share a builtin name as builtins', () => {
    const lines = highlightCode(
      'nxt = curr.next\nself.max = max(self. max, x)\n"{}".format(n)',
      'python',
    );
    expect(lines.map(marked)).toEqual([
      [],
      ['builtin:max'],
      ['string:"{}"', 'function:format'],
    ]);
  });

  it('accepts py as another name for Python', () => {
    expect(marked(highlightCode('return None', 'py')[0])).toEqual([
      'keyword:return',
      'keyword:None',
    ]);
  });

  it('does not mark keywords or numbers inside identifiers', () => {
    expect(marked(highlightCode('iffy = index + a1', 'python')[0])).toEqual([]);
  });

  it('reads Python number forms as one token each', () => {
    expect(
      marked(highlightCode('x = 1_000 + 0xFF + 1.5e-3 + .5 + 2j', 'python')[0]),
    ).toEqual([
      'number:1_000',
      'number:0xFF',
      'number:1.5e-3',
      'number:.5',
      'number:2j',
    ]);
  });

  it('keeps # inside strings and quotes inside comments apart', () => {
    const [line] = highlightCode('s = "a # b"  # it\'s "fine"', 'python');
    expect(marked(line)).toEqual(['string:"a # b"', 'comment:# it\'s "fine"']);
  });

  it('includes prefixes and escaped quotes in strings', () => {
    const [line] = highlightCode(
      'f"{x}" + rb\'\\d\' + "say \\"hi\\""',
      'python',
    );
    expect(marked(line)).toEqual([
      'string:f"{x}"',
      "string:rb'\\d'",
      'string:"say \\"hi\\""',
    ]);
  });

  it('marks every line of a triple-quoted string', () => {
    const lines = highlightCode('"""Sort.\n\nIn place."""\npass', 'python');
    expect(lines.map(marked)).toEqual([
      ['string:"""Sort.'],
      [],
      ['string:In place."""'],
      ['keyword:pass'],
    ]);
  });

  it('ends an unterminated string at the end of its line', () => {
    const lines = highlightCode('s = "open\nx = 1', 'python');
    expect(marked(lines[0])).toEqual(['string:"open']);
    expect(marked(lines[1])).toEqual(['number:1']);
  });

  it('marks the name after class like a definition', () => {
    expect(marked(highlightCode('class Node:', 'python')[0])).toEqual([
      'keyword:class',
      'function:Node',
    ]);
  });

  describe('agrees with CPython 3.12+ on', () => {
    it('f-string fields that reuse the quote', () => {
      expect(marked(highlightCode('x = f"{d["a"]}"', 'python')[0])).toEqual([
        'string:f"{d["a"]}"',
      ]);
    });

    it('f-string fields that span lines', () => {
      const lines = highlightCode(
        'y = f"{(\n1 +\n2\n)}"\nz = 3  # c',
        'python',
      );
      expect(lines.map(marked)).toEqual([
        ['string:f"{('],
        ['string:1 +'],
        ['string:2'],
        ['string:)}"'],
        ['number:3', 'comment:# c'],
      ]);
    });

    it('t-strings', () => {
      expect(
        marked(highlightCode('t = t"hi {x}" + rt\'\\d\'', 'python')[0]),
      ).toEqual(['string:t"hi {x}"', "string:rt'\\d'"]);
    });

    it('names in any script', () => {
      const lines = highlightCode(
        'π2 = 1\ndef café(): pass\nαin = 数组\nclass Ünï: pass',
        'python',
      );
      expect(lines.map(marked)).toEqual([
        ['number:1'],
        ['keyword:def', 'function:café', 'keyword:pass'],
        [],
        ['keyword:class', 'function:Ünï', 'keyword:pass'],
      ]);
    });

    it('attributes of number literals', () => {
      expect(
        marked(highlightCode('a = 1.__class__ + 5._or', 'python')[0]),
      ).toEqual(['number:1.', 'number:5.']);
    });

    it('an ellipsis before a number', () => {
      expect(marked(highlightCode('x = ...1.5', 'python')[0])).toEqual([
        'number:1.5',
      ]);
    });

    it('only valid string prefixes', () => {
      expect(marked(highlightCode('bb"a" + ur"x"', 'python')[0])).toEqual([
        'string:"a"',
        'string:"x"',
      ]);
    });

    it('escaped quotes in format specs', () => {
      expect(
        marked(highlightCode('x = f"{x:\\"^9}" # c', 'python')[0]),
      ).toEqual(['string:f"{x:\\"^9}"', 'comment:# c']);
      const lines = highlightCode('x = f"""{x:\\"""}""" + 1\nz = 2', 'python');
      expect(lines.map(marked)).toEqual([
        ['string:f"""{x:\\"""}"""', 'number:1'],
        ['number:2'],
      ]);
    });

    it('an unclosed \\N{ escape, which still ends at the quote', () => {
      const lines = highlightCode('s = f"\\N{"\nd = {1: 2}', 'python');
      expect(lines.map(marked)).toEqual([
        ['string:f"\\N{"'],
        ['number:1', 'number:2'],
      ]);
    });

    it('a line continuation before a defined name', () => {
      expect(marked(highlightCode('class \\\n A: pass', 'python')[1])).toEqual([
        'function:A',
        'keyword:pass',
      ]);
    });
  });

  it('drops the carriage return of CRLF line ends', () => {
    const lines = highlightCode(
      "x = 1  # c\r\ns = 'a\\\r\nb'\r\ny = 2\r\n",
      'python',
    );
    expect(lines.map(marked)).toEqual([
      ['number:1', 'comment:# c'],
      ["string:'a\\"],
      ["string:b'"],
      ['number:2'],
      [],
    ]);
    expect(text(lines)).not.toContain('\r');
  });

  // Quadratic scanning would take far longer than the timeout on these.
  it(
    'stays linear on unclosed and deeply nested f-strings',
    { timeout: 2_000 },
    () => {
      for (const code of [
        'f"{'.repeat(20_000),
        'x = f"{\ny = "a"\n'.repeat(5_000),
        'f"' + '{a:'.repeat(30_000) + 'z'.repeat(90_000),
        'x = f"\\N{a:"\n'.repeat(10_000),
      ])
        expect(text(highlightCode(code, 'python'))).toBe(code);
    },
  );

  it('keeps every character of any input, line by line', () => {
    const units = [...'abtu1_ #"\'\\\n\r.:(){}[]!fr+-', '𝑥', 'π'];
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(...units) }), (code) => {
        const lines = highlightCode(code, 'python');
        expect(lines).toHaveLength(code.split('\n').length);
        expect(text(lines)).toBe(code.replaceAll('\r\n', '\n'));
        for (const line of lines)
          for (const token of line) {
            expect(token.text).not.toContain('\n');
            expect(token.text).not.toBe('');
          }
      }),
      fuzz,
    );
  });
});
