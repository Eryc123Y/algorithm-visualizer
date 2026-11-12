/**
 * Reducer for the `linkedList` kind. Nodes sit in a row; `next` / `prev`
 * pointers are explicit node ids, independent of the row order. Named
 * pointers (`head`, `curr`, …) refer to nodes by id, so they follow a node
 * when the row shifts and disappear when it is removed.
 */
import {
  err,
  ok,
  type LinkedListAction,
  type LinkedListDecl,
  type Result,
  type Scalar,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';
import {
  afterInsert,
  afterMove,
  afterRemove,
  checkCapacity,
  checkRange,
  insertAt,
  reindex,
  without,
} from './common.ts';

export interface ListNode {
  readonly id: string;
  readonly value: Scalar;
  readonly next: string | null;
  readonly prev: string | null;
}

export interface LinkedListMarks {
  /** Row positions highlighted in the current step. */
  readonly highlight: readonly number[];
  /** Visited node ids. */
  readonly visited: readonly string[];
  /** Settled (final or found) node ids. */
  readonly settled: readonly string[];
  /** Named pointers to node ids. */
  readonly pointers: Readonly<Record<string, string>>;
}

export interface LinkedListState {
  readonly data: readonly ListNode[];
  readonly marks: LinkedListMarks;
  readonly doubly: boolean;
}

type Reduced = Result<LinkedListState, ReduceError>;

function init(decl: LinkedListDecl): LinkedListState {
  const n = decl.initial.length;
  const doubly = decl.doubly ?? false;
  const circular = (decl.circular ?? false) && n > 0;
  const idAt = (k: number) => decl.initial[(k + n) % n]!.id;
  const data = decl.initial.map((e, k): ListNode => ({
    id: e.id,
    value: e.value,
    next: k + 1 < n ? idAt(k + 1) : circular ? idAt(0) : null,
    prev: !doubly ? null : k > 0 ? idAt(k - 1) : circular ? idAt(n - 1) : null,
  }));
  return {
    data,
    doubly,
    marks: { highlight: [], visited: [], settled: [], pointers: {} },
  };
}

function reduceList(s: LinkedListState, a: LinkedListAction): Reduced {
  const n = s.data.length;
  const range = (
    limit: number,
    ...indices: readonly (readonly [readonly PropertyKey[], number])[]
  ) => checkRange('a linked list', n, limit, ...indices);
  const next = (
    data: readonly ListNode[],
    marks: Partial<LinkedListMarks> = {},
  ): Reduced => ok({ data, doubly: s.doubly, marks: { ...s.marks, ...marks } });

  switch (a.type) {
    case 'insert': {
      const bad =
        range(n + 1, [['index'], a.index]) ?? checkCapacity('linked list', n);
      if (bad) return err(bad);
      if (s.data.some((node) => node.id === a.element.id))
        return err({
          code: 'DUPLICATE_ID',
          path: ['element', 'id'],
          message: `A node with id "${a.element.id}" already exists`,
          hint: 'Give the new node a new id.',
        });
      const node: ListNode = {
        id: a.element.id,
        value: a.element.value,
        next: null,
        prev: null,
      };
      return next(insertAt(s.data, a.index, node), {
        highlight: reindex(s.marks.highlight, afterInsert(a.index)),
      });
    }
    case 'remove': {
      const bad = range(n, [['index'], a.index]);
      if (bad) return err(bad);
      const gone = s.data[a.index]!.id;
      const data = s.data
        .filter((node) => node.id !== gone)
        .map((node) => ({
          ...node,
          next: node.next === gone ? null : node.next,
          prev: node.prev === gone ? null : node.prev,
        }));
      const pointers = Object.fromEntries(
        Object.entries(s.marks.pointers).filter(([, id]) => id !== gone),
      );
      return next(data, {
        highlight: reindex(s.marks.highlight, afterRemove(a.index)),
        visited: s.marks.visited.filter((id) => id !== gone),
        settled: s.marks.settled.filter((id) => id !== gone),
        pointers,
      });
    }
    case 'move': {
      // Links and id-kept marks stay; only the row and its highlights move.
      const bad = range(n, [['from'], a.from], [['to'], a.to]);
      if (bad) return err(bad);
      const moved = s.data[a.from]!;
      const rest = s.data.filter((_, k) => k !== a.from);
      return next(insertAt(rest, a.to, moved), {
        highlight: reindex(s.marks.highlight, afterMove(a.from, a.to)),
      });
    }
    case 'set': {
      const bad = range(n, [['index'], a.index]);
      if (bad) return err(bad);
      return next(
        s.data.map((node, k) =>
          k === a.index ? { ...node, value: a.value } : node,
        ),
      );
    }
    case 'link': {
      const bad =
        range(n, [['from'], a.from]) ??
        (a.to === null ? undefined : range(n, [['to'], a.to]));
      if (bad) return err(bad);
      const field = a.field ?? 'next';
      if (field === 'prev' && !s.doubly)
        return err({
          code: 'INVALID_OPERATION',
          path: ['field'],
          message: 'A singly linked list has no prev pointers',
          hint: 'Declare the list with "doubly": true to use prev pointers.',
        });
      const target = a.to === null ? null : s.data[a.to]!.id;
      return next(
        s.data.map((node, k) =>
          k === a.from ? { ...node, [field]: target } : node,
        ),
      );
    }
    case 'pointer': {
      if (a.index === null)
        return next(s.data, { pointers: without(s.marks.pointers, a.name) });
      const bad = range(n, [['index'], a.index]);
      if (bad) return err(bad);
      return next(s.data, {
        pointers: { ...s.marks.pointers, [a.name]: s.data[a.index]!.id },
      });
    }
    case 'highlight': {
      const bad = range(
        n,
        ...a.indices.map((v, k) => [['indices', k], v] as const),
      );
      if (bad) return err(bad);
      return next(s.data, { highlight: a.indices });
    }
    case 'visit': {
      const bad = range(n, [['index'], a.index]);
      if (bad) return err(bad);
      const id = s.data[a.index]!.id;
      if (s.marks.visited.includes(id)) return ok(s);
      return next(s.data, { visited: [...s.marks.visited, id] });
    }
    case 'settle': {
      const bad = range(n, [['index'], a.index]);
      if (bad) return err(bad);
      const id = s.data[a.index]!.id;
      if (s.marks.settled.includes(id)) return ok(s);
      return next(s.data, { settled: [...s.marks.settled, id] });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const linkedListKind: StructureKind<
  LinkedListDecl,
  LinkedListState,
  LinkedListAction
> = {
  init,
  beginStep: (s) =>
    s.marks.highlight.length === 0
      ? s
      : { ...s, marks: { ...s.marks, highlight: [] } },
  reduce: reduceList,
};
