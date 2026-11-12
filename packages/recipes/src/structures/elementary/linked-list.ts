/**
 * A doubly linked list, as in CLRS: each node holds a key and points to
 * the next and the previous node, and L.head points to the first.
 * LIST-SEARCH walks from the head; LIST-PREPEND links a node in front;
 * LIST-INSERT links a node in after a given one, found here by its key;
 * LIST-DELETE unlinks a node, found by searching for its key.
 *
 * The list is drawn in a row, with `head` and the search's `x` as
 * pointers; inserting places the node in the row, then each step sets the
 * links the code sets.
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
import { Key } from './stack.ts';

/** The most nodes a list has, so that the row fits one screen. */
export const MAX_NODES = 12;

interface ListState {
  readonly keys: readonly number[];
  /** Each node's id, in the order of the row. */
  readonly ids: readonly string[];
  /** The number of nodes made, for fresh ids. */
  readonly made: number;
}

interface ListFrom {
  readonly keys: readonly number[];
}

type On = Handle<'linkedList'>;

const NODE = `
      class Node:
          def __init__(self, key):
              self.key, self.prev, self.next = key, None, None
`;

const SEARCH_PSEUDO = `
      LIST-SEARCH(L, k)
          x = L.head  // @start
          while x ≠ NIL and x.key ≠ k
              x = x.next  // @next
          return x  // @result
`;

const SEARCH_PYTHON = `
      def list_search(l, k):
          x = l.head  # @start
          while x is not None and x.key != k:
              x = x.next  # @next
          return x  # @result
`;

const SEARCH = listing('search', {
  pseudocode: SEARCH_PSEUDO,
  python: SEARCH_PYTHON,
});

const PREPEND = listing('prepend', {
  pseudocode: `
      LIST-PREPEND(L, x)
          x.next = L.head  // @link
          x.prev = NIL
          if L.head ≠ NIL
              L.head.prev = x  // @back
          L.head = x  // @head
  `,
  python: `${NODE}
      def list_prepend(l, x):
          x.next = l.head  # @link
          x.prev = None
          if l.head is not None:
              l.head.prev = x  # @back
          l.head = x  # @head
  `,
});

const INSERT = listing('insert', {
  pseudocode: `${SEARCH_PSEUDO}
      LIST-INSERT(x, y)
          x.next = y.next  // @link
          x.prev = y
          if y.next ≠ NIL
              y.next.prev = x  // @back
          y.next = x  // @after
  `,
  python: `${NODE}${SEARCH_PYTHON}
      def list_insert(x, y):
          x.next = y.next  # @link
          x.prev = y
          if y.next is not None:
              y.next.prev = x  # @back
          y.next = x  # @after
  `,
});

const DELETE = listing('delete', {
  pseudocode: `${SEARCH_PSEUDO}
      LIST-DELETE(L, x)
          if x.prev ≠ NIL
              x.prev.next = x.next  // @unlink
          else L.head = x.next  // @behead
          if x.next ≠ NIL
              x.next.prev = x.prev  // @back
  `,
  python: `${SEARCH_PYTHON}
      def list_delete(l, x):
          if x.prev is not None:
              x.prev.next = x.next  # @unlink
          else:
              l.head = x.next  # @behead
          if x.next is not None:
              x.next.prev = x.prev  # @back
  `,
});

/** Records LIST-SEARCH for `key`; returns the node's place, or -1. */
function search(s: ListState, key: number, trace: Trace, on: On): number {
  if (s.keys.length === 0) {
    trace.step('start', `The list is empty: x = L.head is no node at all.`, {
      vars: { k: key },
    });
    trace.step('result', `x has run off the end: ${key} is not in the list.`);
    return -1;
  }
  trace.step(
    'start',
    `x = L.head, which holds ${s.keys[0]}${s.keys[0] === key ? `, the key ${key}` : ''}.`,
    { vars: { k: key } },
  );
  on.pointer({ name: 'head', index: 0 })
    .pointer({ name: 'x', index: 0 })
    .highlight({ indices: [0] });
  let at = 0;
  while (at < s.keys.length && s.keys[at] !== key) {
    at += 1;
    const last = at === s.keys.length;
    trace.step(
      'next',
      last
        ? `${s.keys[at - 1]} ≠ ${key}: x = x.next, past the end of the list.`
        : `${s.keys[at - 1]} ≠ ${key}: x = x.next, which holds ${s.keys[at]}.`,
      { vars: { k: key } },
    );
    on.pointer({ name: 'x', index: last ? null : at });
    if (!last) on.highlight({ indices: [at] });
  }
  const found = at < s.keys.length;
  trace.step(
    'result',
    found
      ? `x holds ${key}: found.`
      : `x has run off the end: ${key} is not in the list.`,
  );
  if (found) on.highlight({ indices: [at] });
  return found ? at : -1;
}

