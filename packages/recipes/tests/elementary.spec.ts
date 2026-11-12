/**
 * The stack, the queue and the doubly linked list against independent
 * references: plain arrays for the stack and the queue's keys, a circular
 * buffer for the queue's cells, and for the list, the order read by
 * following the drawn next links from head, checked against the drawn prev
 * links. Random operations run composed and chained.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

const key = fc.integer({ min: -9, max: 30 });
const cells = (trace: Trace, name: string) =>
  stateOf(trace, name, 'array').data.map((e) => e.value);
const pointer = (trace: Trace, name: string, p: string) =>
  stateOf(trace, name, 'array').marks.pointers[p];

// ---------------------------------------------------------------------------
// Stack

type StackCall = { op: 'push'; key: number } | { op: 'pop' };

function stackReference(size: number, keys: number[], calls: StackCall[]) {
  const s = [...keys];
  const results = calls.map((c) =>
    c.op === 'push' ? (s.push(c.key), null) : s.pop()!,
  );
  return {
    cells: Array.from({ length: size }, (_, q) => s[q] ?? ''),
    results,
    top: s.length - 1,
  };
}

const stackRuns = fc
  .record({
    size: fc.integer({ min: 1, max: 16 }),
    keys: fc.array(key, { maxLength: 16 }),
    picks: fc.array(
      fc.oneof(
        key.map((k) => ({ op: 'push' as const, key: k })),
        fc.constant({ op: 'pop' as const }),
      ),
      {
        minLength: 1,
        maxLength: 8,
      },
    ),
  })
  .map(({ size, keys, picks }) => {
    const start = keys.slice(0, size);
    let n = start.length;
    const calls = picks.filter((c) => {
      if (c.op === 'push') return n < size && ++n > 0;
      return n > 0 && n-- > 0;
    });
    return { size, keys: start, calls };
  })
  .filter(({ calls }) => calls.length > 0);

function checkStack(
  trace: Trace,
  results: unknown,
  { size, keys, calls }: { size: number; keys: number[]; calls: StackCall[] },
) {
  const ref = stackReference(size, keys, calls);
  expect(cells(trace, 'S')).toEqual(ref.cells);
  if (results !== undefined) expect(results).toEqual(ref.results);
  expect(pointer(trace, 'S', 'top')).toBe(ref.top < 0 ? undefined : ref.top);
}

describe('stack', () => {
  it('matches a plain array on random pushes and pops, composed or chained', () => {
    fc.assert(
      fc.property(stackRuns, (input) => {
        const run = runOk('stack', {
          from: { size: input.size, keys: input.keys },
          ops: input.calls,
        });
        checkStack(replay(run.document), run.results, input);
        const one = runOk('stack', {
          from: { size: input.size, keys: input.keys },
          ops: input.calls.slice(0, 1),
        });
        if (input.calls.length > 1) {
          const rest = runOk('stack', {
            from: one.after,
            ops: input.calls.slice(1),
          });
          expect(cells(replay(rest.document), 'S')).toEqual(
            stackReference(input.size, input.keys, input.calls).cells,
          );
        }
      }),
      fuzz,
    );
  });

  it('overflows when full and underflows when empty', () => {
    expect(
      runError('stack.push', { from: { size: 2, keys: [1, 2] }, key: 3 })
        .message,
    ).toContain('overflows');
    expect(
      runError('stack.pop', { from: { size: 2, keys: [] } }).message,
    ).toContain('underflows');
    expect(
      runError('stack.pop', { from: { size: 2, keys: [1, 2, 3] } }).path,
    ).toBe('$.input');
  });
});

// ---------------------------------------------------------------------------
// Queue

type QueueCall = { op: 'enqueue'; key: number } | { op: 'dequeue' };

function queueReference(
  size: number,
  head: number,
  keys: number[],
  calls: QueueCall[],
) {
  const q: (number | '')[] = Array.from({ length: size }, () => '');
  let h = head;
  let t = head;
  const enqueue = (k: number) => {
    q[t] = k;
    t = (t + 1) % size;
  };
  keys.forEach(enqueue);
  const results = calls.map((c) => {
    if (c.op === 'enqueue') return (enqueue(c.key), null);
    const k = q[h] as number;
    q[h] = '';
    h = (h + 1) % size;
    return k;
  });
  return { cells: q, results, head: h, tail: t };
}

const queueRuns = fc
  .record({
    size: fc.integer({ min: 2, max: 16 }),
    head: fc.nat(),
    keys: fc.array(key, { maxLength: 15 }),
    picks: fc.array(
      fc.oneof(
        key.map((k) => ({ op: 'enqueue' as const, key: k })),
        fc.constant({ op: 'dequeue' as const }),
      ),
      {
        minLength: 1,
        maxLength: 8,
      },
    ),
  })
  .map(({ size, head, keys, picks }) => {
    const start = keys.slice(0, size - 1);
    let n = start.length;
    const calls = picks.filter((c) => {
      if (c.op === 'enqueue') return n < size - 1 && ++n > 0;
      return n > 0 && n-- > 0;
    });
    return { size, head: head % size, keys: start, calls };
  })
  .filter(({ calls }) => calls.length > 0);

describe('queue', () => {
  it('matches a circular buffer on random operations, composed or chained', () => {
    fc.assert(
      fc.property(queueRuns, ({ size, head, keys, calls }) => {
        const run = runOk('queue', { from: { size, head, keys }, ops: calls });
        const ref = queueReference(size, head, keys, calls);
        const trace = replay(run.document);
        expect(cells(trace, 'Q')).toEqual(ref.cells);
        expect(run.results).toEqual(ref.results);
        expect(pointer(trace, 'Q', 'head')).toBe(ref.head);
        expect(pointer(trace, 'Q', 'tail')).toBe(ref.tail);
        if (calls.length > 1) {
          const one = runOk('queue', {
            from: { size, head, keys },
            ops: calls.slice(0, 1),
          });
          const rest = runOk('queue', { from: one.after, ops: calls.slice(1) });
          expect(cells(replay(rest.document), 'Q')).toEqual(ref.cells);
        }
      }),
      fuzz,
    );
  });

  it('wraps around, holds at most n − 1 keys, and underflows when empty', () => {
    const run = runOk('queue', {
      from: { size: 4, head: 3, keys: [5] },
      ops: [{ op: 'enqueue', key: 6 }],
    });
    expect(cells(replay(run.document), 'Q')).toEqual([6, '', '', 5]);
    expect(
      runError('queue.enqueue', { from: { size: 3, keys: [1, 2] }, key: 3 })
        .message,
    ).toContain('overflows');
    expect(
      runError('queue.dequeue', { from: { size: 3, keys: [] } }).message,
    ).toContain('underflows');
    expect(
      runError('queue.dequeue', { from: { size: 3, head: 3, keys: [] } }).path,
    ).toBe('$.input');
  });
});

// ---------------------------------------------------------------------------
// Doubly linked list

type ListCall =
  | { op: 'search'; key: number }
  | { op: 'prepend'; key: number }
  | { op: 'insert'; key: number; after: number }
  | { op: 'delete'; key: number };

function listReference(keys: number[], calls: ListCall[]) {
  const l = [...keys];
  const results = calls.map((c) => {
    if (c.op === 'search') return l.includes(c.key);
    if (c.op === 'prepend') return (l.unshift(c.key), null);
    if (c.op === 'insert')
      return (l.splice(l.indexOf(c.after) + 1, 0, c.key), null);
    const at = l.indexOf(c.key);
    if (at >= 0) l.splice(at, 1);
    return at >= 0;
  });
  return { keys: l, results };
}

/** The keys in the order of the drawn links, checked both ways. */
function linked(trace: Trace): number[] {
  const list = stateOf(trace, 'L', 'linkedList');
  const byId = new Map(list.data.map((n) => [n.id, n]));
  const head = list.marks.pointers['head'] ?? list.data[0]?.id;
  const order: string[] = [];
  for (let id = head ?? null; id !== null; id = byId.get(id)!.next)
    order.push(id);
  expect(order).toHaveLength(list.data.length);
  order.forEach((id, k) =>
    expect(byId.get(id)!.prev).toBe(k === 0 ? null : order[k - 1]),
  );
  return order.map((id) => byId.get(id)!.value as number);
}

