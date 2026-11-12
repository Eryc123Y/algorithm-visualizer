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

/** A pattern aligned under the text (ADR 0037). */
export interface ArrayPattern {
  readonly elements: readonly ArrayElement[];
  /** Text position under the pattern's first element. */
  readonly shift: number;
  /** Pattern positions known to match the text above, in this alignment. */
  readonly matched: readonly number[];
  /** The pattern position compared in this step, or null. */
  readonly compared: number | null;
}

export type ArrayState = StructureState<readonly ArrayElement[], ArrayMarks> & {
  /** Present when the array declares a pattern. */
  readonly pattern?: ArrayPattern;
};

type Reduced = Result<ArrayState, ReduceError>;

const checkRange = (
  s: ArrayState,
  limit: number,
  ...indices: readonly (readonly [readonly PropertyKey[], number])[]
) => checkLimit('an array', s.data.length, limit, ...indices);

const withData = (s: ArrayState, data: readonly ArrayElement[]): Reduced =>
  ok({ data, marks: s.marks });

const withMarks = (s: ArrayState, marks: Partial<ArrayMarks>): Reduced =>
  ok({ ...s, marks: { ...s.marks, ...marks } });

/** Actions that move or change the text, which a pattern fixes. */
const CHANGES_TEXT: ReadonlySet<string> = new Set([
  'set',
  'swap',
  'insert',
  'remove',
]);

const noPattern = (): ReduceError => ({
  code: 'INVALID_OPERATION',
  path: [],
  message: 'This array has no pattern',
  hint: 'Declare one with `pattern` (version 0.8).',
});

/** `align`: the pattern moves, and its first `matched` elements match. */
function align(
  s: ArrayState,
  p: ArrayPattern,
  shift: number,
  matched: number,
): Reduced {
  const n = s.data.length;
  const m = p.elements.length;
  const bad =
    checkRange(s, n + 1, [['shift'], shift]) ??
    checkLimit('the pattern', m, m + 1, [['matched'], matched]);
  if (bad) return err(bad);
  if (shift + matched > n)
    return err({
      code: 'OUT_OF_RANGE',
      path: ['matched'],
      message: `${matched} pattern elements at shift ${shift} reach past the end of the text of ${n}`,
      hint: `At shift ${shift}, at most ${n - shift} can match.`,
    });
  for (let j = 0; j < matched; j++) {
    const [pv, tv] = [p.elements[j]!.value, s.data[shift + j]!.value];
    if (pv !== tv)
      return err({
        code: 'INVALID_OPERATION',
        path: ['matched'],
        message: `Pattern element ${j} (${JSON.stringify(pv)}) is not text element ${shift + j} (${JSON.stringify(tv)}), so the first ${matched} do not match`,
        hint: 'Give the number of leading pattern elements that equal the text under them.',
      });
  }
  const pattern: ArrayPattern = {
    ...p,
    shift,
    matched: Array.from({ length: matched }, (_, j) => j),
    compared: null,
  };
  return ok({ ...s, pattern });
}

/** `check`: pattern element `j` against the text above it. */
function check(s: ArrayState, p: ArrayPattern, j: number): Reduced {
  const m = p.elements.length;
  const bad = checkLimit('the pattern', m, m, [['j'], j]);
  if (bad) return err(bad);
  const at = p.shift + j;
  if (at >= s.data.length)
    return err({
      code: 'OUT_OF_RANGE',
      path: ['j'],
      message: `Pattern element ${j} is at text position ${at}, past the end of the text of ${s.data.length}`,
      hint: 'Check only the pattern elements under the text.',
    });
  const equal = p.elements[j]!.value === s.data[at]!.value;
  const matched =
    equal && !p.matched.includes(j) ? [...p.matched, j] : p.matched;
  return ok({ ...s, pattern: { ...p, matched, compared: j } });
}

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
  if (s.pattern !== undefined && CHANGES_TEXT.has(a.type))
    return err({
      code: 'INVALID_OPERATION',
      path: [],
      message: 'The text is fixed while a pattern is aligned under it',
      hint: 'Use an array without a pattern to change its elements.',
    });
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
    case 'align':
      return s.pattern === undefined
        ? err(noPattern())
        : align(s, s.pattern, a.shift, a.matched ?? 0);
    case 'check':
      return s.pattern === undefined
        ? err(noPattern())
        : check(s, s.pattern, a.j);
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
    ...(decl.pattern === undefined
      ? {}
      : {
          pattern: {
            elements: decl.pattern,
            shift: decl.shift ?? 0,
            matched: [],
            compared: null,
          },
        }),
  }),
  beginStep: (s) => {
    const marksClear =
      s.marks.compare === null &&
      s.marks.swapped === null &&
      s.marks.highlight.length === 0;
    const compared = s.pattern?.compared ?? null;
    if (marksClear && compared === null) return s;
    return {
      ...s,
      marks: marksClear
        ? s.marks
        : { ...s.marks, compare: null, swapped: null, highlight: [] },
      ...(s.pattern === undefined || compared === null
        ? {}
        : { pattern: { ...s.pattern, compared: null } }),
    };
  },
  reduce: reduceArray,
};
