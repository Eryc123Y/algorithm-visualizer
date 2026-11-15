/**
 * A hash table with chaining (ADR 0023): `hash-chaining.insert` puts a key
 * at the head of the chain of bucket k mod m, as CLRS does, and
 * `hash-chaining.search` walks that chain from the head. A table starts
 * from its size and the keys inserted in order.
 */
import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import { silentHandle, silentTrace, type Trace } from '../../trace.ts';
import { Key, mod, tableFrom, type TableFrom } from './hash.ts';

/** Most keys the table holds, so `after` can always start a new run. */
export const MAX_CHAINED = 24;

interface Entry {
  readonly id: string;
  readonly value: number;
}

export interface ChainState {
  readonly size: number;
  /** Each bucket's chain, head first. */
  readonly chains: readonly (readonly Entry[])[];
  /** The keys in the order they were inserted. */
  readonly keys: readonly number[];
}

type On = Handle<'hashTable'>;

const INSERT = listing('insert', {
  pseudocode: `
    CHAINED-HASH-INSERT(T, k)
        b = k mod m  // @hash
        insert k at the head of the list T[b]  // @insert
  `,
  python: `
    def insert(t, k):
        b = k % len(t)  # @hash
        t[b].insert(0, k)  # @insert
  `,
});

function insert(
  s: ChainState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ChainState> {
  if (s.keys.length >= MAX_CHAINED)
    throw new RangeError(
      `The table is full: it holds at most ${MAX_CHAINED} keys`,
    );
  const b = mod(key, s.size);
  trace.step(
    'hash',
    {
      en: `${key} mod ${s.size} = ${b}: it goes into bucket ${b}.`,
      zh: `${key} mod ${s.size} = ${b}：它放进桶 ${b}。`,
    },
    {
      vars: { k: key, b },
    },
  );
  on.highlight({ bucket: b });
  const entry = { id: `k${s.keys.length}`, value: key };
  trace.step('insert', {
    en: `Put ${key} at the head of bucket ${b}'s chain.`,
    zh: `把 ${key} 放到桶 ${b} 的链表头部。`,
  });
  on.insert({ bucket: b, index: 0, element: entry });
  const chains = s.chains.map((chain, k) =>
    k === b ? [entry, ...chain] : chain,
  );
  return { state: { ...s, chains, keys: [...s.keys, key] }, result: null };
}

const SEARCH = listing('search', {
  pseudocode: `
    CHAINED-HASH-SEARCH(T, k)
        x = T[k mod m].head  // @hash
        while x ≠ NIL
            if x.key == k  // @compare
                return x  // @found
            x = x.next
        return NIL  // @missing
  `,
  python: `
    def search(t, k):
        for x in t[k % len(t)]:  # @hash
            if x == k:  # @compare
                return x  # @found
        return None  # @missing
  `,
});

function search(
  s: ChainState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ChainState> {
  const b = mod(key, s.size);
  trace.step(
    'hash',
    {
      en: `Look for ${key}: ${key} mod ${s.size} = ${b}, so search bucket ${b}.`,
      zh: `查找 ${key}：${key} mod ${s.size} = ${b}，所以在桶 ${b} 中查找。`,
    },
    { vars: { k: key, b } },
  );
  on.highlight({ bucket: b });
  for (const [index, { value }] of s.chains[b]!.entries()) {
    trace.step(
      'compare',
      value === key
        ? {
            en: `${value} = ${key}: this is the key.`,
            zh: `${value} = ${key}：就是这个关键字。`,
          }
        : {
            en: `${value} ≠ ${key}: go on along the chain.`,
            zh: `${value} ≠ ${key}：沿链表继续找。`,
          },
    );
    on.highlight({ bucket: b, indices: [index] });
    if (value === key) {
      trace.step('found', {
        en: `Found ${key} in bucket ${b}.`,
        zh: `在桶 ${b} 中找到 ${key}。`,
      });
      on.settle({ bucket: b, index });
      return { state: s, result: true };
    }
  }
  trace.step('missing', {
    en: `The chain of bucket ${b} has no ${key}: it is not in the table.`,
    zh: `桶 ${b} 的链表中没有 ${key}：它不在表中。`,
  });
  return { state: s, result: false };
}

const op = operationsOf<ChainState, TableFrom, 'hashTable'>();
const sample: TableFrom = { size: 7, keys: [15, 11, 27, 8, 22] };

/** A hash table with chaining, h(k) = k mod m. */
export const hashChaining = defineStructure<ChainState, TableFrom, 'hashTable'>(
  {
    id: 'hash-chaining',
    title: { en: 'Hash table with chaining', zh: '链接法散列表' },
    topic: 'hashing',
    summary: {
      en: 'Inserts and searches integer keys one after another in a hash table that chains the keys of each bucket, with h(k) = k mod m.',
      zh: '在散列表中依次插入和查找整数关键字，每个桶中的关键字用链表链接起来，h(k) = k mod m。',
    },
    name: 't',
    kind: 'hashTable',
    from: tableFrom(MAX_CHAINED, '[15, 11, 27, 8]'),
    examples: [
      {
        from: { size: 7, keys: [] },
        ops: [
          ...[15, 11, 27, 8, 12].map((key) => ({ op: 'insert', key })),
          { op: 'search', key: 8 },
          { op: 'search', key: 5 },
        ],
      },
    ],
    start(from) {
      const trace = silentTrace();
      const on = silentHandle('hashTable');
      const empty: ChainState = {
        size: from.size,
        chains: Array.from({ length: from.size }, () => []),
        keys: [],
      };
      return from.keys.reduce((s, k) => insert(s, k, trace, on).state, empty);
    },
    describe: (s) => ({ size: s.size, keys: [...s.keys] }),
    declare: (s) => ({
      kind: 'hashTable',
      size: s.size,
      initial: s.chains.map((chain) => chain.map((e) => ({ ...e }))),
    }),
    clear(on) {
      on.resetMarks();
    },
    operations: [
      op({
        name: 'insert',
        title: { en: 'insert', zh: '插入' },
        summary: {
          en: 'Inserts a key at the head of the chain of its bucket, k mod m.',
          zh: '把关键字插入它所在的桶 k mod m 的链表头部。',
        },
        args: { key: Key.describe('The integer key to insert.') },
        examples: [{ from: sample, key: 29 }],
        code: INSERT,
        titleOf: ({ key }) => ({ en: `insert ${key}`, zh: `插入 ${key}` }),
        apply: (s, { key }, trace, on) => insert(s, key, trace, on),
      }),
      op({
        name: 'search',
        title: { en: 'search', zh: '查找' },
        summary: {
          en: 'Looks for a key along the chain of its bucket, k mod m, from the head.',
          zh: '从头开始，沿关键字所在的桶 k mod m 的链表查找它。',
        },
        args: { key: Key.describe('The integer key to look for.') },
        examples: [
          { from: sample, key: 15 },
          { from: sample, key: 4 },
        ],
        code: SEARCH,
        titleOf: ({ key }) => ({ en: `search ${key}`, zh: `查找 ${key}` }),
        apply: (s, { key }, trace, on) => search(s, key, trace, on),
      }),
    ],
  },
);
