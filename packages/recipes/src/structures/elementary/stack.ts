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
    `top becomes ${top}: store ${key} in S[${top}], the new top.`,
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
      ? `Pop ${key}, the only key: top becomes −1, and the stack is empty.`
      : `Pop ${key} from S[${top}]: top becomes ${top - 1}, at ${s.keys[top - 1]}.`,
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
  title: 'Stack',
  topic: 'lists',
  summary:
    'Pushes keys onto and pops them off a stack kept in an array, last in, first out, with top at the most recent key.',
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
      title: 'push',
      summary: 'Puts a key on top of the stack, in the cell above the top.',
      args: { key: Key.describe('The key to push.') },
      examples: [{ from: sample, key: 17 }],
      code: PUSH,
      titleOf: ({ key }) => `push ${key}`,
      apply: (s, { key }, trace, on) => push(s, key, trace, on),
    }),
    op({
      name: 'pop',
      title: 'pop',
      summary: 'Takes the top key off the stack and returns it.',
      args: {},
      examples: [{ from: sample }],
      code: POP,
      titleOf: () => 'pop',
      apply: (s, _, trace, on) => pop(s, trace, on),
    }),
  ],
});