/** Places a new node with `key` at `at` in the row. */
function place(s: ListState, key: number, at: number, on: On) {
  const id = `n${s.made}`;
  on.insert({ index: at, element: { id, value: key } });
  return {
    keys: [...s.keys.slice(0, at), key, ...s.keys.slice(at)],
    ids: [...s.ids.slice(0, at), id, ...s.ids.slice(at)],
    made: s.made + 1,
  };
}

function full(s: ListState, key: number) {
  if (s.keys.length >= MAX_NODES)
    throw new RangeError(
      `The list already has ${MAX_NODES} nodes, the most it shows, so ${key} cannot be added`,
    );
}

function prepend(
  s: ListState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ListState> {
  full(s, key);
  const head = s.keys[0];
  trace.step(
    'link',
    head === undefined
      ? `A new node x holds ${key}: the list is empty, so x has no next node and no previous one.`
      : `A new node x holds ${key}: x.next = L.head, the node of ${head}, and x has no previous node.`,
    { vars: { k: key } },
  );
  const next = place(s, key, 0, on);
  on.pointer({ name: 'x', index: 0 }).highlight({ indices: [0] });
  if (head !== undefined) on.pointer({ name: 'head', index: 1 });
  if (head !== undefined) {
    on.link({ from: 0, to: 1 });
    trace.step(
      'back',
      `The old head, ${head}, points back to x: L.head.prev = x.`,
    );
    on.link({ from: 1, to: 0, field: 'prev' }).highlight({ indices: [1] });
  }
  trace.step('head', `L.head = x: ${key} is the first key.`);
  on.pointer({ name: 'head', index: 0 }).highlight({ indices: [0] });
  return { state: next, result: null };
}

function insert(
  s: ListState,
  key: number,
  after: number,
  trace: Trace,
  on: On,
): Applied<ListState> {
  full(s, key);
  const y = search(s, after, trace, on);
  if (y < 0)
    throw new RangeError(
      `${after} is not in the list, so there is no node to insert ${key} after`,
    );
  const at = y + 1;
  const succ = s.keys[at];
  trace.step(
    'link',
    succ === undefined
      ? `A new node x holds ${key}: y, the node of ${after}, is last, so x has no next node, and x.prev = y.`
      : `A new node x holds ${key}: x.next = y.next, the node of ${succ}, and x.prev = y, the node of ${after}.`,
    { vars: { k: key } },
  );
  const next = place(s, key, at, on);
  on.pointer({ name: 'y', index: y })
    .pointer({ name: 'x', index: at })
    .highlight({ indices: [at] });
  on.link({ from: at, to: succ === undefined ? null : at + 1 });
  on.link({ from: at, to: y, field: 'prev' });
  if (succ !== undefined) {
    trace.step('back', `${succ} points back to x: y.next.prev = x.`);
    on.link({ from: at + 1, to: at, field: 'prev' }).highlight({
      indices: [at + 1],
    });
  }
  trace.step('after', `y.next = x: ${key} follows ${after}.`);
  on.link({ from: y, to: at }).highlight({ indices: [y, at] });
  return { state: next, result: null };
}

function remove(
  s: ListState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ListState> {
  const at = search(s, key, trace, on);
  if (at < 0) return { state: s, result: false };
  const prev = s.keys[at - 1];
  const succ = s.keys[at + 1];
  trace.step(
    prev === undefined ? 'behead' : 'unlink',
    prev === undefined
      ? `x is the head: L.head = x.next, ${succ === undefined ? 'so the list becomes empty' : `the node of ${succ}`}.`
      : `x.prev.next = x.next: ${succ === undefined ? `${prev} is now last` : `${prev} now points to ${succ}`}.`,
    { vars: { k: key } },
  );
  if (prev === undefined)
    on.pointer({ name: 'head', index: succ === undefined ? null : at + 1 });
  else
    on.link({ from: at - 1, to: succ === undefined ? null : at + 1 }).highlight(
      { indices: [at - 1] },
    );
  if (succ !== undefined) {
    trace.step(
      'back',
      `x.next.prev = x.prev: ${prev === undefined ? `${succ} is now first` : `${succ} now points back to ${prev}`}.`,
    );
    on.link({
      from: at + 1,
      to: prev === undefined ? null : at - 1,
      field: 'prev',
    }).highlight({ indices: [at + 1] });
  }
  // Nothing points to x any more: it leaves the drawing in the last step.
  on.pointer({ name: 'x', index: null }).remove({ index: at });
  if (prev === undefined && succ !== undefined)
    on.pointer({ name: 'head', index: 0 });
  return {
    state: {
      ...s,
      keys: s.keys.filter((_, k) => k !== at),
      ids: s.ids.filter((_, k) => k !== at),
    },
    result: true,
  };
}

const op = operationsOf<ListState, ListFrom, 'linkedList'>();
const sample: ListFrom = { keys: [9, 16, 4, 1] };

/** A doubly linked list, as in CLRS. */
export const linkedList = defineStructure<ListState, ListFrom, 'linkedList'>({
  id: 'linked-list',
  title: 'Doubly linked list',
  topic: 'lists',
  summary:
    'Searches, prepends, inserts after a key and deletes keys in a doubly linked list, setting each next and prev pointer as the code does.',
  name: 'L',
  kind: 'linkedList',
  from: z
    .strictObject({
      keys: listField(
        z
          .array(Key)
          .max(MAX_NODES)
          .describe(
            `The keys from the head on, at most ${MAX_NODES}, e.g. [9, 16, 4, 1].`,
          ),
        'number',
      ),
    })
    .describe('The starting list: its keys, from the head on.'),
  examples: [
    {
      from: sample,
      ops: [
        { op: 'prepend', key: 25 },
        { op: 'search', key: 4 },
        { op: 'insert', key: 36, after: 16 },
        { op: 'delete', key: 4 },
      ],
    },
  ],
  start: (from) => ({
    keys: [...from.keys],
    ids: from.keys.map((_, k) => `n${k}`),
    made: from.keys.length,
  }),
  describe: (s) => ({ keys: [...s.keys] }),
  declare: (s) => ({
    kind: 'linkedList',
    doubly: true,
    initial: s.keys.map((value, k) => ({ id: s.ids[k]!, value })),
  }),
  clear(on) {
    on.pointer({ name: 'x', index: null }).pointer({ name: 'y', index: null });
  },
  operations: [
    op({
      name: 'search',
      title: 'search',
      summary:
        'Walks the list from the head until it finds the key or reaches NIL.',
      args: { key: Key.describe('The key to look for.') },
      examples: [
        { from: sample, key: 4 },
        { from: sample, key: 7 },
      ],
      code: SEARCH,
      titleOf: ({ key }) => `search ${key}`,
      apply: (s, { key }, trace, on) => {
        const at = search(s, key, trace, on);
        return { state: s, result: at >= 0 };
      },
    }),
    op({
      name: 'prepend',
      title: 'prepend',
      summary: 'Links a new node with the key in front of the head.',
      args: { key: Key.describe('The key to prepend.') },
      examples: [{ from: sample, key: 25 }],
      code: PREPEND,
      titleOf: ({ key }) => `prepend ${key}`,
      apply: (s, { key }, trace, on) => prepend(s, key, trace, on),
    }),
    op({
      name: 'insert',
      title: 'insert after',
      summary:
        'Finds the node of the key `after`, then links a new node with the key in after it.',
      args: {
        key: Key.describe('The key to insert.'),
        after: Key.describe('The key of the node to insert after.'),
      },
      examples: [{ from: sample, key: 36, after: 16 }],
      code: INSERT,
      titleOf: ({ key, after }) => `insert ${key} after ${after}`,
      apply: (s, { key, after }, trace, on) => insert(s, key, after, trace, on),
    }),
    op({
      name: 'delete',
      title: 'delete',
      summary:
        'Finds the node of the key, then unlinks it by pointing its neighbours at each other.',
      args: { key: Key.describe('The key to delete.') },
      examples: [
        { from: sample, key: 4 },
        { from: sample, key: 9 },
      ],
      code: DELETE,
      titleOf: ({ key }) => `delete ${key}`,
      apply: (s, { key }, trace, on) => remove(s, key, trace, on),
    }),
  ],
});
