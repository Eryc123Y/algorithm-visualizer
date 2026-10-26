import { describe, expect, it } from 'vitest';

import { ops } from '../src/index.ts';
import { joinSnippets, snippet } from '../src/ops/snippet.ts';

/** Non-blank lines whose indentation Python would reject. */
function badIndents(code: string): string[] {
  const lines = code.split('\n').filter((l) => l.trim() !== '');
  const indent = (l: string) => l.length - l.trimStart().length;
  return lines.filter((line, k) => {
    const prev = k === 0 ? undefined : lines[k - 1]!;
    const before = prev === undefined ? 0 : indent(prev);
    const opens = prev?.trimEnd().endsWith(':') ?? false;
    const depth = indent(line);
    return depth % 4 !== 0 || (opens ? depth !== before + 4 : depth > before);
  });
}

describe('snippet', () => {
  it('strips # @name markers and remembers their lines', () => {
    const s = snippet(`
      def f(x):
          if x:  # @check
              return 1  # @one
          return 0
    `);
    expect(s.code).toBe('def f(x):\n    if x:\n        return 1\n    return 0');
    expect(s.line('check')).toBe(2);
    expect(s.line('one')).toBe(3);
  });

  it('rejects unknown and repeated markers', () => {
    expect(() => snippet('x = 1  # @a').line('b')).toThrow(/@b/);
    expect(() => snippet('x = 1  # @a\ny = 2  # @a')).toThrow(/twice/);
  });
});

describe('joinSnippets', () => {
  it('joins code with a blank line and shifts line numbers', () => {
    const a = snippet('def a():\n    pass  # @p');
    const b = snippet('def b():\n    return  # @r');
    const joined = joinSnippets([a, b, a]);
    expect(joined.source).toEqual({
      language: 'python',
      code: 'def a():\n    pass\n\ndef b():\n    return',
    });
    expect(joined.line(a, 'p')).toBe(2);
    expect(joined.line(b, 'r')).toBe(5);
    expect(joined.line(b)).toBe(4);
  });
});

describe('operation code', () => {
  it('finds badly indented lines', () => {
    expect(badIndents('def f():\n    x = 1\n  y = 2')).toEqual(['  y = 2']);
    expect(badIndents('def f():\nx = 1')).toEqual(['x = 1']);
    expect(badIndents('def f():\n    if x:\n        y\n    z')).toEqual([]);
  });

  it('is indented as Python requires, for every operation', () => {
    const codes = [
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
      ops.heap.decreaseKey({ from: [3, 1, 2], index: 2, value: 0 }),
      ops.heap.increaseKey({ from: [1, 3, 2], index: 2, value: 9 }),
    ].map((run) => run.document.source!.code);
    for (const code of codes) expect(badIndents(code)).toEqual([]);
  });
});
