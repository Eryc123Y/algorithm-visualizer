/**
 * A queue in an array, as in CLRS: Q[0 : n − 1] holds the keys from
 * Q[head] on, wrapping around from the last cell to the first, and tail is
 * the cell the next key goes into. The queue is empty when head = tail and
 * full when head = tail + 1 (mod n), so it holds at most n − 1 keys.
 * ENQUEUE stores a key at the tail, DEQUEUE takes the key at the head.
 *
 * The array is drawn with `head` and `tail` pointers. A dequeued key's cell
 * is shown empty: CLRS leaves the value there, but it is no longer in the
 * queue.
 */
import { z } from 'zod';

import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import type { Trace } from '../../trace.ts';
import { Key, MAX_CELLS } from './stack.ts';
import { listField } from '../../notation/schema.ts';

export interface QueueFrom {
  readonly size: number;
  /** The cell of the first key; 0 by default. */
  readonly head?: number | undefined;
  readonly keys: readonly number[];
}

interface QueueState {
  readonly size: number;
  readonly head: number;
  readonly keys: readonly number[];
}

type On = Handle<'array'>;

const ENQUEUE = listing('enqueue', {
  pseudocode: `
    ENQUEUE(Q, x)
        if Q.head == (Q.tail + 1) mod Q.size
            error "overflow"
        Q[Q.tail] = x  // @enqueue
        Q.tail = (Q.tail + 1) mod Q.size
  `,
  python: `
    def enqueue(q, x):
        n = len(q.cells)
        if q.head == (q.tail + 1) % n:
            raise OverflowError('queue overflow')
        q.cells[q.tail] = x  # @enqueue
        q.tail = (q.tail + 1) % n
  `,
});

const DEQUEUE = listing('dequeue', {
  pseudocode: `
    DEQUEUE(Q)
        if Q.head == Q.tail
            error "underflow"
        x = Q[Q.head]  // @dequeue
        Q.head = (Q.head + 1) mod Q.size
        return x
  `,
  python: `
    def dequeue(q):
        if q.head == q.tail:
            raise IndexError('queue underflow')
        x = q.cells[q.head]  # @dequeue
        q.head = (q.head + 1) % len(q.cells)
        return x
  `,
});

const tailOf = (s: QueueState) => (s.head + s.keys.length) % s.size;

function enqueue(
  s: QueueState,
  key: number,
  trace: Trace,
  on: On,
): Applied<QueueState> {
  if (s.keys.length >= s.size - 1)
    throw new RangeError(
      `The queue is full: it holds ${s.keys.length} keys, the most ${s.size} cells can, so enqueuing ${key} overflows`,
    );
  const tail = tailOf(s);
  const next = (tail + 1) % s.size;
  trace.step(
    'enqueue',
    `Store ${key} at the tail, Q[${tail}]; tail moves to ${next}${next === 0 ? ', wrapping around' : ''}.`,
    { vars: { x: key, tail: next } },
  );
  on.set({ index: tail, value: key })
    .highlight({ indices: [tail] })
    .pointer({ name: 'head', index: s.head })
    .pointer({ name: 'tail', index: next });
  return { state: { ...s, keys: [...s.keys, key] }, result: null };
}

function dequeue(s: QueueState, trace: Trace, on: On): Applied<QueueState> {
  if (s.keys.length === 0)
    throw new RangeError('The queue is empty: dequeuing underflows');
  const key = s.keys[0]!;
  const next = (s.head + 1) % s.size;
  trace.step(
    'dequeue',
    s.keys.length === 1
      ? `Take ${key} from the head, Q[${s.head}]; head moves to ${next}, where tail is: the queue is empty.`
      : `Take ${key} from the head, Q[${s.head}]; head moves to ${next}${next === 0 ? ', wrapping around' : ''}.`,
    { vars: { x: key, head: next } },
  );
  on.highlight({ indices: [s.head] })
    .set({ index: s.head, value: '' })
    .pointer({ name: 'head', index: next })
    .pointer({ name: 'tail', index: tailOf(s) });
  return {
    state: { ...s, head: next, keys: s.keys.slice(1) },
    result: key,
  };
}

const op = operationsOf<QueueState, QueueFrom, 'array'>();
const sample: QueueFrom = { size: 8, head: 5, keys: [15, 6, 9] };

const From = z
  .strictObject({
    size: z
      .int()
      .min(2)
      .max(MAX_CELLS)
      .describe(`The number of cells n, from 2 to ${MAX_CELLS}.`),
    head: z
      .int()
      .min(0)
      .max(MAX_CELLS - 1)
      .optional()
      .describe('The cell of the first key, from 0 to n − 1; 0 by default.'),
    keys: listField(
      z
        .array(Key)
        .max(MAX_CELLS - 1)
        .describe('The keys from the head to the tail, e.g. [15, 6, 9].'),
      'number',
    ),
  })
  .describe(
    'The starting queue: its size, the cell of its head, and its keys.',
  );

/** A queue kept in an array that wraps around, as in CLRS. */
export const queue = defineStructure<QueueState, QueueFrom, 'array'>({
  id: 'queue',
  title: 'Queue',
  topic: 'lists',
  summary:
    'Enqueues keys at the tail and dequeues them from the head of a queue kept in an array that wraps around, first in, first out.',
  name: 'Q',
  kind: 'array',
  from: From,
  examples: [
    {
      from: sample,
      ops: [
        { op: 'enqueue', key: 17 },
        { op: 'enqueue', key: 3 },
        { op: 'enqueue', key: 5 },
        { op: 'dequeue' },
        { op: 'dequeue' },
      ],
    },
  ],
  start(from) {
    const head = from.head ?? 0;
    if (head >= from.size)
      throw new RangeError(
        `head is ${head}, but the cells are 0 to ${from.size - 1}`,
      );
    if (from.keys.length > from.size - 1)
      throw new RangeError(
        `A queue of ${from.size} cells holds at most ${from.size - 1} keys, not ${from.keys.length}`,
      );
    return { size: from.size, head, keys: [...from.keys] };
  },
  describe: (s) => ({ size: s.size, head: s.head, keys: [...s.keys] }),
  declare: (s) => ({
    kind: 'array',
    initial: Array.from({ length: s.size }, (_, q) => {
      const k = (q - s.head + s.size) % s.size;
      return { id: `c${q}`, value: k < s.keys.length ? s.keys[k]! : '' };
    }),
  }),
  clear() {
    // head and tail are part of the drawing, and stay.
  },
  operations: [
    op({
      name: 'enqueue',
      title: 'enqueue',
      summary:
        'Stores a key at the tail of the queue, and moves the tail one cell on, wrapping around.',
      args: { key: Key.describe('The key to enqueue.') },
      examples: [{ from: sample, key: 17 }],
      code: ENQUEUE,
      titleOf: ({ key }) => `enqueue ${key}`,
      apply: (s, { key }, trace, on) => enqueue(s, key, trace, on),
    }),
    op({
      name: 'dequeue',
      title: 'dequeue',
      summary:
        'Takes the key at the head of the queue, and moves the head one cell on, wrapping around.',
      args: {},
      examples: [{ from: sample }],
      code: DEQUEUE,
      titleOf: () => 'dequeue',
      apply: (s, _, trace, on) => dequeue(s, trace, on),
    }),
  ],
});
