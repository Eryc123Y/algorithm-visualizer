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
  type Result,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind, StructureState } from '../kind.ts';

export interface ArrayMarks {
  /** Positions being compared in the current step. */
  readonly compare: readonly [number, number] | null;
  /** Positions highlighted in the current step. */
  readonly highlight: readonly number[];
  /** Named pointers such as `i` or `lo`; may point one past the end. */
  readonly pointers: Readonly<Record<string, number>>;
  /** Elements in their final position. Tracked by id so they survive moves. */
  readonly settled: readonly ElementId[];
}

export type ArrayState = StructureState<readonly ArrayElement[], ArrayMarks>;

type Reduced = Result<ArrayState, ReduceError>;

/** Checks that the index at each action path is below `limit`. */
function checkRange(
  state: ArrayState,
  limit: number,
  ...indices: readonly (readonly [readonly PropertyKey[], number])[]
): ReduceError | undefined {
  for (const [path, index] of indices) {
    if (index >= limit) {
      const n = state.data.length;
      const field = path
        .map((key) => (typeof key === 'number' ? `[${key}]` : String(key)))
        .join('');
      return {
        code: 'OUT_OF_RANGE',
        path,
        message: `${field}=${index} is out of range for an array of length ${n}`,
        hint:
          limit === 0
            ? 'The array is empty.'
            : `Valid values are 0 to ${limit - 1}.`,
      };
    }
  }
  return undefined;
}

const withData = (s: ArrayState, data: readonly ArrayElement[]): Reduced =>
  ok({ data, marks: s.marks });

const withMarks = (s: ArrayState, marks: Partial<ArrayMarks>): Reduced =>
  ok({ data: s.data, marks: { ...s.marks, ...marks } });

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
      return withData(s, data);
    }
    case 'insert': {
      const bad = checkRange(s, n + 1, [['index'], a.index]);
      if (bad) return err(bad);
      if (s.data.some((e) => e.id === a.element.id)) {
        return err({
          code: 'DUPLICATE_ID',
          path: ['element', 'id'],
          message: `An element with id "${a.element.id}" already exists`,
          hint: 'Give the inserted element a new id.',
        });
      }
      return withData(s, [
        ...s.data.slice(0, a.index),
        a.element,
        ...s.data.slice(a.index),
      ]);
    }
    case 'remove': {
      const bad = checkRange(s, n, [['index'], a.index]);
      if (bad) return err(bad);
      const removed = s.data[a.index]!.id;
      return ok({
        data: s.data.filter((_, k) => k !== a.index),
        marks: {
          ...s.marks,
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

export const arrayKind: StructureKind<
  ArrayDecl,
  readonly ArrayElement[],
  ArrayMarks,
  ArrayAction
> = {
  kind: 'array',
  init: (decl) => ({
    data: decl.initial,
    marks: { compare: null, highlight: [], pointers: {}, settled: [] },
  }),
  beginStep: (s) =>
    s.marks.compare === null && s.marks.highlight.length === 0
      ? s
      : { data: s.data, marks: { ...s.marks, compare: null, highlight: [] } },
  reduce: reduceArray,
};
