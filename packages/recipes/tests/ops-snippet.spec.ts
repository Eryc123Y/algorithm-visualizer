import { describe, expect, it } from 'vitest';

import { highlightCode } from '@algoviz/core';
import { parseVisualization, type VisualizationInput } from '@algoviz/spec';

import { ops } from '../src/index.ts';
import {
  joinListings,
  LANGUAGES,
  listing,
  snippet,
  type Language,
} from '../src/ops/snippet.ts';

/**
 * Non-blank lines indented in a way the language would not read as its
 * blocks: Python opens a block after `:`, pseudocode after a procedure's
 * first line and after `if`, `elseif`, `else`, `while`, `for` and `repeat`
 * (a one-line `else x = y` opens none).
 */
function badIndents(code: string, language: Language): string[] {
  const lines = code.split('\n').filter((l) => l.trim() !== '');
  const indent = (l: string) => l.length - l.trimStart().length;
  const opensBlock = (line: string) =>
    language === 'python'
      ? line.trimEnd().endsWith(':')
      : indent(line) === 0 ||
        /^(if|elseif|while|for|repeat)\b/.test(line.trim()) ||
        line.trim() === 'else';
  return lines.filter((line, k) => {
    const prev = k === 0 ? undefined : lines[k - 1]!;
    const before = prev === undefined ? 0 : indent(prev);
    const opens = prev !== undefined && opensBlock(prev);
    const depth = indent(line);
    return depth % 4 !== 0 || (opens ? depth !== before + 4 : depth > before);
  });
}

describe('snippet', () => {
  it('strips # @name markers in Python and remembers their lines', () => {
    const s = snippet(
      'python',
      `
      def f(x):
          if x:  # @check
              return 1  # @one
          return 0
    `,
    );
    expect(s.code).toBe('def f(x):\n    if x:\n        return 1\n    return 0');
    expect(s.line('check')).toBe(2);
    expect(s.line('one')).toBe(3);
    expect([...s.anchors.keys()]).toEqual(['check', 'one']);
  });

  it('strips // @name markers in pseudocode, keeping other comments', () => {
    const s = snippet(
      'pseudocode',
      `
      F(x)
          if x // the test  // @check
              return 1 //@one
          return 0 // # @not-a-marker
    `,
    );
    expect(s.code).toBe(
      'F(x)\n    if x // the test\n        return 1\n    return 0 // # @not-a-marker',
    );
    expect(s.line('check')).toBe(2);
    expect(s.line('one')).toBe(3);
  });

  it('does not read the other language’s markers', () => {
    expect(snippet('python', 'x = 1  // @a').anchors.size).toBe(0);
    expect(snippet('pseudocode', 'x = 1  # @a').anchors.size).toBe(0);
  });

  it('rejects unknown and repeated markers', () => {
    expect(() => snippet('python', 'x = 1  # @a').line('b')).toThrow(/@b/);
    expect(() => snippet('python', 'x = 1  # @a\ny = 2  # @a')).toThrow(
      /twice/,
    );
  });

  it('rejects markers too long to name a step', () => {
    expect(() => snippet('python', `x = 1  # @${'a'.repeat(41)}`)).toThrow(
      /longer than 40 characters/,
    );
  });
});

describe('listing', () => {
  it('holds the code in every language', () => {
    const l = listing('f', {
      pseudocode: 'F()\n    return 1 // @one',
      python: 'def f():\n    return 1  # @one',
    });
    expect(l.name).toBe('f');
    expect(LANGUAGES.map((language) => l.code[language].language)).toEqual(
      LANGUAGES,
    );
  });

  it('rejects an anchor missing from a language', () => {
    expect(() =>
      listing('f', {
        pseudocode: 'F()\n    return 1',
        python: 'def f():\n    return 1  # @one',
      }),
    ).toThrow(/@one.*pseudocode/);
    expect(() =>
      listing('f', {
        pseudocode: 'F()\n    return 1 // @one\n    return 2 // @two',
        python: 'def f():\n    return 1  # @one',
      }),
    ).toThrow(/@two.*python/);
  });

  it('rejects a name that cannot prefix an anchor', () => {
    const code = { pseudocode: 'F()', python: 'def f(): pass' };
    expect(() => listing('Delete', code)).toThrow(/kebab-case/);
  });
});

