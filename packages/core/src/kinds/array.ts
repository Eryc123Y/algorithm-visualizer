/**
 * Reducer for the `array` kind. See @algoviz/spec for the action schemas and
 * their documented mark semantics.
 */
import {
  err,
  ok,
  type ArrayAction,
  type ArrayDecl,
  type ArrayElement,
  type ElementId,
  LIMITS,
  type Result,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import {
  afterInsert,
  afterRemove,
  checkRange as checkLimit,
  reindex,
  reindexPair,
  type Reindex,
} from './common.ts';
import type { StructureKind, StructureState } from '../kind.ts';

export interface ArrayMarks {
  /** Positions being compared in the current step. */
  readonly compare: readonly [number, number] | null;
  /** Positions swapped in the current step. */
  readonly swapped: readonly [number, number] | null;
  /** Positions highlighted in the current step. */
  readonly highlight: readonly number[];
  /** Named pointers such as `i` or `lo`; may point one past the end. */
  readonly pointers: Readonly<Record<string, number>>;
  /** Elements in their final position. Tracked by id so they survive moves. */
  readonly settled: readonly ElementId[];
}

export type ArrayState = StructureState<readonly ArrayElement[], ArrayMarks>;

type Reduced = Result<ArrayState, ReduceError>;

const checkRange = (
  s: ArrayState,
  limit: number,
  ...indices: readonly (readonly [readonly PropertyKey[], number])[]
) => checkLimit('an array', s.data.length, limit, ...indices);

const withData = (s: ArrayState, data: readonly ArrayElement[]): Reduced =>
  ok({ data, marks: s.marks });

const withMarks = (s: ArrayState, marks: Partial<ArrayMarks>): Reduced =>
  ok({ data: s.data, marks: { ...s.marks, ...marks } });

/**
 * Marks after a change of shape: this step's marks follow their elements;
 * pointers are positions, like the variables they show, so they stay but
 * never point past one beyond the new end.
 */
const moveMarks = (m: ArrayMarks, f: Reindex, length: number): ArrayMarks => ({
  ...m,
  compare: reindexPair(m.compare, f),
  swapped: reindexPair(m.swapped, f),
  highlight: reindex(m.highlight, f),
  pointers: Object.fromEntries(
    Object.entries(m.pointers).map(([name, k]) => [name, Math.min(k, length)]),
  ),
});

function reduceArray(s: ArrayState, a: ArrayAction): Reduced {
  const n = s.data.length;
  // Most actions address existing positions (< n); insert and pointer may
  // also address the position one past the end (<= n).

  switch (a.type) {
    case 'set': {
      const bad = checkRange(s, n, [['index'], a.index]);
      if (bad) return err(bad);
      return withData(
        s,
        s.data.map((e, k) =>
          k === a.index ? { id: e.id, value: a.value } : e,
        ),
      );
    }
    case 'swap': {
      const bad = checkRange(s, n, [['i'], a.i], [['j'], a.j]);
      if (bad) return err(bad);
      const data = s.data.slice();
      // Both indices were checked above.
      [data[a.i], data[a.j]] = [data[a.j]!, data[a.i]!];
      return ok({ data, marks: { ...s.marks, swapped: [a.i, a.j] } });
    }
    case 'insert': {
      const bad = checkRange(s, n + 1, [['index'], a.index]);
      if (bad) return err(bad);
      if (n >= LIMITS.elementsPerStructure) {
        return err({
          code: 'LIMIT_EXCEEDED',
          path: [],
          message: `An array may hold at most ${LIMITS.elementsPerStructure} elements`,
          hint: 'Remove elements before inserting more, or visualize a smaller input.',
        });
      }
      if (s.data.some((e) => e.id === a.element.id)) {
        return err({
          code: 'DUPLICATE_ID',
          path: ['element', 'id'],
          message: `An element with id "${a.element.id}" already exists`,
          hint: 'Give the inserted element a new id.',
        });
      }
      return ok({
        data: [
          ...s.data.slice(0, a.index),
          a.element,
          ...s.data.slice(a.index),
        ],
        marks: moveMarks(s.marks, afterInsert(a.index), n + 1),
      });
    }
    case 'remove': {
      const bad = checkRange(s, n, [['index'], a.index]);
      if (bad) return err(bad);
      const removed = s.data[a.index]!.id;
      return ok({
        data: s.data.filter((_, k) => k !== a.index),
        marks: {
          ...moveMarks(s.marks, afterRemove(a.index), n - 1),
          settled: s.marks.settled.filter((id) => id !== removed),
        },
      });
    }
    case 'compare': {
      const bad = checkRange(s, n, [['i'], a.i], [['j'], a.j]);
      if (bad) return err(bad);
      return withMarks(s, { compare: [a.i, a.j] });
    }
    case 'highlight': {
      const fields = a.indices.map((v, k) => [['indices', k], v] as const);
      const bad = checkRange(s, n, ...fields);
      if (bad) return err(bad);
      return withMarks(s, { highlight: a.indices });
    }
    case 'pointer': {
      if (a.index === null) {
        const pointers = Object.fromEntries(
          Object.entries(s.marks.pointers).filter(([name]) => name !== a.name),
        );
        return withMarks(s, { pointers });
      }
      const bad = checkRange(s, n + 1, [['index'], a.index]);
      if (bad) return err(bad);
      return withMarks(s, {
        pointers: { ...s.marks.pointers, [a.name]: a.index },
      });
    }
    case 'settle': {
      const bad = checkRange(s, n, [['index'], a.index]);
      if (bad) return err(bad);
      const id = s.data[a.index]!.id;
      if (s.marks.settled.includes(id)) return ok(s);
      return withMarks(s, { settled: [...s.marks.settled, id] });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const arrayKind: StructureKind<ArrayDecl, ArrayState, ArrayAction> = {
  init: (decl) => ({
    data: decl.initial,
    marks: {
      compare: null,
      swapped: null,
      highlight: [],
      pointers: {},
      settled: [],
    },
  }),
  beginStep: (s) =>
    s.marks.compare === null &&
    s.marks.swapped === null &&
    s.marks.highlight.length === 0
      ? s
      : {
          data: s.data,
          marks: { ...s.marks, compare: null, swapped: null, highlight: [] },
        },
  reduce: reduceArray,
};
