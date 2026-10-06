/**
 * Recipes on linked lists, stacks and queues.
 */
import type { VisualizationInput } from '@algoviz/spec';

import { Recorder } from './recorder.ts';
import { python } from './source.ts';

/** Reverses a singly linked list in place by turning its links around. */
export function reverseLinkedList(
  values: readonly number[],
): VisualizationInput {
  const r = new Recorder({
    title: 'Reversing a linked list',
    source: python(`
      def reverse(head):
          prev = None
          curr = head
          while curr:
              nxt = curr.next
              curr.next = prev
              prev = curr
              curr = nxt
          return prev
    `),
  });
  const list = r.add('list', { kind: 'linkedList', initial: [...values] });
  const n = values.length;
  r.step({
    line: 3,
    narration: 'Start with prev = None and curr at the head.',
  });
  if (n > 0)
    list
      .pointer({ name: 'head', index: 0 })
      .pointer({ name: 'curr', index: 0 });
  let prev: number | null = null;
  for (let curr = 0; curr < n; curr++) {
    const next = curr + 1 < n ? curr + 1 : null;
    r.step({
      line: 5,
      narration: 'Remember the next node before the link is lost.',
    });
    list.pointer({ name: 'next', index: next });
    r.step({
      line: 6,
      narration: `Point ${values[curr]} back to ${prev === null ? 'None' : values[prev]}.`,
    });
    list.link({ from: curr, to: prev }).highlight({ indices: [curr] });
    r.step({ line: 8, narration: 'Advance prev and curr.' });
    prev = curr;
    list
      .pointer({ name: 'prev', index: prev })
      .pointer({ name: 'curr', index: next });
    list.visit({ index: curr });
  }
  r.step({ line: 9, narration: 'curr is None: prev is the new head.' });
  list
    .pointer({ name: 'next', index: null })
    .pointer({ name: 'curr', index: null });
  list.pointer({ name: 'head', index: prev });
  return r.build();
}

const OPENERS: Readonly<Record<string, string>> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

/** Checks that brackets are balanced, with a stack. */
export function balancedBrackets(text: string): VisualizationInput {
  const r = new Recorder({
    title: 'Balanced brackets',
    source: python(`
      def balanced(s):
          stack = []
          for ch in s:
              if ch in '([{':
                  stack.append(ch)
              elif ch in ')]}':
                  if not stack or stack.pop() != match[ch]:
                      return False
          return not stack
    `),
  });
  const chars = [...text];
  const input = r.add('s', { kind: 'array', initial: chars });
  const stack = r.add('stack', { kind: 'stack', initial: [] });
  const open: string[] = [];
  let id = 0;
  for (const [k, ch] of chars.entries()) {
    if ('([{'.includes(ch)) {
      r.step({ line: 5, narration: `"${ch}" opens: push it.` });
      input.pointer({ name: 'ch', index: k });
      stack.push({ element: { id: `b${id++}`, value: ch } });
      open.push(ch);
    } else if (ch in OPENERS) {
      r.step({
        line: 7,
        narration: `"${ch}" closes: it must match the top of the stack.`,
      });
      input.pointer({ name: 'ch', index: k }).highlight({ indices: [k] });
      if (open.length === 0) {
        r.step({
          line: 8,
          narration: `The stack is empty, so "${ch}" has no partner: not balanced.`,
        });
        return r.build();
      }
      stack.peek();
      const top = open.pop()!;
      if (top !== OPENERS[ch]) {
        r.step({
          line: 8,
          narration: `"${top}" does not match "${ch}": not balanced.`,
        });
        return r.build();
      }
      r.step({ line: 7, narration: `"${top}" matches "${ch}": pop it.` });
      stack.pop();
      input.settle({ index: k });
    } else {
      r.step({ line: 3, narration: `"${ch}" is not a bracket.` });
      input.pointer({ name: 'ch', index: k });
    }
  }
  r.step({
    line: 9,
    narration:
      open.length === 0
        ? 'The stack is empty: balanced.'
        : `${open.length} bracket(s) never closed: not balanced.`,
  });
  input.pointer({ name: 'ch', index: null });
  return r.build();
}
