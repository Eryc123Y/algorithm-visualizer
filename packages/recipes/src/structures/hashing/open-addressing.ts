/**
 * Hash tables with open addressing (ADR 0023): a key k tries the slots
 * h(k, 0), h(k, 1), …, h(k, m - 1) of its probe sequence. `insert` stores
 * it in the first empty one, and `search` stops at the key, at an empty
 * slot, or after m probes. A table starts from its size and the keys
 * inserted in order. Linear probing, quadratic probing and double hashing
 * differ only in h, given to `openAddressing`.
 *
 * Equal keys take a slot each, as in CLRS. A found key is highlighted and
 * pointed at rather than settled: an array has no action that clears a
 * settled mark, so it would stay through the operations that follow.
 */
import type { Handle } from '../../recorder.ts';
import type { Listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import { silentHandle, silentTrace, type Trace } from '../../trace.ts';
import { Key, MAX_SLOTS, tableFrom, type TableFrom } from './hash.ts';

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

/** How a table finds the slots of a key's probe sequence. */
export interface Scheme {
  /** h(k, i) for a table of `size` slots. */
  slot(key: number, i: number, size: number): number;
  /** The narration of the i-th probe, at slot q; `holds` says what is there. */
  narrate(
    key: number,
    i: number,
    q: number,
    size: number,
    holds: string,
  ): string;
  /** Why a table of `size` slots cannot be used, if it cannot. */
  unfit?(size: number): string | undefined;
}

/** Narrates the i-th probe of `key`, at slot q. */
function probe(
  scheme: Scheme,
  s: ProbingState,
  key: number,
  i: number,
  q: number,
  trace: Trace,
  on: On,
): void {
  trace.step('probe', scheme.narrate(key, i, q, s.size, holds(s, q)), {
    vars: { k: key, i, q },
  });
  on.pointer({ name: 'q', index: q }).highlight({ indices: [q] });
}

function insert(
  scheme: Scheme,
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
    const q = scheme.slot(key, i, s.size);
    probe(scheme, s, key, i, q, trace, on);
    if (s.slots[q] !== null) continue;
    trace.step('store', `Store ${key} in slot ${q}.`);
    on.set({ index: q, value: key });
    const slots = s.slots.map((x, k) => (k === q ? key : x));
    return { state: { ...s, slots, keys: [...s.keys, key] }, result: null };
  }
  // A table with fewer keys than slots has an empty one.
  throw new Error(`No empty slot for ${key}`);
}

function search(
  scheme: Scheme,
  s: ProbingState,
  key: number,
  trace: Trace,
  on: On,
): Applied<ProbingState> {
  for (let i = 0; i < s.size; i++) {
    const q = scheme.slot(key, i, s.size);
    probe(scheme, s, key, i, q, trace, on);
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

/** What an open-addressing table needs besides its probe sequence. */
export interface OpenAddressing {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly scheme: Scheme;
  readonly code: { readonly insert: Listing; readonly search: Listing };
  /** What the operations' summaries say the probe sequence is. */
  readonly sequence: string;
  /** The table of the operations' examples. */
  readonly sample: TableFrom;
  /** The module's run, from an empty table of the sample's size. */
  readonly run: readonly {
    readonly op: 'insert' | 'search';
    readonly key: number;
  }[];
  readonly examples: {
    readonly insert: number;
    readonly found: number;
    readonly missing: number;
  };
}

/** A hash table with open addressing and the probe sequence of `table`. */
export function openAddressing(table: OpenAddressing) {
  const { scheme, sample } = table;
  return defineStructure<ProbingState, TableFrom, 'array'>({
    id: table.id,
    title: table.title,
    topic: 'hashing',
    summary: table.summary,
    name: 't',
    kind: 'array',
    from: tableFrom(MAX_SLOTS, '[15, 11, 27, 8]'),
    examples: [
      {
        from: { size: sample.size, keys: [] },
        ops: table.run.map(({ op, key }) => ({ op, key })),
      },
    ],
    start(from) {
      const unfit = scheme.unfit?.(from.size);
      if (unfit !== undefined) throw new RangeError(unfit);
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
      return from.keys.reduce(
        (s, k) => insert(scheme, s, k, trace, on).state,
        empty,
      );
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
        summary: `Inserts a key into the first empty slot of its probe sequence, ${table.sequence}.`,
        args: { key: Key.describe('The integer key to insert.') },
        examples: [{ from: sample, key: table.examples.insert }],
        code: table.code.insert,
        titleOf: ({ key }) => `insert ${key}`,
        apply: (s, { key }, trace, on) => insert(scheme, s, key, trace, on),
      }),
      op({
        name: 'search',
        title: 'search',
        summary:
          'Looks for a key along its probe sequence, stopping at the key, at an empty slot, or after m probes.',
        args: { key: Key.describe('The integer key to look for.') },
        examples: [
          { from: sample, key: table.examples.found },
          { from: sample, key: table.examples.missing },
        ],
        code: table.code.search,
        titleOf: ({ key }) => `search ${key}`,
        apply: (s, { key }, trace, on) => search(scheme, s, key, trace, on),
      }),
    ],
  });
}
