/**
 * A stack in an array, as in CLRS: S[0 : n − 1] holds the keys from the
 * bottom up to S[top], and top = −1 when the stack is empty. PUSH puts a
 * key above the top, POP takes the top key off; pushing onto a full stack
 * overflows and popping an empty one underflows.
 *
 * The array is drawn with a `top` pointer at the top key. A popped key's
 * cell is shown empty: CLRS leaves the value there, but it is no longer in
 * the stack.
 */
import { z } from 'zod';

import { listField } from '../../notation/schema.ts';
import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import type { Trace } from '../../trace.ts';

/** The most cells an array of keys has, so that it fits one screen. */
export const MAX_CELLS = 16;

export interface ArrayFrom {
  readonly size: number;
  readonly keys: readonly number[];
}

export const Key = z.number().describe('A key.');

/** A stack's or a queue's start: its size and its keys, in order. */
export const arrayFrom = (keys: string) =>
  z
    .strictObject({
      size: z
        .int()
        .min(1)
        .max(MAX_CELLS)
        .describe(`The number of cells n, from 1 to ${MAX_CELLS}.`),
      keys: listField(
        z.array(Key).max(MAX_CELLS).describe(`The keys, ${keys}.`),
        'number',
      ),
    })
    .describe('The starting array: its size, and the keys in it.');

interface StackState {
  readonly size: number;
  readonly keys: readonly number[];
}

type On = Handle<'array'>;

const PUSH = listing('push', {
  pseudocode: `
    PUSH(S, x)
        if S.top == S.size - 1
            error "overflow"
        S.top = S.top + 1
        S[S.top] = x  // @push
  `,
  python: `
    def push(s, x):
        if s.top == len(s.cells) - 1:
            raise OverflowError('stack overflow')
        s.top += 1
        s.cells[s.top] = x  # @push
  `,
});

const POP = listing('pop', {
  pseudocode: `
    POP(S)
        if S.top == -1
            error "underflow"
        S.top = S.top - 1  // @pop
        return S[S.top + 1]
  `,
  python: `
    def pop(s):
        if s.top == -1:
            raise IndexError('stack underflow')
        s.top -= 1  # @pop
        return s.cells[s.top + 1]
  `,
});

function push(
  s: StackState,
  key: number,
  trace: Trace,
  on: On,
): Applied<StackState> {
  const top = s.keys.length;
  if (top >= s.size)
    throw new RangeError(
      `The stack is full: all ${s.size} cells hold keys, so pushing ${key} overflows`,
    );
  trace.step(
    'push',
    {
      en: `top becomes ${top}: store ${key} in S[${top}], the new top.`,
      zh: `top 变为 ${top}：把 ${key} 存入 S[${top}]，即新的栈顶。`,
    },
    { vars: { x: key, top } },
  );
  on.set({ index: top, value: key })
    .pointer({ name: 'top', index: top })
    .highlight({ indices: [top] });
  return { state: { ...s, keys: [...s.keys, key] }, result: null };
}

function pop(s: StackState, trace: Trace, on: On): Applied<StackState> {
  const top = s.keys.length - 1;
  if (top < 0)
    throw new RangeError('The stack is empty: popping it underflows');
  const key = s.keys[top]!;
  trace.step(
    'pop',
    top === 0
      ? {
          en: `Pop ${key}, the only key: top becomes −1, and the stack is empty.`,
          zh: `弹出唯一的关键字 ${key}：top 变为 −1，栈空了。`,
        }
      : {
          en: `Pop ${key} from S[${top}]: top becomes ${top - 1}, at ${s.keys[top - 1]}.`,
          zh: `从 S[${top}] 弹出 ${key}：top 变为 ${top - 1}，指向 ${s.keys[top - 1]}。`,
        },
    { vars: { top: top - 1 } },
  );
  on.highlight({ indices: [top] })
    .set({ index: top, value: '' })
    .pointer({ name: 'top', index: top === 0 ? null : top - 1 });
  return { state: { ...s, keys: s.keys.slice(0, -1) }, result: key };
}

const op = operationsOf<StackState, ArrayFrom, 'array'>();
const sample: ArrayFrom = { size: 6, keys: [15, 6, 2, 9] };

/** A stack kept in an array, as in CLRS. */
export const stack = defineStructure<StackState, ArrayFrom, 'array'>({
  id: 'stack',
  title: { en: 'Stack', zh: '栈' },
  topic: 'lists',
  summary: {
    en: 'Pushes keys onto and pops them off a stack kept in an array, last in, first out, with top at the most recent key.',
    zh: '在用数组存放的栈中压入和弹出关键字，后进先出，top 指向最近放入的关键字。',
  },
  name: 'S',
  kind: 'array',
  from: arrayFrom('from the bottom to the top, e.g. [15, 6, 2, 9]'),
  examples: [
    {
      from: sample,
      ops: [
        { op: 'push', key: 17 },
        { op: 'push', key: 3 },
        { op: 'pop' },
        { op: 'pop' },
        { op: 'pop' },
      ],
    },
  ],
  start(from) {
    if (from.keys.length > from.size)
      throw new RangeError(
        `${from.keys.length} keys do not fit into ${from.size} cells`,
      );
    return { size: from.size, keys: [...from.keys] };
  },
  describe: (s) => ({ size: s.size, keys: [...s.keys] }),
  declare: (s) => ({
    kind: 'array',
    initial: Array.from({ length: s.size }, (_, q) => ({
      id: `c${q}`,
      value: s.keys[q] ?? '',
    })),
  }),
  clear() {
    // The top pointer is part of the drawing, and stays.
  },
  operations: [
    op({
      name: 'push',
      title: { en: 'push', zh: '压入' },
      summary: {
        en: 'Puts a key on top of the stack, in the cell above the top.',
        zh: '把一个关键字放到栈顶，即原栈顶上面的那一格。',
      },
      args: { key: Key.describe('The key to push.') },
      examples: [{ from: sample, key: 17 }],
      code: PUSH,
      titleOf: ({ key }) => ({ en: `push ${key}`, zh: `压入 ${key}` }),
      apply: (s, { key }, trace, on) => push(s, key, trace, on),
    }),
    op({
      name: 'pop',
      title: { en: 'pop', zh: '弹出' },
      summary: {
        en: 'Takes the top key off the stack and returns it.',
        zh: '取下栈顶的关键字并返回它。',
      },
      args: {},
      examples: [{ from: sample }],
      code: POP,
      titleOf: () => ({ en: 'pop', zh: '弹出' }),
      apply: (s, _, trace, on) => pop(s, trace, on),
    }),
  ],
});
