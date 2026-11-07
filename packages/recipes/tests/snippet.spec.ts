import { describe, expect, it } from 'vitest';

import {
  joinListings,
  LANGUAGES,
  listing,
  snippet,
  snippetOf,
} from '../src/snippet.ts';
import { badIndents } from './code-checks.ts';

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

describe('snippetOf', () => {
  it('reads an anchored source back into a snippet', () => {
    const s = snippetOf({
      language: 'python',
      code: 'def f():\n    return 1',
      anchors: { one: 2 },
    });
    expect(s.line('one')).toBe(2);
    expect(s.language).toBe('python');
    expect(() => snippetOf({ language: 'c', code: 'x', anchors: {} })).toThrow(
      /not a language/,
    );
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

describe('badIndents', () => {
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
});
