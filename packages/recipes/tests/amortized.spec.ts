/**
 * The binary counter and the dynamic table against independent
 * references: the counter's bits are the binary digits of t mod 2^k, an
 * increment flips the bits that differ between t − 1 and t, and Φ is the
 * number of 1s; the table holds the items with 2^⌈lg t⌉ slots, an
 * insertion costs 1 plus the items copied when t − 1 is a power of 2, and
 * Φ = 2·num − size. Both stay within the amortized bounds, 2n and 3n.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

const popcount = (x: number) => x.toString(2).replaceAll('0', '').length;

function checkCounter(doc: VisualizationInput, k: number, n: number): void {
  const trace = replay(doc);
  const value = n % 2 ** k;
  const bits = stateOf(trace, 'A', 'table').data[0]!;
  // A[k − 1] on the left.
  expect(bits.join('')).toBe(value.toString(2).padStart(k, '0'));
  const ledger = stateOf(trace, 'cost', 'table').data;
  let total = 0;
  for (let t = 1; t <= n; t++) {
    const now = t % 2 ** k;
    const flips = popcount(((t - 1) % 2 ** k) ^ now);
    total += flips;
    expect(ledger[t - 1]).toEqual([now, flips, total, popcount(now)]);
  }
  expect(total).toBeLessThan(2 * n + 1);
  expect(doc.steps).toHaveLength(total);
}

function checkTable(doc: VisualizationInput, items: readonly number[]): void {
  const trace = replay(doc);
  const n = items.length;
  const size = 2 ** Math.ceil(Math.log2(n));
  const T = stateOf(trace, 'T', 'array').data.map((e) => e.value);
  expect(T).toEqual([...items, ...Array.from({ length: size - n }, () => '')]);
  const ledger = stateOf(trace, 'cost', 'table').data;
  let total = 0;
  for (let t = 1; t <= n; t++) {
    const copies = t > 1 && Number.isInteger(Math.log2(t - 1)) ? t - 1 : 0;
    total += 1 + copies;
    const slots = 2 ** Math.ceil(Math.log2(t));
    expect(ledger[t - 1]).toEqual([t, slots, 1 + copies, total, 2 * t - slots]);
  }
  expect(total).toBeLessThan(3 * n);
}

describe('binary-counter', () => {
  it('counts to 8 with 4 bits, in 15 flips', () => {
    const doc = runOk('binary-counter', undefined).document;
    checkCounter(doc, 4, 8);
    expect(doc.steps).toHaveLength(15);
  });

  it('wraps around to 0 when every bit is 1', () => {
    const doc = runOk('binary-counter', { k: 2, n: 4 }).document;
    checkCounter(doc, 2, 4);
    expect(doc.steps.at(-1)!.meta!.narration).toContain('wraps around to 0');
  });

  it('matches the binary digits on random runs', () => {
    fc.assert(
      fc.property(counters, ({ k, n }) =>
        checkCounter(runOk('binary-counter', { k, n }).document, k, n),
      ),
      fuzz,
    );
  });

  it('takes 1 to 8 bits and 1 to 16 increments', () => {
    expect(runError('binary-counter', { k: 9, n: 1 }).path).toBe('$.input.k');
    expect(runError('binary-counter', { k: 3, n: 17 }).path).toBe('$.input.n');
  });
});

describe('dynamic-table', () => {
  it('doubles from 1 slot to 16 for nine items, costing 21 in all', () => {
    const items = [5, 3, 8, 1, 9, 2, 7, 4, 6];
    const doc = runOk('dynamic-table', undefined).document;
    checkTable(doc, items);
    expect(doc.steps.filter((s) => s.meta?.id === 'expand')).toHaveLength(4);
  });

  it('matches the powers of 2 on random items', () => {
    fc.assert(
      fc.property(tables, (items) =>
        checkTable(runOk('dynamic-table', items).document, items),
      ),
      fuzz,
    );
  });

  it('takes 1 to 16 items', () => {
    expect(runError('dynamic-table', { items: [] }).path).toBe('$.input.items');
    expect(
      runError('dynamic-table', { items: Array.from({ length: 17 }, () => 1) })
        .path,
    ).toBe('$.input.items');
  });
});

const counters = fc.record({
  k: fc.integer({ min: 1, max: 8 }),
  n: fc.integer({ min: 1, max: 16 }),
});
const tables = fc.array(fc.integer({ min: -99, max: 99 }), {
  minLength: 1,
  maxLength: 16,
});

recipe(
  'binary-counter',
  counters,
  ({ k, n }) => runOk('binary-counter', { k, n }).document,
  (trace, { k, n }) => checkCounter(trace.visualization, k, n),
);
recipe(
  'dynamic-table',
  tables,
  (items) => runOk('dynamic-table', { items }).document,
  (trace, items) => checkTable(trace.visualization, items),
);
