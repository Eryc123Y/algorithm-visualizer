import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Order = 'min' | 'max';

type HeapCall =
  | { readonly op: 'push'; readonly value: number }
  | { readonly op: 'pop' }
  | {
      readonly op: 'decrease-key' | 'increase-key';
      readonly index: number;
      readonly value: number;
    };

/** The heap's values at `frame` (default the last). */
function valuesAt(doc: VisualizationInput, frame?: number): unknown[] {
  const heap = stateOf(replay(doc), 'heap', 'array', frame);
  return heap.data.map((e) => e.value);
}

// An independent reference on plain arrays.
const first = (order: Order) => (a: number, b: number) =>
  order === 'min' ? a < b : a > b;

function siftUp(h: number[], i: number, order: Order): void {
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!first(order)(h[i]!, h[p]!)) return;
    [h[i], h[p]] = [h[p]!, h[i]!];
    i = p;
  }
}

function siftDown(h: number[], order: Order): void {
  for (let i = 0; 2 * i + 1 < h.length;) {
    let c = 2 * i + 1;
    if (c + 1 < h.length && first(order)(h[c + 1]!, h[c]!)) c += 1;
    if (!first(order)(h[c]!, h[i]!)) return;
    [h[i], h[c]] = [h[c]!, h[i]!];
    i = c;
  }
}

function reference(
  values: readonly number[],
  calls: readonly HeapCall[],
  order: Order,
) {
  const h: number[] = [];
  for (const v of values) {
    h.push(v);
    siftUp(h, h.length - 1, order);
  }
  const start = [...h];
  const results = calls.map((c) => {
    if (c.op === 'push') {
      h.push(c.value);
      siftUp(h, h.length - 1, order);
      return null;
    }
    if (c.op === 'pop') {
      const top = h[0]!;
      h[0] = h.at(-1)!;
      h.pop();
      siftDown(h, order);
      return top;
    }
    h[c.index] = c.value;
    siftUp(h, c.index, order);
    return null;
  });
  return { start, end: h, results };
}

const isHeap = (h: readonly unknown[], order: Order) =>
  h.every(
    (v, i) => i === 0 || !first(order)(v as number, h[(i - 1) >> 1] as number),
  );

const values = [5, 3, 8, 1, 9, 2];
const narrations = (doc: VisualizationInput) =>
  doc.steps.map((s) => s.meta?.narration ?? '');

