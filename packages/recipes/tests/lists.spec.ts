/**
 * `reverse-linked-list` and `balanced-brackets` against independent
 * references: walking the links from the head, and erasing matched pairs
 * until none is left. `properties.spec.ts` runs them on random inputs.
 */
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';

import { replay, runError, runOk, stateOf } from './helpers.ts';

/** The values met walking the links from the `head` pointer. */
function walk(trace: Trace): unknown[] {
  const list = stateOf(trace, 'list', 'linkedList');
  const byId = new Map(list.data.map((n) => [n.id, n]));
  const out: unknown[] = [];
  let at: string | null = list.marks.pointers['head'] ?? null;
  while (at !== null && out.length <= list.data.length) {
    const node = byId.get(at)!;
    out.push(node.value);
    at = node.next;
  }
  return out;
}

describe('reverse-linked-list', () => {
  it.each([[[1]], [[1, 2]], [[1, 2, 3, 4]], [[5, 5, 2, 9, 0]]])(
    'reverses %j',
    (values) => {
      const trace = replay(runOk('reverse-linked-list', { values }).document);
      expect(walk(trace)).toEqual([...values].reverse());
      // The old head is the new tail.
      const list = stateOf(trace, 'list', 'linkedList');
      expect(list.data[0]!.next).toBeNull();
    },
  );

  it('turns one link around per node, after saving the next one', () => {
    const values = [1, 2, 3, 4];
    const { document } = runOk('reverse-linked-list', { values });
    expect(document.steps.map((s) => s.meta?.id)).toEqual([
      'start',
      ...values.flatMap(() => ['save', 'link', 'advance']),
      'done',
    ]);
    // Before the first link turns, the list still runs forwards.
    const trace = replay(document);
    const link = document.steps.findIndex((s) => s.meta?.id === 'link');
    const before = stateOf(trace, 'list', 'linkedList', link);
    expect(before.data.map((n) => n.next)).toEqual([
      ...before.data.slice(1).map((n) => n.id),
      null,
    ]);
  });

  it('takes 1 to 12 values', () => {
    for (const values of [[], Array.from({ length: 13 }, () => 1)])
      expect(runError('reverse-linked-list', { values }).path).toBe(
        '$.input.values',
      );
  });
});

/** Balanced, by erasing adjacent matched pairs until none is left. */
function isBalanced(text: string): boolean {
  let s = [...text].filter((c) => '()[]{}'.includes(c)).join('');
  for (let before = ''; before !== s;) {
    before = s;
    s = s.replace(/\(\)|\[\]|\{\}/g, '');
  }
  return s === '';
}

describe('balanced-brackets', () => {
  const texts = [
    '()',
    '([]{})',
    '(]',
    '(()',
    '())',
    'a(b)c',
    '{[()()]}',
    '([)]',
    ')(',
    'no brackets',
    '((🙂))',
  ];

  /**
   * What a reader of the text would expect: the brackets left open when the
   * run stops (popped ones gone), and the positions of closers that found
   * their partner.
   */
  function expected(text: string) {
    const chars = [...text];
    const open: string[] = [];
    const matched: number[] = [];
    const partner: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    for (const [k, c] of chars.entries()) {
      if ('([{'.includes(c)) open.push(c);
      else if (c in partner) {
        const top = open.pop();
        if (top !== partner[c]) return { open, matched };
        matched.push(k);
      }
    }
    return { open, matched };
  }

  it.each(texts.map((t) => [t]))('decides %j', (text) => {
    const { document } = runOk('balanced-brackets', { text });
    const last = document.steps.at(-1)!.meta!;
    const balanced = isBalanced(text);
    expect(last.narration!.endsWith(': balanced.')).toBe(balanced);
    expect(last.narration!.endsWith('not balanced.')).toBe(!balanced);
    const trace = replay(document);
    const { open, matched } = expected(text);
    const stack = stateOf(trace, 'stack', 'stack');
    expect(stack.data.map((e) => e.value)).toEqual(open);
    const s = stateOf(trace, 's', 'array');
    expect(s.marks.settled).toEqual(matched.map((k) => s.data[k]!.id));
  });

  it('counts the brackets never closed', () => {
    const { document } = runOk('balanced-brackets', { text: '((]' });
    expect(document.steps.at(-1)?.meta?.id).toBe('mismatch');
    const unclosed = runOk('balanced-brackets', { text: '(([' }).document;
    expect(unclosed.steps.at(-1)?.meta?.narration).toBe(
      '3 opening brackets were never closed: not balanced.',
    );
  });

  it('stops at the first closer that has no partner', () => {
    const { document } = runOk('balanced-brackets', { text: '())(' });
    expect(document.steps.map((s) => s.meta?.id)).toEqual([
      'push',
      'close',
      'pop',
      'close',
      'empty',
    ]);
    const { document: mismatch } = runOk('balanced-brackets', {
      text: '([)]',
    });
    expect(mismatch.steps.at(-1)?.meta?.id).toBe('mismatch');
  });

  it('shows each character in a cell of its own, emoji included', () => {
    const { document } = runOk('balanced-brackets', { text: '(🙂)' });
    const s = stateOf(replay(document), 's', 'array');
    expect(s.data.map((e) => e.value)).toEqual(['(', '🙂', ')']);
  });

  it('takes 1 to 32 characters', () => {
    for (const text of ['', '('.repeat(33)])
      expect(runError('balanced-brackets', { text }).path).toBe('$.input.text');
  });
});
