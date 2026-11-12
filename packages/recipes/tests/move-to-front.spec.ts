/**
 * Move-to-front (ADR 0036) against an independent one written on a plain
 * array: each request's cost, the total, and the list drawn after every
 * step as the list its links make, head first; also the refusals and the
 * requests for the head.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { LinkedListState, Trace } from '@algomotion/core';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** Move-to-front on an array: the costs and the final order. */
function reference(list: readonly string[], requests: readonly string[]) {
  const order = [...list];
  const costs = requests.map((k) => {
    const r = order.indexOf(k) + 1;
    order.splice(r - 1, 1);
    order.unshift(k);
    return 2 * r - 1;
  });
  return { costs, order };
}

/** The list its links make, from the node `head` points at. */
function walk(s: LinkedListState): string[] {
  const byId = new Map(s.data.map((n) => [n.id, n]));
  const out: string[] = [];
  for (let id: string | null = s.marks.pointers['head'] ?? null; id !== null;) {
    const n = byId.get(id)!;
    out.push(String(n.value));
    if (out.length > s.data.length) throw new Error('the links loop');
    id = n.next;
  }
  return out;
}

const listOf = (trace: Trace, frame?: number) =>
  stateOf(trace, 'L', 'linkedList', frame);
const costsOf = (trace: Trace) => {
  const t = stateOf(trace, 'cost', 'table');
  return t.data.slice(0, -1).map((row) => row[3]);
};

/** The table a run should end with: r, r − 1 and 2r − 1 per request. */
function tableFor(requests: readonly (number | string)[], costs: number[]) {
  const rows = requests.map((k, i) => {
    const r = (costs[i]! + 1) / 2;
    return [k, r, r - 1, 2 * r - 1];
  });
  const sum = (c: number) => rows.reduce((a, row) => a + (row[c] as number), 0);
  return [...rows, ['total', sum(1), sum(2), sum(3)]];
}

describe('move-to-front', () => {
  it('moves each key to the front and counts 2r − 1 per request', () => {
    const { document, results } = runOk('move-to-front', {
      list: '4 2 7 1',
      requests: '7 7 1 4',
    });
    // 7 at 3 costs 5; then at 1 costs 1; 1 at 4 costs 7; 4 at 3 costs 5.
    expect(results).toEqual([18]);
    const trace = replay(document);
    expect(costsOf(trace)).toEqual([5, 1, 7, 5]);
    expect(walk(listOf(trace))).toEqual(['4', '1', '7', '2']);
    // The row on screen is the list too.
    expect(listOf(trace).data.map((n) => String(n.value))).toEqual([
      '4',
      '1',
      '7',
      '2',
    ]);
  });

  it('agrees with a plain move-to-front, and is a list in every step', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 30 }), {
          minLength: 1,
          maxLength: 12,
        }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 32 }),
        (keys, picks) => {
          const list = keys.map(String);
          const requests = picks.map((p) => list[p % list.length]!);
          const { costs, order } = reference(list, requests);
          const { document, results } = runOk('move-to-front', {
            list: keys,
            requests: requests.map(Number),
          });
          expect(results).toEqual([costs.reduce((a, b) => a + b, 0)]);
          const trace = replay(document);
          expect(stateOf(trace, 'cost', 'table').data).toEqual(
            tableFor(requests.map(Number), costs),
          );
          // From the first step, when head is set.
          for (let f = 1; f <= trace.length; f++) {
            const s = listOf(trace, f);
            expect(walk(s)).toEqual(s.data.map((n) => String(n.value)));
          }
          expect(walk(listOf(trace))).toEqual(order);
        },
      ),
      fuzz,
    );
  });

  it('serves words as it serves numbers', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    const requests = ['e', 'd', 'e', 'a', 'c'];
    const { costs, order } = reference(list, requests);
    const { document, results } = runOk('move-to-front', { list, requests });
    expect(results).toEqual([costs.reduce((a, b) => a + b, 0)]);
    const trace = replay(document);
    expect(stateOf(trace, 'cost', 'table').data).toEqual(
      tableFor(requests, costs),
    );
    expect(walk(listOf(trace))).toEqual(order);
  });

  it('leaves the head where it is when it is requested', () => {
    const { document } = runOk('move-to-front', {
      list: 'a b c',
      requests: 'a a',
    });
    const ids = replay(document).visualization.steps.map((s) => s.meta?.id);
    expect(ids.filter((id) => id === 'front')).toHaveLength(2);
    expect(ids).not.toContain('move');
  });

  it('refuses keys given twice and requests for missing keys', () => {
    expect(
      runError('move-to-front', { list: '1 2 1', requests: '1' }).message,
    ).toMatch(/1 is in the list twice/);
    expect(
      runError('move-to-front', { list: '1 2 3', requests: '2 5' }).message,
    ).toMatch(/5 is requested but not in the list/);
    // A number and the word that writes it are one key.
    expect(
      runError('move-to-front', { list: [1, '1'], requests: [1] }).message,
    ).toMatch(/1 is in the list twice/);
    expect(
      runError('move-to-front', { list: [123456], requests: [123456] }).code,
    ).toBe('INVALID_SHAPE');
    expect(
      runError('move-to-front', {
        list: '1 2 3 4 5 6 7 8 9 10 11 12 13',
        requests: '1',
      }).code,
    ).toBe('INVALID_SHAPE');
  });
});
