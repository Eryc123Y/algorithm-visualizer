/**
 * Balanced brackets (ADR 0023): push every opening bracket onto a stack,
 * and pop one for each closing bracket, which must match it. The text is
 * balanced when no closer goes unmatched and the stack ends empty.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** Most characters the text takes, so it fits on one row. */
export const MAX_TEXT = 32;

/** The opening bracket of each closing one. */
const OPENERS: Readonly<Record<string, string>> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

export const balancedBrackets = defineAlgorithm({
  id: 'balanced-brackets',
  title: { en: 'Balanced brackets', zh: '括号匹配' },
  topic: 'lists',
  summary: {
    en: 'Checks that brackets are balanced, pushing each opener onto a stack and popping it for the closer that matches.',
    zh: '检查括号是否配对：把每个左括号压入栈中，遇到与之匹配的右括号时弹出。',
  },
  input: z.strictObject({
    text: z
      .string()
      .min(1)
      .max(MAX_TEXT)
      .describe(
        'Text with brackets, e.g. "{[()]}"; other characters are skipped.',
      ),
  }),
  main: 'text',
  examples: [{ text: '{[()()]}' }, { text: '([)]' }],
  code: {
    pseudocode: `
      BALANCED(s)
          let stack be a new empty stack
          for each character c of s  // @skip
              if c is an opening bracket
                  PUSH(stack, c)  // @push
              elseif c is a closing bracket  // @close
                  if STACK-EMPTY(stack)
                      return FALSE  // @empty
                  if POP(stack) is not the opener of c  // @pop
                      return FALSE  // @mismatch
          return STACK-EMPTY(stack)  // @end
    `,
    python: `
      OPENER = {')': '(', ']': '[', '}': '{'}

      def balanced(s):
          stack = []
          for c in s:  # @skip
              if c in '([{':
                  stack.append(c)  # @push
              elif c in OPENER:  # @close
                  if not stack:
                      return False  # @empty
                  if stack.pop() != OPENER[c]:  # @pop
                      return False  # @mismatch
          return not stack  # @end
    `,
  },
  run({ text }, trace) {
    // Characters, not UTF-16 code units, so that "é" or "🙂" is one cell.
    const chars = [...text];
    const input = trace.add('s', { kind: 'array', initial: chars });
    const stack = trace.add('stack', {
      kind: 'stack',
      place: 'side',
      initial: [],
    });
    const open: string[] = [];
    for (const [k, ch] of chars.entries()) {
      if ('([{'.includes(ch)) {
        trace.step(
          'push',
          { en: `"${ch}" opens: push it.`, zh: `“${ch}”是左括号：压入栈中。` },
          { vars: { c: ch } },
        );
        input.pointer({ name: 'c', index: k });
        stack.push({ element: { id: `b${k}`, value: ch } });
        open.push(ch);
        continue;
      }
      if (!(ch in OPENERS)) {
        trace.step(
          'skip',
          {
            en: `"${ch}" is not a bracket: skip it.`,
            zh: `“${ch}”不是括号：跳过。`,
          },
          {
            vars: { c: ch },
          },
        );
        input.pointer({ name: 'c', index: k });
        continue;
      }
      trace.step(
        'close',
        {
          en: `"${ch}" closes: it must match the top of the stack.`,
          zh: `“${ch}”是右括号：它必须和栈顶匹配。`,
        },
        {
          vars: { c: ch },
        },
      );
      input.pointer({ name: 'c', index: k }).highlight({ indices: [k] });
      if (open.length === 0) {
        trace.step('empty', {
          en: `The stack is empty, so "${ch}" has no partner: not balanced.`,
          zh: `栈是空的，所以“${ch}”没有配对的括号：不匹配。`,
        });
        return;
      }
      stack.peek();
      const top = open.pop()!;
      if (top !== OPENERS[ch]) {
        trace.step('mismatch', {
          en: `Pop "${top}": it does not match "${ch}", so not balanced.`,
          zh: `弹出“${top}”：它和“${ch}”不匹配，所以不匹配。`,
        });
        stack.pop();
        return;
      }
      trace.step('pop', {
        en: `"${top}" matches "${ch}": pop it.`,
        zh: `“${top}”和“${ch}”匹配：弹出它。`,
      });
      stack.pop();
      input.settle({ index: k });
    }
    trace.step(
      'end',
      open.length === 0
        ? {
            en: 'Every bracket found its partner and the stack is empty: balanced.',
            zh: '每个括号都找到了配对的括号，栈也空了：匹配。',
          }
        : {
            en: `${open.length} opening ${open.length === 1 ? 'bracket was' : 'brackets were'} never closed: not balanced.`,
            zh: `有 ${open.length} 个左括号始终没有闭合：不匹配。`,
          },
    );
    input.pointer({ name: 'c', index: null });
  },
});