describe('min-heap and max-heap', () => {
  it('starts from the heap the values build, without animating it', () => {
    const { document } = runOk('min-heap.push', { from: values, value: 4 });
    expect(valuesAt(document, 0)).toEqual(reference(values, [], 'min').start);
    expect(document.sections).toEqual([
      { id: 'push-4', title: 'Push 4', start: 0 },
    ]);
  });

  it('starts from a given array if it is a heap', () => {
    const { document } = runOk('min-heap.pop', {
      from: { array: [1, 3, 2, 5] },
    });
    expect(valuesAt(document, 0)).toEqual([1, 3, 2, 5]);
    expect(
      runError('min-heap.pop', { from: { array: [1, 3, 2, 0] } }),
    ).toMatchObject({
      code: 'INVALID_ARGUMENT',
      message:
        'Not a min-heap: 3 at index 1 comes after its child 0 at index 3',
    });
    expect(runError('max-heap.pop', { from: { array: [1, 3] } }).message).toBe(
      'Not a max-heap: 1 at index 0 comes after its child 3 at index 1',
    );
  });

  it('pushes at the end and sifts up', () => {
    const run = runOk('min-heap.push', { from: values, value: 0 });
    expect(valuesAt(run.document)).toEqual(
      reference(values, [{ op: 'push', value: 0 }], 'min').end,
    );
    expect(narrations(run.document)).toEqual([
      'Put 0 at the end.',
      '0 < 2, its parent: swap up.',
      'Swap 0 and 2.',
      '0 < 1, its parent: swap up.',
      'Swap 0 and 1.',
    ]);
  });

  it('pops the root and sifts the last value down', () => {
    const run = runOk('min-heap.pop', { from: values });
    expect(run.results).toEqual([1]);
    expect(valuesAt(run.document)).toEqual(
      reference(values, [{ op: 'pop' }], 'min').end,
    );
    expect(narrations(run.document).slice(0, 2)).toEqual([
      'Move the last value 8 to the root, and 1 to the end.',
      'Remove 1: it is the minimum.',
    ]);
    expect(runOk('min-heap.pop', { from: [7] }).results).toEqual([7]);
    expect(runError('min-heap.pop', { from: [] }).message).toBe(
      'The heap is empty: there is nothing to pop',
    );
  });

  it('decreases a key and sifts it up', () => {
    const call = { op: 'decrease-key', index: 4, value: 0 } as const;
    const run = runOk('min-heap.decrease-key', {
      from: values,
      index: 4,
      value: 0,
    });
    expect(valuesAt(run.document)).toEqual(
      reference(values, [call], 'min').end,
    );
    expect(narrations(run.document)[0]).toBe('Decrease h[4] from 9 to 0.');
    expect(
      runError('min-heap.decrease-key', { from: values, index: 4, value: 10 })
        .message,
    ).toBe('decrease-key must not increase h[4] (9) to 10');
    expect(
      runError('min-heap.decrease-key', { from: values, index: 6, value: 0 })
        .message,
    ).toBe('index 6 is past the end of the heap (6 values)');
  });

  it('works as a max-heap, with increase-key', () => {
    const calls = [
      { op: 'push', value: 7 },
      { op: 'pop' },
      { op: 'increase-key', index: 3, value: 10 },
    ] as const;
    const run = runOk('max-heap', { from: values, ops: calls });
    const ref = reference(values, calls, 'max');
    expect(valuesAt(run.document)).toEqual(ref.end);
    expect(run.results).toEqual([null, 9, null]);
    expect(run.document.title).toBe(
      'Binary max-heap: push 7, pop, increase key at 3 to 10',
    );
    expect(
      runError('min-heap', {
        from: values,
        ops: [{ op: 'increase-key', index: 0, value: 9 }],
      }),
    ).toEqual({
      code: 'INVALID_SHAPE',
      path: '$.input.ops[0].op',
      message: 'Unknown operation; use push, pop or decrease-key',
    });
  });

  it('matches the reference on random operations, composed or chained', () => {
    const value = fc.integer({ min: 0, max: 30 });
    fc.assert(
      fc.property(
        fc.constantFrom<Order>('min', 'max'),
        fc.array(value, { minLength: 1, maxLength: 12 }),
        fc.array(fc.tuple(fc.nat(2), value, fc.nat()), {
          minLength: 2,
          maxLength: 6,
        }),
        (order, start, picks) => {
          // Build calls that are valid for the heap size at each point.
          let size = start.length;
          const calls: HeapCall[] = [];
          for (const [kind, v, at] of picks) {
            if (kind === 1 && size > 0) {
              calls.push({ op: 'pop' });
              size -= 1;
            } else if (kind === 2 && size > 0) {
              const index = at % size;
              const now = reference(start, calls, order).end[index]!;
              const op = order === 'min' ? 'decrease-key' : 'increase-key';
              const target =
                order === 'min' ? Math.min(v, now) : Math.max(v, now);
              calls.push({ op, index, value: target });
            } else {
              calls.push({ op: 'push', value: v });
              size += 1;
            }
          }
          const id = `${order}-heap`;
          const run = runOk(id, { from: start, ops: calls });
          const ref = reference(start, calls, order);
          expect(valuesAt(run.document)).toEqual(ref.end);
          expect(run.results).toEqual(ref.results);
          expect(isHeap(valuesAt(run.document), order)).toBe(true);
          expect(run.after).toEqual({ array: ref.end });
          // One section per call, and every step named (ADR 0020).
          expect(run.document.sections).toHaveLength(calls.length);
          expect(run.document.steps.every((s) => s.meta?.id)).toBe(true);
          const one = runOk(id, { from: start, ops: calls.slice(0, 1) });
          const rest = runOk(id, { from: one.after, ops: calls.slice(1) });
          expect(valuesAt(rest.document)).toEqual(ref.end);
          expect(runOk(id, { from: start, ops: calls })).toEqual(run);
        },
      ),
      fuzz,
    );
  });

  it('rejects inputs it cannot show, at their paths', () => {
    const bad: [string, unknown, string][] = [
      ['min-heap.push', { from: values, value: Number.NaN }, '$.input.value'],
      [
        'min-heap.pop',
        { from: Array.from({ length: 33 }, (_, k) => k) },
        '$.input.from',
      ],
      [
        'min-heap.decrease-key',
        { from: values, index: 1.5, value: 0 },
        '$.input.index',
      ],
      ['min-heap.pop', { from: {} }, '$.input.from.array'],
      ['min-heap.pop', { from: { array: 3 } }, '$.input.from.array'],
      ['min-heap', { from: values, ops: [{ op: 'zap' }] }, '$.input.ops[0].op'],
    ];
    for (const [id, input, path] of bad)
      expect(runError(id, input), JSON.stringify(input)).toMatchObject({
        code: 'INVALID_SHAPE',
        path,
      });
  });

  it('says what forms `from` takes when it has neither', () => {
    const forms =
      'from must be up to 32 numbers to push, or { array } of up to 32 numbers that already is a heap';
    expect(runError('min-heap.pop', { from: 3 }).message).toBe(forms);
    for (const from of [{}, { array: 3 }, Array.from({ length: 33 }, () => 1)])
      expect(runError('min-heap.pop', { from }).hint).toBe(forms);
  });

  it('holds at most 32 values, so `after` can always start the next call', () => {
    const full = runOk('min-heap.push', {
      from: Array.from({ length: 31 }, (_, k) => k),
      value: 31,
    });
    expect(full.after).toEqual({ array: expect.any(Array) });
    expect(
      runError('min-heap.push', { from: full.after, value: 32 }).message,
    ).toBe('The heap is full: it holds at most 32 values');
    const last = runOk('min-heap.decrease-key', {
      from: full.after,
      index: 31,
      value: -1,
    });
    expect(last.results).toEqual([null]);
  });
});
