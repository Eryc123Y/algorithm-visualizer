/**
 * Reducer for the `queue` kind (a deque). Positions count from the front.
 */
import {
  err,
  ok,
  type Element,
  type QueueAction,
  type QueueDecl,
  type Result,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind, StructureState } from '../kind.ts';
import {
  afterInsert,
  afterRemove,
  checkCapacity,
  checkRange,
  emptyError,
  reindex,
  type Reindex,
} from './common.ts';

export interface QueueMarks {
  /** Positions highlighted in the current step. */
  readonly highlight: readonly number[];
}

export type QueueState = StructureState<readonly Element[], QueueMarks>;

function reduceQueue(
  s: QueueState,
  a: QueueAction,
): Result<QueueState, ReduceError> {
  const n = s.data.length;
  // This step's highlights follow their elements as the ends change.
  const withData = (data: readonly Element[], f?: Reindex) =>
    ok({
      data,
      marks:
        f === undefined
          ? s.marks
          : { highlight: reindex(s.marks.highlight, f) },
    });
  switch (a.type) {
    case 'enqueue':
    case 'pushFront': {
      const full = checkCapacity('queue', n);
      if (full) return err(full);
      return a.type === 'enqueue'
        ? withData([...s.data, a.element])
        : withData([a.element, ...s.data], afterInsert(0));
    }
    case 'dequeue':
      if (n === 0) return err(emptyError('queue', 'dequeue'));
      return withData(s.data.slice(1), afterRemove(0));
    case 'popBack':
      if (n === 0) return err(emptyError('queue', 'pop from the back of'));
      return withData(s.data.slice(0, -1), afterRemove(n - 1));
    case 'peek':
      if (n === 0) return err(emptyError('queue', 'peek'));
      return ok({
        data: s.data,
        marks: { highlight: [a.end === 'back' ? n - 1 : 0] },
      });
    case 'highlight': {
      const bad = checkRange(
        'a queue',
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

export const queueKind: StructureKind<QueueDecl, QueueState, QueueAction> = {
  init: (decl) => ({ data: decl.initial, marks: { highlight: [] } }),
  beginStep: (s) =>
    s.marks.highlight.length === 0
      ? s
      : { data: s.data, marks: { highlight: [] } },
  reduce: reduceQueue,
};