describe('joinListings', () => {
  const a = listing('a', {
    pseudocode: 'A()\n    skip // @p',
    python: 'def a():\n    pass  # @p',
  });
  const b = listing('b', {
    pseudocode: 'B()\n    x = 1\n    return // @r',
    python: 'def b():\n    return  # @r',
  });

  it('keeps marker names when there is one listing', () => {
    const joined = joinListings([a, a]);
    expect(joined.sources).toEqual([
      { language: 'pseudocode', code: 'A()\n    skip', anchors: { p: 2 } },
      { language: 'python', code: 'def a():\n    pass', anchors: { p: 2 } },
    ]);
    expect(joined.anchor(a, 'p')).toBe('p');
  });

  it('joins each language with a blank line, prefixing anchors with the listing name', () => {
    const joined = joinListings([a, b, a]);
    expect(joined.sources).toEqual([
      {
        language: 'pseudocode',
        code: 'A()\n    skip\n\nB()\n    x = 1\n    return',
        anchors: { 'a-p': 2, 'b-r': 6 },
      },
      {
        language: 'python',
        code: 'def a():\n    pass\n\ndef b():\n    return',
        anchors: { 'a-p': 2, 'b-r': 5 },
      },
    ]);
    expect(joined.anchor(a, 'p')).toBe('a-p');
    expect(joined.anchor(b, 'r')).toBe('b-r');
  });

  it('rejects listings it has not joined, unknown markers and clashing names', () => {
    const joined = joinListings([a]);
    expect(() => joined.anchor(b, 'r')).toThrow(/not joined/);
    expect(() => joined.anchor(a, 'q')).toThrow(/@q/);
    const other = listing('a', {
      pseudocode: 'C() // @p',
      python: 'def c(): pass  # @p',
    });
    expect(() => joinListings([a, other])).toThrow(/"a"/);
  });
});

/** Every operation, run in one document per structure and order. */
const runs = (): VisualizationInput[] =>
  [
    ops.bst.run({
      from: [2, 1, 3],
      ops: [
        { op: 'search', key: 1 },
        { op: 'insert', key: 4 },
        { op: 'delete', key: 2 },
        { op: 'delete', key: 3, replaceWith: 'predecessor' },
      ],
    }),
    ops.heap.run({
      from: [3, 1, 2],
      ops: [{ op: 'push', value: 0 }, { op: 'pop' }],
    }),
    ops.heap.run({
      from: [3, 1, 2],
      order: 'max',
      ops: [{ op: 'push', value: 0 }, { op: 'pop' }],
    }),
    ops.heap.decreaseKey({ from: [3, 1, 2], index: 2, value: 0 }),
    ops.heap.increaseKey({ from: [1, 3, 2], index: 2, value: 9 }),
  ].map((run) => run.document);

describe('operation code (ADR 0017)', () => {
  it('finds badly indented lines', () => {
    expect(badIndents('def f():\n    x = 1\n  y = 2', 'python')).toEqual([
      '  y = 2',
    ]);
    expect(badIndents('def f():\nx = 1', 'python')).toEqual(['x = 1']);
    expect(badIndents('F()\n    if x\n    y', 'pseudocode')).toEqual(['    y']);
    expect(
      badIndents(
        'F()\n    if x\n        y\n    else z = 1\n    w',
        'pseudocode',
      ),
    ).toEqual([]);
  });

  it('is in pseudocode first, then Python, and validates as protocol 0.3', () => {
    for (const document of runs()) {
      expect(document.version).toBe('0.3');
      expect(document.source).toBeUndefined();
      expect(document.sources?.map((s) => s.language)).toEqual([
        'pseudocode',
        'python',
      ]);
      expect(parseVisualization(document).ok).toBe(true);
    }
  });

  it('is indented as each language requires, for every operation', () => {
    for (const document of runs())
      for (const { language, code } of document.sources!)
        expect(badIndents(code, language as Language), language).toEqual([]);
  });

  it('points every step at a code line in every language', () => {
    for (const document of runs())
      for (const step of document.steps) {
        const at = step.meta?.at;
        expect(at).toBeDefined();
        for (const { language, code, anchors } of document.sources!) {
          const line = code.split('\n')[anchors[at!]! - 1]!;
          // The anchored line is code, not blank or only a comment.
          const tokens = highlightCode(line, language)[0]!;
          const code_ = tokens.filter(
            (t) => t.kind !== 'comment' && t.text.trim() !== '',
          );
          expect(code_.length, `${language} line of @${at}`).toBeGreaterThan(0);
        }
      }
  });

  it('is highlighted without losing a character, in every language', () => {
    for (const document of runs())
      for (const { language, code } of document.sources!) {
        const lines = highlightCode(code, language);
        expect(lines.map((l) => l.map((t) => t.text).join('')).join('\n')).toBe(
          code,
        );
        // Every procedure in pseudocode is named in capitals.
        if (language === 'pseudocode')
          for (const header of code.split('\n\n').map((p) => p.split('\n')[0]!))
            expect(highlightCode(header, language)[0]![0]?.kind).toBe(
              'function',
            );
      }
  });

  it('narrates without the syntax of either language', () => {
    for (const document of runs())
      for (const step of document.steps)
        expect(step.meta?.narration ?? '').not.toMatch(
          /None|NIL|len\(|\.size|append|==|\bdef\b|\/\/|#/,
        );
  });
});
