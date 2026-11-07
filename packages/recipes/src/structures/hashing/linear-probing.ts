/**
 * A hash table with open addressing and linear probing (ADR 0023): a key
 * k tries the slots h(k, i) = (k + i) mod m for i = 0, 1, …, m - 1.
 * `linear-probing.insert` stores it in the first empty one, and
 * `linear-probing.search` stops at the key, at an empty slot, or after m
 * probes. A table starts from its size and the keys inserted in order.
 *
 * Equal keys take a slot each, as in CLRS. A found key is highlighted and
 * pointed at rather than settled: an array has no action that clears a
 * settled mark, so it would stay through the operations that follow.
 */
import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import { silentHandle, silentTrace, type Trace } from '../../trace.ts';
import { Key, MAX_SLOTS, mod, tableFrom, type TableFrom } from './hash.ts';

export interface ProbingState {
  readonly size: number;
  /** The key in each slot, or null for an empty one. */
  readonly slots: readonly (number | null)[];
  /** The keys in the order they were inserted. */
  readonly keys: readonly number[];
}

type On = Handle<'array'>;

/** What a probe of slot q finds, for narrations. */
const holds = (s: ProbingState, q: number) =>
  s.slots[q] === null ? 'it is empty' : `it holds ${s.slots[q]}`;

/** Narrates the i-th probe of `key`, at slot q. */
function probe(
  s: ProbingState,
  key: number,
  i: number,
  q: number,
  trace: Trace,
  on: On,
): void {
  trace.step(
    'probe',
    i === 0
      ? `${key} mod ${s.size} = ${q}: probe slot ${q}; ${holds(s, q)}.`
      : `Probe the next slot, ${q}; ${holds(s, q)}.`,
    { vars: { k: key, i, q } },
  );
  on.pointer({ name: 'q', index: q }).highlight({ indices: [q] });
}

const INSERT = listing('insert', {
  pseudocode: `
    HASH-INSERT(T, k)
        for i = 0 to m - 1
            q = (k + i) mod m  // @probe
            if T[q] == NIL
                T[q] = k  // @store
                return q
        error "hash table overflow"
  `,
  python: `
    def insert(t, k):
        m = len(t)
        for i in range(m):
            q = (k + i) % m  # @probe
            if t[q] is None:
                t[q] = k  # @store
                return q
        raise OverflowError('hash table overflow')
  `,
});

function insert(
  s: ProbingState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ProbingState> {
  if (s.keys.length >= s.size)
    throw new RangeError(
      `The table is full: all ${s.size} slots hold keys, so ${key} cannot be inserted`,
    );
  for (let i = 0; i < s.size; i++) {
    const q = mod(mod(key, s.size) + i, s.size);
    probe(s, key, i, q, trace, on);
    if (s.slots[q] !== null) continue;
    trace.step('store', `Store ${key} in slot ${q}.`);
    on.set({ index: q, value: key });
    const slots = s.slots.map((x, k) => (k === q ? key : x));
    return { state: { ...s, slots, keys: [...s.keys, key] }, result: null };
  }
  // A table with fewer keys than slots has an empty one.
  throw new Error(`No empty slot for ${key}`);
}

const SEARCH = listing('search', {
  pseudocode: `
    HASH-SEARCH(T, k)
        for i = 0 to m - 1
            q = (k + i) mod m  // @probe
            if T[q] == k
                return q  // @found
            if T[q] == NIL
                return NIL  // @missing
        return NIL  // @exhausted
  `,
  python: `
    def search(t, k):
        m = len(t)
        for i in range(m):
            q = (k + i) % m  # @probe
            if t[q] == k:
                return q  # @found
            if t[q] is None:
                return None  # @missing
        return None  # @exhausted
  `,
});

function search(
  s: ProbingState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ProbingState> {
  for (let i = 0; i < s.size; i++) {
    const q = mod(mod(key, s.size) + i, s.size);
    probe(s, key, i, q, trace, on);
    if (s.slots[q] === key) {
      trace.step('found', `Found ${key} in slot ${q}.`);
      on.highlight({ indices: [q] });
      return { state: s, result: true };
    }
    if (s.slots[q] === null) {
      trace.step(
        'missing',
        `Slot ${q} is empty, so ${key} is not in the table.`,
      );
      return { state: s, result: false };
    }
  }
  trace.step(
    'exhausted',
    `All ${s.size} slots were probed: ${key} is not in the table.`,
  );
  on.pointer({ name: 'q', index: null });
  return { state: s, result: false };
}

const op = operationsOf<ProbingState, TableFrom, 'array'>();
const sample: TableFrom = { size: 7, keys: [15, 11, 27, 8, 22] };

/** A hash table with linear probing, h(k, i) = (k + i) mod m. */
export const linearProbing = defineStructure<ProbingState, TableFrom, 'array'>({
  id: 'linear-probing',
  title: 'Hash table with linear probing',
  topic: 'hashing',
  summary:
    'Inserts and searches integer keys one after another in a hash table that probes the slots (k + i) mod m for i = 0, 1, and so on.',
  name: 't',
  kind: 'array',
  from: tableFrom(MAX_SLOTS, '[15, 11, 27, 8]'),
  examples: [
    {
      from: { size: 7, keys: [] },
      ops: [
        ...[15, 11, 27, 8, 22].map((key) => ({ op: 'insert', key })),
        { op: 'search', key: 22 },
        { op: 'search', key: 5 },
      ],
    },
  ],
  start(from) {
    if (from.keys.length > from.size)
      throw new RangeError(
        `${from.keys.length} keys do not fit into ${from.size} slots`,
      );
    const trace = silentTrace();
    const on = silentHandle('array');
    const empty: ProbingState = {
      size: from.size,
      slots: Array.from({ length: from.size }, () => null),
      keys: [],
    };
    return from.keys.reduce((s, k) => insert(s, k, trace, on).state, empty);
  },
  describe: (s) => ({ size: s.size, keys: [...s.keys] }),
  declare: (s) => ({
    kind: 'array',
    initial: s.slots.map((key, q) => ({ id: `s${q}`, value: key ?? '' })),
  }),
  clear(on) {
    on.pointer({ name: 'q', index: null });
  },
  operations: [
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts a key into the first empty slot of its probe sequence, (k + i) mod m for i = 0, 1, and so on.',
      args: { key: Key.describe('The integer key to insert.') },
      examples: [{ from: sample, key: 29 }],
      code: INSERT,
      titleOf: ({ key }) => `insert ${key}`,
      apply: (s, { key }, trace, on) => insert(s, key, trace, on),
    }),
    op({
      name: 'search',
      title: 'search',
      summary:
        'Looks for a key along its probe sequence, stopping at the key, at an empty slot, or after m probes.',
      args: { key: Key.describe('The integer key to look for.') },
      examples: [
        { from: sample, key: 22 },
        { from: sample, key: 4 },
      ],
      code: SEARCH,
      titleOf: ({ key }) => `search ${key}`,
      apply: (s, { key }, trace, on) => search(s, key, trace, on),
    }),
  ],
});
