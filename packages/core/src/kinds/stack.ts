/**
 * Reducer for the `stack` kind. Positions count from the bottom.
 */
import {
  err,
  ok,
  type Element,
  type Result,
  type StackAction,
  type StackDecl,
} from '@algomotion/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind, StructureState } from '../kind.ts';
import {
  afterRemove,
  checkCapacity,
  checkRange,
  emptyError,
  reindex,
} from './common.ts';

export interface StackMarks {
  /** Positions highlighted in the current step. */
  readonly highlight: readonly number[];
}

export type StackState = StructureState<readonly Element[], StackMarks>;

function reduceStack(
  s: StackState,
  a: StackAction,
): Result<StackState, ReduceError> {
  const n = s.data.length;
  switch (a.type) {
    case 'push': {
      const full = checkCapacity('stack', n);
      if (full) return err(full);
      return ok({ data: [...s.data, a.element], marks: s.marks });
    }
    case 'pop':
      if (n === 0) return err(emptyError('stack', 'pop'));
      return ok({
        data: s.data.slice(0, -1),
        marks: { highlight: reindex(s.marks.highlight, afterRemove(n - 1)) },
      });
    case 'peek':
      if (n === 0) return err(emptyError('stack', 'peek'));
      return ok({ data: s.data, marks: { highlight: [n - 1] } });
    case 'highlight': {
      const bad = checkRange(
        'a stack',
        n,
        n,
        ...a.indices.map((v, k) => [['indices', k], v] as const),
      );
      if (bad) return err(bad);
      return ok({ data: s.data, marks: { highlight: a.indices } });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const stackKind: StructureKind<StackDecl, StackState, StackAction> = {
  init: (decl) => ({ data: decl.initial, marks: { highlight: [] } }),
  beginStep: (s) =>
    s.marks.highlight.length === 0
      ? s
      : { data: s.data, marks: { highlight: [] } },
  reduce: reduceStack,
};
