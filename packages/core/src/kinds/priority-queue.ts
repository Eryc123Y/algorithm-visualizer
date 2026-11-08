/**
 * Reducer for the `priorityQueue` kind (ADR 0029).
 *
 * The state keeps the items in insertion order, which breaks ties, and the
 * queue's order; `queueOrder` gives the items front first. A reducer does
 * not see its declaration, so the order is part of the state.
 */
import {
  err,
  ok,
  type PriorityItem,
  type PriorityKey,
  type PriorityQueueAction,
  type PriorityQueueDecl,
  type Result,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind, StructureState } from '../kind.ts';
import { checkCapacity, emptyError, notFound } from './common.ts';

export type PriorityOrder = 'min' | 'max';

export interface PriorityQueueData {
  /** Which key is at the front: the least (`min`) or the greatest. */
  readonly order: PriorityOrder;
  /** Items in insertion order; `queueOrder` sorts them by key. */
  readonly items: readonly PriorityItem[];
}

export interface PriorityQueueMarks {
  /** Ids of the items highlighted in the current step. */
  readonly highlight: readonly string[];
}

export type PriorityQueueState = StructureState<
  PriorityQueueData,
  PriorityQueueMarks
>;

/**
 * Orders two keys, front first: by value in the queue's order, with a null
 * key (none yet) after every number.
 */
export function compareKeys(
  order: PriorityOrder,
  a: PriorityKey,
  b: PriorityKey,
): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return order === 'min' ? a - b : b - a;
}

/** The items front first: by key, ties in insertion order. */
export function queueOrder(data: PriorityQueueData): PriorityItem[] {
  return data.items
    .map((item, k) => ({ item, k }))
    .sort(
      (p, q) => compareKeys(data.order, p.item.key, q.item.key) || p.k - q.k,
    )
    .map(({ item }) => item);
}

/** The id of the front item, if there is one. */
const frontOf = (data: PriorityQueueData): string | undefined =>
  queueOrder(data)[0]?.id;

const WHAT = 'priority queue';

function reducePriorityQueue(
  s: PriorityQueueState,
  a: PriorityQueueAction,
): Result<PriorityQueueState, ReduceError> {
  const { items } = s.data;
  const indexOf = (id: string) => items.findIndex((item) => item.id === id);
  switch (a.type) {
    case 'insert': {
      const full = checkCapacity(WHAT, items.length);
      if (full) return err(full);
      if (indexOf(a.element.id) >= 0)
        return err({
          code: 'DUPLICATE_ID',
          path: ['element', 'id'],
          message: `The ${WHAT} already holds an item with id "${a.element.id}"`,
          hint: 'Give every item an id of its own.',
        });
      const item = { ...a.element, key: a.key };
      return ok({
        data: { ...s.data, items: [...items, item] },
        marks: s.marks,
      });
    }
    case 'extract': {
      const front = frontOf(s.data);
      if (front === undefined) return err(emptyError(WHAT, 'extract from'));
      return ok({
        data: { ...s.data, items: items.filter((item) => item.id !== front) },
        marks: { highlight: s.marks.highlight.filter((id) => id !== front) },
      });
    }
    case 'setKey': {
      const k = indexOf(a.id);
      if (k < 0) return err(notFound(['id'], a.id, 'item'));
      return ok({
        data: {
          ...s.data,
          items: items.map((item, j) =>
            j === k ? { ...item, key: a.key } : item,
          ),
        },
        marks: {
          highlight: s.marks.highlight.includes(a.id)
            ? s.marks.highlight
            : [...s.marks.highlight, a.id],
        },
      });
    }
    case 'peek': {
      const front = frontOf(s.data);
      if (front === undefined) return err(emptyError(WHAT, 'peek at'));
      return ok({ data: s.data, marks: { highlight: [front] } });
    }
    case 'highlight': {
      const missing = a.ids.findIndex((id) => indexOf(id) < 0);
      if (missing >= 0)
        return err(notFound(['ids', missing], a.ids[missing]!, 'item'));
      return ok({ data: s.data, marks: { highlight: [...new Set(a.ids)] } });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const priorityQueueKind: StructureKind<
  PriorityQueueDecl,
  PriorityQueueState,
  PriorityQueueAction
> = {
  init: (decl) => ({
    data: { order: decl.order ?? 'min', items: decl.initial },
    marks: { highlight: [] },
  }),
  beginStep: (s) =>
    s.marks.highlight.length === 0
      ? s
      : { data: s.data, marks: { highlight: [] } },
  reduce: reducePriorityQueue,
};
