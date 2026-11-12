/**
 * Reducer for the `hashTable` kind.
 */
import {
  err,
  LIMITS,
  ok,
  type Element,
  type HashTableAction,
  type HashTableDecl,
  type Result,
} from '@algomotion/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';
import { checkCapacity, checkRange, insertAt, removeAt } from './common.ts';

export interface HashTableMarks {
  /** Highlighted bucket and element ids, this step. */
  readonly bucket: number | null;
  readonly highlight: readonly string[];
  /** Found elements, by id. */
  readonly settled: readonly string[];
}

export interface HashTableState {
  readonly data: readonly (readonly Element[])[];
  readonly marks: HashTableMarks;
}

type Reduced = Result<HashTableState, ReduceError>;

const emptyMarks: HashTableMarks = { bucket: null, highlight: [], settled: [] };

function reduceHashTable(s: HashTableState, a: HashTableAction): Reduced {
  if (a.type === 'resetMarks') return ok({ data: s.data, marks: emptyMarks });
  const buckets = s.data.length;
  if (a.bucket >= buckets)
    return err({
      code: 'OUT_OF_RANGE',
      path: ['bucket'],
      message: `bucket=${a.bucket} is out of range for a table of ${buckets} buckets`,
      hint: `Buckets are 0 to ${buckets - 1}.`,
    });
  const chain = s.data[a.bucket]!;
  const inChain = (limit: number, ...indices: [string, number][]) =>
    checkRange(
      `bucket ${a.bucket}'s chain`,
      chain.length,
      limit,
      ...indices.map(([key, index]) => [[key], index] as const),
    );
  const withChain = (next: readonly Element[], marks = s.marks): Reduced =>
    ok({
      data: s.data.map((c, b) => (b === a.bucket ? next : c)),
      marks,
    });

  switch (a.type) {
    case 'insert': {
      const total = s.data.reduce((n, c) => n + c.length, 0);
      const index = a.index ?? chain.length;
      const bad =
        inChain(chain.length + 1, ['index', index]) ??
        checkCapacity('hash table', total, LIMITS.elementsPerStructure);
      if (bad) return err(bad);
      return withChain(insertAt(chain, index, a.element));
    }
    case 'remove': {
      const bad = inChain(chain.length, ['index', a.index]);
      if (bad) return err(bad);
      const gone = chain[a.index]!.id;
      return withChain(removeAt(chain, a.index), {
        ...s.marks,
        highlight: s.marks.highlight.filter((id) => id !== gone),
        settled: s.marks.settled.filter((id) => id !== gone),
      });
    }
    case 'set': {
      const bad = inChain(chain.length, ['index', a.index]);
      if (bad) return err(bad);
      return withChain(
        chain.map((e, k) => (k === a.index ? { ...e, value: a.value } : e)),
      );
    }
    case 'highlight': {
      const indices = a.indices ?? [];
      for (const [k, index] of indices.entries()) {
        const bad = checkRange(
          `bucket ${a.bucket}'s chain`,
          chain.length,
          chain.length,
          [['indices', k], index],
        );
        if (bad) return err(bad);
      }
      return ok({
        data: s.data,
        marks: {
          ...s.marks,
          bucket: a.bucket,
          highlight: indices.map((k) => chain[k]!.id),
        },
      });
    }
    case 'settle': {
      const bad = inChain(chain.length, ['index', a.index]);
      if (bad) return err(bad);
      const id = chain[a.index]!.id;
      if (s.marks.settled.includes(id)) return ok(s);
      return ok({
        data: s.data,
        marks: { ...s.marks, settled: [...s.marks.settled, id] },
      });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const hashTableKind: StructureKind<
  HashTableDecl,
  HashTableState,
  HashTableAction
> = {
  init: (decl) => ({ data: decl.buckets, marks: emptyMarks }),
  beginStep: (s) =>
    s.marks.bucket === null && s.marks.highlight.length === 0
      ? s
      : { data: s.data, marks: { ...s.marks, bucket: null, highlight: [] } },
  reduce: reduceHashTable,
};
