import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  highlightCode,
  highlightedLanguages,
  isCodeLine,
  type CodeLine,
} from '../src/index.ts';
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

const highlight = (code: string) =>
  highlightCode(code, 'pseudocode').map(marked);

const text = (lines: readonly CodeLine[]) =>
  lines.map((line) => line.map((t) => t.text).join('')).join('\n');

describe('pseudocode highlighting (CLRS conventions, ADR 0017)', () => {
  it('is registered as pseudocode', () => {
    expect(highlightedLanguages).toContain('pseudocode');
  });

  it('marks loop keywords: for … to and downto, while, repeat … until', () => {
    expect(
      highlight(
        'for i = 0 to n - 1\nfor j = i downto 1\nwhile i > 0\nrepeat\nuntil done',
      ),
    ).toEqual([
      ['keyword:for', 'number:0', 'keyword:to', 'number:1'],
      ['keyword:for', 'keyword:downto', 'number:1'],
      ['keyword:while', 'number:0'],
      ['keyword:repeat'],
      ['keyword:until'],
    ]);
  });

  it('marks if, elseif, else, return, error and for each … in', () => {
    expect(
      highlight(
        'if x == 1\nelseif x < 1\nelse return x\nerror "underflow"\nfor each v in G.Adj[u]',
      ),
    ).toEqual([
      ['keyword:if', 'number:1'],
      ['keyword:elseif', 'number:1'],
      ['keyword:else', 'keyword:return'],
      ['keyword:error', 'string:"underflow"'],
      ['keyword:for', 'keyword:each', 'keyword:in'],
    ]);
  });

  it('marks and, or and not, and the constants NIL, TRUE and FALSE', () => {
    expect(
      highlight('if x ≠ NIL and not found or y == TRUE\n    done = FALSE'),
    ).toEqual([
      [
        'keyword:if',
        'keyword:NIL',
        'keyword:and',
        'keyword:not',
        'keyword:or',
        'keyword:TRUE',
      ],
      ['keyword:FALSE'],
    ]);
  });

  it('marks procedure names: capitals joined by hyphens', () => {
    expect(
      highlight(
        'INSERTION-SORT(A, n)\nB-TREE-SPLIT-CHILD(x, 1)\nx = PARENT(i) + MAX-HEAPIFY(A, i)',
      ),
    ).toEqual([
      ['function:INSERTION-SORT'],
      ['function:B-TREE-SPLIT-CHILD', 'number:1'],
      ['function:PARENT', 'function:MAX-HEAPIFY'],
    ]);
  });

  it('does not mark single capitals, mixed case or attributes as procedures', () => {
    expect(
      highlight(
        'A[i] = G.V + T.root\nAdj = Q\nx = A-1\ny = MAX-1\nnode.NIL = x.TRUE',
      ),
    ).toEqual([[], [], ['number:1'], ['function:MAX', 'number:1'], []]);
  });

  it('needs two letters in some part of a procedure name', () => {
    // `A-B` is A minus B, and `L1` a variable with a digit.
    expect(
      highlight('x = A-B + L1 + Q2(a)\nRB-INSERT(T, z)\nLCS(x, y)'),
    ).toEqual([[], ['function:RB-INSERT'], ['function:LCS']]);
  });

  it('does not mark keywords inside names or after a dot', () => {
    expect(highlight('format = node.to + iffy + for_each + edge.if')).toEqual([
      [],
    ]);
  });

  it('marks numbers and infinity, with hyphenated names and minus apart', () => {
    expect(highlight('x = 2i + 1.5 - ∞\ny = a.heap-size - 1')).toEqual([
      ['number:2', 'number:1.5', 'number:∞'],
      ['number:1'],
    ]);
  });

  it('marks // comments to the end of the line, but not / or // in strings', () => {
    expect(
      highlight('x = a / b  // halve it\ny = "a // b" // done\n// whole line'),
    ).toEqual([
      ['comment:// halve it'],
      ['string:"a // b"', 'comment:// done'],
      ['comment:// whole line'],
    ]);
  });

  it('ends an unterminated string at the end of its line, keeping escaped quotes', () => {
    expect(highlight('error "say \\"no\nx = 1')).toEqual([
      ['keyword:error', 'string:"say \\"no'],
      ['number:1'],
    ]);
  });

  it('keeps every character of any input, line by line', () => {
    const units = [
      ...'aAZ_1 -/"\\\n\r.()[]=<>',
      'for',
      'to',
      'NIL',
      'B-',
      '//',
      '∞',
      'π',
      '𝑥',
      '≤',
    ];
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(...units) }), (code) => {
        const lines = highlightCode(code, 'pseudocode');
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

  it(
    'stays linear on long names, strings and comments',
    { timeout: 2_000 },
    () => {
      for (const code of [
        'A-'.repeat(50_000),
        'AB-'.repeat(50_000) + 'x',
        '"'.repeat(100_001),
        '//'.repeat(50_000) + '\nx',
        '1.'.repeat(50_000),
      ])
        expect(text(highlightCode(code, 'pseudocode'))).toBe(code);
    },
  );

  describe('isCodeLine', () => {
    it('is true for a line with code, also before a comment', () => {
      expect(isCodeLine('    i = p  // the parent', 'pseudocode')).toBe(true);
      expect(isCodeLine('x = 1  # one', 'python')).toBe(true);
      expect(isCodeLine('return', undefined)).toBe(true);
    });

    it('is false for a blank line or one that is only a comment', () => {
      expect(isCodeLine('   ', 'pseudocode')).toBe(false);
      expect(isCodeLine('', 'python')).toBe(false);
      expect(isCodeLine('    // note', 'pseudocode')).toBe(false);
      expect(isCodeLine('  # note', 'python')).toBe(false);
    });
  });
});