const listRuns = fc
  .record({
    keys: fc.uniqueArray(key, { maxLength: 8 }),
    picks: fc.array(
      fc.oneof(
        key.map((k) => ({ op: 'search' as const, key: k })),
        key.map((k) => ({ op: 'prepend' as const, key: k })),
        fc.record({ op: fc.constant('insert' as const), key, after: key }),
        key.map((k) => ({ op: 'delete' as const, key: k })),
      ),
      { minLength: 1, maxLength: 8 },
    ),
  })
  .map(({ keys, picks }) => {
    const l = [...keys];
    const calls = picks.filter((c) => {
      if (c.op === 'prepend' || c.op === 'insert') {
        if (l.length >= 12 || (c.op === 'insert' && !l.includes(c.after)))
          return false;
        if (c.op === 'prepend') l.unshift(c.key);
        else l.splice(l.indexOf(c.after) + 1, 0, c.key);
      }
      if (c.op === 'delete' && l.includes(c.key)) l.splice(l.indexOf(c.key), 1);
      return true;
    });
    return { keys, calls };
  })
  .filter(({ calls }) => calls.length > 0);

describe('linked-list', () => {
  it('matches an array of keys on random operations, composed or chained', () => {
    fc.assert(
      fc.property(listRuns, ({ keys, calls }) => {
        const run = runOk('linked-list', { from: { keys }, ops: calls });
        const ref = listReference(keys, calls);
        expect(linked(replay(run.document))).toEqual(ref.keys);
        expect(run.results).toEqual(ref.results);
        expect(run.after).toEqual({ keys: ref.keys });
        if (calls.length > 1) {
          const one = runOk('linked-list', {
            from: { keys },
            ops: calls.slice(0, 1),
          });
          const rest = runOk('linked-list', {
            from: one.after,
            ops: calls.slice(1),
          });
          expect(linked(replay(rest.document))).toEqual(ref.keys);
        }
      }),
      fuzz,
    );
  });

  it('searches from the head, one step per node passed', () => {
    const steps = (k: number) =>
      runOk('linked-list.search', {
        from: { keys: [9, 16, 4, 1] },
        key: k,
      }).document.steps.map((s) => s.meta?.id);
    expect(steps(4)).toEqual(['start', 'next', 'next', 'result']);
    expect(steps(7)).toEqual([
      'start',
      'next',
      'next',
      'next',
      'next',
      'result',
    ]);
    expect(
      runOk('linked-list.search', { from: { keys: [] }, key: 1 }).results,
    ).toEqual([false]);
  });

  it('deletes the head, the tail and the only node', () => {
    for (const [keys, k, end] of [
      [[9, 16, 4], 9, [16, 4]],
      [[9, 16, 4], 4, [9, 16]],
      [[9], 9, []],
    ] as const) {
      const run = runOk('linked-list.delete', {
        from: { keys: [...keys] },
        key: k,
      });
      expect(linked(replay(run.document))).toEqual(end);
    }
  });

  it('refuses to insert after a missing key, or past 12 nodes', () => {
    expect(
      runError('linked-list.insert', {
        from: { keys: [1, 2] },
        key: 3,
        after: 7,
      }).message,
    ).toContain('7 is not in the list');
    const twelve = Array.from({ length: 12 }, (_, k) => k);
    expect(
      runError('linked-list.prepend', { from: { keys: twelve }, key: 99 })
        .message,
    ).toContain('12 nodes');
  });
});

recipe(
  'stack',
  stackRuns,
  ({ size, keys, calls }) =>
    runOk('stack', { from: { size, keys }, ops: calls }).document,
  (trace, input) => checkStack(trace, undefined, input),
);
recipe(
  'queue',
  queueRuns,
  ({ size, head, keys, calls }) =>
    runOk('queue', { from: { size, head, keys }, ops: calls }).document,
  (trace, { size, head, keys, calls }) =>
    expect(cells(trace, 'Q')).toEqual(
      queueReference(size, head, keys, calls).cells,
    ),
);
recipe(
  'linked-list',
  listRuns,
  ({ keys, calls }) =>
    runOk('linked-list', { from: { keys }, ops: calls }).document,
  (trace, { keys, calls }) =>
    expect(linked(trace)).toEqual(listReference(keys, calls).keys),
);
